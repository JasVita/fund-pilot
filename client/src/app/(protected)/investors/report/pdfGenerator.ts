import { jsPDF } from "jspdf";
import { toStr, fmtYYYYMM, fmtMoney, fmtMoneyLines, to2dp, initials, fmtMoneyWithTagLines, fmtYYYYMMWithTagLines } from "@/lib/report-format";

/* ---------- types ------------------------------------------------ */
interface ReportData {
  investor: string;
  reportDate: string;
  tableData: {
    productName: string;
    subscriptionTime: string;
    dataDeadline: string;
    subscriptionAmount: string;
    marketValue: string;
    totalAfterDeduction: string;
    estimatedProfit: string;
  }[];

  dividendRows?: {
    fund_category: string;
    paid_date: string;
    amount: string;
  }[];

  totalSubscriptionAmount: string;
  totalMarketValue: string;
  totalAfterDeduction: string;
  totalProfit: string;
}

/* ---------- util: memoised fetch → data-URL ---------------------- */
async function fetchAsDataURL(path: string, key: string): Promise<string> {
  const anyFn = fetchAsDataURL as any;
  if (anyFn[key]) return anyFn[key];

  const blob = await fetch(path).then(r => r.blob());
  const dataUrl: string = await new Promise((ok, err) => {
    const fr = new FileReader();
    fr.onload = () => ok(fr.result as string);
    fr.onerror = err;
    fr.readAsDataURL(blob);
  });
  return (anyFn[key] = dataUrl);
}

/* ---------- NEW: helper to get canonical investor name ----------- */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5003";

async function fetchFormattedName(raw: string): Promise<string> {
  const url = `${API_BASE}/investors/format-name?name=${encodeURIComponent(raw.trim())}`;
  const r = await fetch(url, { credentials: "include" });
  if (!r.ok) throw new Error(`format-name fetch ${r.status}`);
  return (await r.text()).trim();
}


/* ---------- helpers for static images ---------------------------- */
const getCoverImg = () => fetchAsDataURL("/cover-bg.png", "cover");
const getLogoCoverImg = () => fetchAsDataURL("/logo-white-cover.png", "logoCover");
const getLogoTableBlack = () => fetchAsDataURL("/logo-black-table.png", "logoTableBlk");
const getLogoDisclaimer = () => fetchAsDataURL("/logo-white-disclaimer.png", "logoDisc");

/* ---------- ZhengTiFan font loader (robust) ---------------------- */
async function ensureZhengTiFan(doc: jsPDF) {
  const FONT_FILE = "ZhengTiFan.ttf";
  const FONT_NAME = "ZhengTiFan";
  const CACHE_KEY = "_ZhengTiFan_base64_v2";

  // already cached?
  let base64: string | undefined = (ensureZhengTiFan as any)[CACHE_KEY];
  if (!base64) {
    try {
      // same-origin absolute URL avoids weird routing
      const url = typeof window !== "undefined"
        ? new URL(`/fonts/${FONT_FILE}`, window.location.origin).toString()
        : `/fonts/${FONT_FILE}`;

      const res = await fetch(url, { cache: "force-cache", credentials: "same-origin" });
      if (!res.ok) throw new Error(`font HTTP ${res.status}`);

      const buf = await res.arrayBuffer();

      // ArrayBuffer -> base64 (chunked to avoid call stack limits)
      const bytes = new Uint8Array(buf);
      const chunk = 0x8000;
      let binary = "";
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      base64 = btoa(binary);
      (ensureZhengTiFan as any)[CACHE_KEY] = base64;
    } catch (e) {
      console.warn("[pdf] Failed to load ZhengTiFan.ttf, falling back to Helvetica.", e);
      return; // ← do NOT throw, continue with built-in fonts
    }
  }

  (doc as any).addFileToVFS(FONT_FILE, base64);
  (doc as any).addFont(FONT_FILE, FONT_NAME, "normal");
}

function fmtProfitLines(val: string): string {
  return val
    .split("\n")
    .map(line => {
      const raw = line.trim();                               // visible trim
      if (raw === "" || raw.toUpperCase() === "NA") return raw;

      /* remove all spaces / NBSPs / commas for numeric tests */
      const clean = raw.replace(/[\s,\u00A0]/g, "");

      /* pull the numeric value (drop any sign / %) */
      const num   = parseFloat(clean.replace(/^[+-]?/, "").replace(/%$/, ""));
      const hasSign = /^[+-]/.test(clean);                   // on the clean text
      const sign = num > 0 && !hasSign ? "+" : hasSign ? clean[0] : "";

      /* body = number without sign / % but keep internal formatting */
      const body = raw.replace(/^[+-]?/, "").replace(/%$/, "");
      return `${sign}${body}%`;
    })
    .join("\n");
}

/* ---------- main builder ----------------------------------------- */
export async function generateInvestmentReport(data: ReportData) {
  const canonicalName = await fetchFormattedName(data.investor);    
  
  const nameInitials  = initials(canonicalName);                   
  // console.log("[generateInvestmentReport] canonicalName →", canonicalName, "nameInitials →", nameInitials);

  /* ---------- page geometry (A4 landscape) ----------------------- */
  const pageH = 210;                       // mm
  const pageW = (4000 / 2259) * pageH;     // ≈ 372 mm

  /* printable area */
  const TOP_MARGIN = 55;   // first table header sits here
  const BOTTOM_MARGIN = 45;   // keep footer area clear
  const TABLE_GAP = 0.5;

  const colW = [73, 32, 32, 41, 41, 41, 50];
  const headerH = 25;
  const lineGap = 6;
  const colX: number[] = [];
  const tableX = 30;
  let cursor = tableX;
  colW.forEach(w => { colX.push(cursor); cursor += w + TABLE_GAP; });

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [pageW, pageH], compress: true });

  await ensureZhengTiFan(doc);

  const [bg, logoCover, logoDisc, logoTableBlk] = await Promise.all([
    getCoverImg(), getLogoCoverImg(), getLogoDisclaimer(), getLogoTableBlack(),
  ]);

  /* ==============================================================
     helper: draw table header – returns y under header row
  =================================================================*/
  function drawTableHeader(startY: number): number {
    // grey rectangles
    colW.forEach((w, i) =>
      doc.setFillColor(208, 206, 206).rect(colX[i], startY, w, headerH, "F")
    );
    // header titles
    doc.setFont("ZhengTiFan").setFontSize(14).setTextColor(0);
    const headers = [
      "產品名稱\n(開放式基金)", "認購時間", "數據截止",
      "認購金額\n(USD)", "市值", "含息後總額", "估派息後盈虧(%)"
    ];
    headers.forEach((h, i) => {
      doc.text(
        h,
        colX[i] + colW[i] / 2,
        startY + headerH / 2,
        { align: "center", baseline: "middle" }
      );
    });
    return startY + headerH + TABLE_GAP;
  }

  /* ------------ footer: reusable on every table-page ------------ */
  function drawFooter() {
    doc.setFont("ZhengTiFan").setFontSize(12).setTextColor(0);
    doc.text(
      "存續報告僅供內部參考使用 投資人實際數字以月結單為准",
      30,
      pageH - 20
    );
  }
  
  /* ------ helper: start a new “page-2 style” table page ---------- */
  function startNewTablePage(): number {
    doc.addPage();
    doc.setTextColor(0);     
    doc.addImage(logoTableBlk, "PNG", 280, 12, 70, 29.6);
    doc.setFont("ZhengTiFan").setFontSize(28).text("已投資產品總結", 30, 40);
    drawFooter();                     // 👈  add the footer right away
    return drawTableHeader(TOP_MARGIN);
  }

  /* ------ helper: start a new “Dividend history” page ------------ */
  function startNewDivTablePage(): number {
    doc.addPage();
    doc.setTextColor(0);
    doc.addImage(logoTableBlk, "PNG", 280, 12, 70, 29.6);
    doc.setFont("ZhengTiFan").setFontSize(28).text("已投資產品總結", 30, 40);
    drawFooter();                              // same footer as other pages
    return TOP_MARGIN;                         // NOTE: no 7‑column header
  }


  /* ============ Page 1 – Cover ================================== */
  doc.addImage(bg, "PNG", 0, 0, pageW, pageH);
  doc.addImage(logoCover, "PNG", 20.4, 16.4, 129.2, 45.8);

  // ${data.investor}存續報告
  doc.setFont("helvetica", "bold").setFontSize(26).setTextColor(255);
  
  // const investorW = doc.getTextWidth(data.investor);
  const investorW = doc.getTextWidth(nameInitials); 

  doc.setFont("ZhengTiFan", "normal").setFontSize(26).setTextColor(255);
  const reportLabel = " 存續報告";
  const labelW = doc.getTextWidth(reportLabel);

  /* centre the *combined* string by drawing two slices               */
  const titleY = pageH / 2 - 20;
  const titleX = (pageW - (investorW + labelW)) / 2;

  doc.setFont("helvetica", "bold").text(nameInitials, titleX, titleY);
  doc.setFont("ZhengTiFan", "normal").text(reportLabel, titleX + investorW, titleY);

  // ${data.reportDate}
  doc.setFont("helvetica", "normal").setFontSize(16).setTextColor(255);
  doc.text(data.reportDate, (pageW - doc.getTextWidth(data.reportDate)) / 2, pageH / 2 + 10);

  doc.setFont("ZhengTiFan", "normal").setFontSize(16).setTextColor(255);
  const subtitle = "表格為計算數位，實際數位以正式報告為主";
  doc.text(subtitle, (pageW - doc.getTextWidth(subtitle)) / 2, pageH / 2 + 30);

  /* ============ Page 2 – Table ================================== */
  let y = startNewTablePage();

  /** -----------------------------------------------------------------
   * splitIntoChunks()
   *   • takes a “logical” row (one fund)
   *   • breaks it into sub-rows that all fit on a page
   * ---------------------------------------------------------------- */
  function splitIntoChunks(r: ReportData["tableData"][number]) {
    const split = (s: string | null | undefined): string[] => toStr(s).split("\n");

    const cols = [
      split(r.productName),
      split(r.subscriptionTime).map(fmtYYYYMM),
      split(fmtYYYYMMWithTagLines(r.dataDeadline)),        // date + [贖回]
      split(fmtMoneyWithTagLines(r.subscriptionAmount)),   // money + [tag]
      split(fmtMoneyWithTagLines(r.marketValue)),          // money + [tag]
      split(
        fmtMoneyLines(
          r.totalAfterDeduction.split("\n").map(to2dp).join("\n")
        )
      ),
      [r.estimatedProfit],
    ];

    const CHUNK_CAP =
      Math.floor((pageH - TOP_MARGIN - BOTTOM_MARGIN) / lineGap) - 2;

    const chunks: typeof r[] = [];
    let offset = 0;

    while (true) {
      const remaining = Math.max(...cols.map((c) => c.length)) - offset;
      if (remaining <= 0) break;

      const take = Math.min(remaining, CHUNK_CAP);

      chunks.push({
        // productName: offset === 0 ? cols[0][0] : "",
        productName: cols[0][0],
        subscriptionTime: cols[1].slice(offset, offset + take).join("\n"),
        dataDeadline: cols[2].slice(offset, offset + take).join("\n"),
        subscriptionAmount: cols[3].slice(offset, offset + take).join("\n"),
        marketValue: cols[4].slice(offset, offset + take).join("\n"),
        totalAfterDeduction: offset === 0 ? cols[5][0] : "",
        estimatedProfit: offset === 0 ? r.estimatedProfit : "",
      });

      offset += take;
    }
    return chunks;
  }


  /* ---- switch back to Helvetica for the rest ------------------- */
  doc.setFont("ZhengTiFan", "normal").setTextColor(0);

    /* ---------- body rows ----------------------------------------- */
    let zebra = 0;

    for (const logical of data.tableData) {
      const flatRows = splitIntoChunks(logical);                  // paginate long items

      for (const row of flatRows) {
        const cells = [
          row.productName,
          row.subscriptionTime,
          row.dataDeadline,
          fmtMoneyWithTagLines(row.subscriptionAmount),
          fmtMoneyWithTagLines(row.marketValue),
          fmtMoneyLines(
            row.totalAfterDeduction.split("\n").map(to2dp).join("\n")
          ),
          fmtProfitLines(row.estimatedProfit),                    // ← NEW helper
        ];

        const wrapped = cells.map((txt, i) =>
          doc.splitTextToSize(
            i === 0 ? txt.replace(/(.{1,20})/g, "$1\n") : txt,
            colW[i] - 4
          )
        ) as string[][];

        const rowH = Math.max(...wrapped.map(w => w.length)) * lineGap + 4;

        /* page break? ------------------------------------------------- */
        if (y + rowH > pageH - BOTTOM_MARGIN) y = startNewTablePage();

        /* zebra background ------------------------------------------- */
        const bg = zebra % 2 ? [217, 217, 217] : [232, 232, 232];
        colW.forEach((w, i) =>
          doc.setFillColor(bg[0], bg[1], bg[2]).rect(colX[i], y, w, rowH, "F")
        );

        /* draw the text ---------------------------------------------- */
        wrapped.forEach((lines, colIdx) => {
          const cx = colX[colIdx] + colW[colIdx] / 2;

          lines.forEach((ln: string, li: number) => {
            const v = ln.trim();

            /* colour only the P&L column */
            if (colIdx === 6) {
              const clean = v.replace(/[\s\u00A0]/g, "");       // zap NBSP/space
              if (/^-/.test(clean))       doc.setTextColor(192, 0, 0);   // red
              else if (/^\+|\d/.test(clean))
                                        doc.setTextColor(0, 192, 0);    // green
              else                       doc.setTextColor(0, 0, 0);     // NA / blank
            } else {
              doc.setTextColor(0);
            }

            doc.text(ln, cx, y + 8 + li * lineGap, { align: "center" });
          });
        });

        y += rowH + TABLE_GAP;
        zebra++;
      }
    }

    /* ===== NEW: totals label + 加總 rows ========================= */

    // helpers to parse numbers safely
    const parseNum = (s: string) => {
      const n = Number(String(s).replace(/[, \u00A0]/g, "").trim());
      return Number.isFinite(n) ? n : 0;
    };
    const sumMoneyLines = (s: string | undefined) =>
      String(s ?? "")
        .split("\n")
        .map(parseNum)
        .reduce((a, b) => a + b, 0);

    // 1) totals per your rules
    let totalSub = 0, totalMkt = 0, totalAfter = 0;
    (data.tableData || []).forEach(r => {
      const sub = sumMoneyLines(r.subscriptionAmount);
      const mkt = sumMoneyLines(r.marketValue);
      const after = (r.totalAfterDeduction && r.totalAfterDeduction.trim() !== "")
        ? sumMoneyLines(r.totalAfterDeduction)
        : mkt; // use 市值 if 含息後總額 missing
      totalSub   += sub;
      totalMkt   += mkt;
      totalAfter += after;
    });
    const totalPct = totalSub > 0 ? ((totalAfter - totalSub) / totalSub) * 100 : 0;

    // 2) formatted strings
    const fmtUSD = (n: number) =>
      n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const totalSubStr   = fmtUSD(totalSub);
    const totalMktStr   = fmtUSD(totalMkt);
    const totalAfterStr = fmtUSD(totalAfter);
    const totalPctStr   = `${totalPct >= 0 ? "+" : ""}${totalPct.toFixed(2)}%`;

    // 3) LABEL ROW (empty first 3 cols)
    const labelCells = ["", "", "", "總認購金額", "總市值", "含息後總額", "總盈虧（%）"];
    const wrappedLabel = labelCells.map((txt, i) =>
      doc.splitTextToSize(String(txt), colW[i] - 4)
    ) as string[][];
    const labelH = Math.max(...wrappedLabel.map(w => w.length)) * lineGap + 4;

    if (y + labelH > pageH - BOTTOM_MARGIN) y = startNewTablePage();

    // draw label row background
    colW.forEach((w, i) => doc.setFillColor(208, 206, 206).rect(colX[i], y, w, labelH, "F"));

    // draw label text (make the last label red like header style)
    wrappedLabel.forEach((lines, colIdx) => {
      const cx = colX[colIdx] + colW[colIdx] / 2;
      lines.forEach((ln: string, li: number) => {
        if (colIdx === 6) doc.setTextColor(192, 0, 0); else doc.setTextColor(0);
        doc.text(ln, cx, y + 8 + li * lineGap, { align: "center" });
      });
    });
    y += labelH + TABLE_GAP;

    // 4) 加總 ROW
    const totalsCells = [
      "加總", "", "",
      totalSubStr, totalMktStr, totalAfterStr, totalPctStr,
    ];
    const wrappedTotals = totalsCells.map((txt, i) =>
      doc.splitTextToSize(String(txt), colW[i] - 4)
    ) as string[][];
    const totalsH = Math.max(...wrappedTotals.map(w => w.length)) * lineGap + 4;

    if (y + totalsH > pageH - BOTTOM_MARGIN) y = startNewTablePage();

    // darker grey for totals row
    colW.forEach((w, i) => doc.setFillColor(208, 206, 206).rect(colX[i], y, w, totalsH, "F"));

    wrappedTotals.forEach((lines, colIdx) => {
      const cx = colX[colIdx] + colW[colIdx] / 2;
      lines.forEach((ln: string, li: number) => {
        // colour the P&L cell red/green like other rows
        if (colIdx === 6) {
          const clean = ln.replace(/[\s\u00A0]/g, "");
          if (/^-/.test(clean))      doc.setTextColor(192, 0, 0);
          else if (/^\+|\d/.test(clean)) doc.setTextColor(0, 192, 0);
          else                       doc.setTextColor(0, 0, 0);
        } else {
          doc.setTextColor(0);
        }
        doc.text(ln, cx, y + 8 + li * lineGap, { align: "center" });
      });
    });

    y += totalsH + TABLE_GAP;
    
  /* ============ Page 4 – Dividend‑history table (3 columns) =============== */
  if (data.dividendRows && data.dividendRows.length) {
    /* ① group rows by 產品名稱(開放式基金) */
    const grouped = new Map();
    data.dividendRows.forEach(r => {
      if (!grouped.has(r.fund_category)) grouped.set(r.fund_category, { dates: [], amts: [] });
      const g = grouped.get(r.fund_category);
      g.dates.unshift(fmtYYYYMM(r.paid_date));     // newest‑first for readability
      g.amts .unshift(fmtMoney(r.amount));
    });

    /* ② geometry helpers */
    const divColW = [120, 90, 90];                     // widths
    const divColX = [tableX, tableX + divColW[0] + TABLE_GAP, tableX + divColW[0] + divColW[1] + 2*TABLE_GAP];

    const drawDivHeader = () => {
      doc.setFillColor(208,206,206);
      divColW.forEach((w,i) => doc.rect(divColX[i], y, w, headerH, "F"));
      doc.setFontSize(14).setTextColor(0);
      ["產品名稱(開放式基金)", "派息時間", "派息金額"].forEach((t,i)=>
        doc.text(t, divColX[i] + divColW[i]/2, y + headerH/2, { align:"center", baseline:"middle" })
      );
      y += headerH + TABLE_GAP;
    };

    const CAP_LINES = Math.floor((pageH - TOP_MARGIN - BOTTOM_MARGIN - 4) / lineGap) - 2; // max text‑lines / page

    y = 0;                         // force lazy creation of first page
    let zebra = 0;

    grouped.forEach(({ dates, amts }, fund) => {
      let offset = 0;
      let firstRowOnPage = true;   // reset on *every* physical page

      while (offset < dates.length) {
        /* how many date/amount lines fit in this row */
        const take = Math.min(CAP_LINES, dates.length - offset);
        const chunkDates = dates.slice(offset, offset + take);
        const chunkAmts  = amts .slice(offset, offset + take);

        // estimate row height (needs wrapped text height)
        const hDates = doc.splitTextToSize(chunkDates.join("\n"), divColW[1]-4).length;
        const hAmts  = doc.splitTextToSize(chunkAmts .join("\n"), divColW[2]-4).length;
        const rowH   = Math.max(hDates, hAmts, 1) * lineGap + 4;

        /* page break BEFORE we decide whether to print fund name */
        if (y === 0 || y + rowH > pageH - BOTTOM_MARGIN) {
          y = startNewDivTablePage();
          drawDivHeader();
          firstRowOnPage = true;   // we are top‑of‑page now
        }

        /* show fund name if: (a) first logical chunk *or* (b) first row on THIS physical page */
        const chunkFund = (offset === 0 || firstRowOnPage) ? fund : "";

        const wrapped = [
          doc.splitTextToSize(chunkFund,            divColW[0]-4),
          doc.splitTextToSize(chunkDates.join("\n"), divColW[1]-4),
          doc.splitTextToSize(chunkAmts .join("\n"), divColW[2]-4),
        ];

        const realRowH = Math.max(...wrapped.map(w => w.length)) * lineGap + 4; // (may equal rowH)

        /* zebra fill + draw text */
        const bg = zebra % 2 ? [217,217,217] : [232,232,232];
        divColW.forEach((w,i) => {
          doc.setFillColor(bg[0], bg[1], bg[2]).rect(divColX[i], y, w, realRowH, "F");
          wrapped[i].forEach((ln: string, li: number) =>
            doc.text(ln, divColX[i] + w/2, y + 8 + li*lineGap, { align:"center" })
          );
        });

        /* advance */
        y += realRowH + TABLE_GAP;
        zebra += 1;
        offset += take;
        firstRowOnPage = false;    // subsequent rows on same page
      }
    });
  }

  /* ============ Page 4 – Disclaimer ============================== */
  doc.addPage();
  doc.addImage(bg, "PNG", 0, 0, pageW, pageH);
  doc.addImage(logoDisc, "PNG", 238, 14.7, 83.5, 29.6);

  doc.setFont("helvetica").setFontSize(15).setTextColor(255);
  const disclaimer =
    "Disclaimer: This document is confidential and is intended solely for its recipient(s) only. Any unauthorized use of the contents is expressly prohibited. If you are not the intended recipient, you are hereby notified that any use, distribution, disclosure, dissemination or copying of this document is strictly prohibited. Annum Capital, its group companies, subsidiaries and affiliates and their content provider(s) shall not be responsible for the accuracy or completeness of this document or information herein. This document is for information purpose only. It is not intended as an offer or solicitation for the purchase or sale of any financial instrument or as an official confirmation of any transaction. All data and other information are not warranted as to completeness or accuracy and subject to change without notice. Liabilities for any damaged caused by this document will not be accepted.";
  doc.text(doc.splitTextToSize(disclaimer, 227.2), 53.3, 71.7);

  const investorSlug = canonicalName.replace(/\s+/g, "_"); 
  const yyyymm       = data.reportDate.substring(0, 7).replace("-", "");
  doc.save(`${nameInitials}_存續報告_${yyyymm}.pdf`);
}
