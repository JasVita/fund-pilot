import { jsPDF } from "jspdf";

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

/* ---------- helpers for static images ---------------------------- */
const getCoverImg = () => fetchAsDataURL("/cover-bg.png", "cover");
const getLogoCoverImg = () => fetchAsDataURL("/logo-white-cover.png", "logoCover");
const getLogoTableBlack = () => fetchAsDataURL("/logo-black-table.png", "logoTableBlk");
const getLogoDisclaimer = () => fetchAsDataURL("/logo-white-disclaimer.png", "logoDisc");

/* ---------- helpers for numbers / dates -------------------------- */
const fmtYYYYMM = (s: string) => {
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const to2dp = (s: string) => {
  const n = Number(s.replace(/,/g, ""));
  return isNaN(n) ? s : n.toFixed(2);
};

/* ————— initials from full name ————— */
const initials = (full: string) => full.trim().split(/\s+/).map(w => w[0].toUpperCase()).join("");

/* ——— 1-comma-per-thousand, 2 dp ——— */
const fmtMoney = (v: string) => {
  const txt = v.trim();
  if (!txt) return "";                         // already blank ➜ keep blank

  const n = Number(txt.replace(/,/g, ""));
  if (!Number.isFinite(n) || n === 0) return "";   // ← NEW: hide 0 / 0.00

  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};


/* a helper for multiline cells (split on \n) */
const fmtMoneyLines = (v: string) => v.split("\n").map(fmtMoney).join("\n");

/* ---------- ZhengTiFan font loader ------------------------------ */
async function ensureZhengTiFan(doc: jsPDF) {
  const FONT_FILE = "ZhengTiFan.ttf";
  const FONT_NAME = "ZhengTiFan";
  const CACHE_KEY = "_ZhengTiFan_base64";

  let base64: string | undefined = (ensureZhengTiFan as any)[CACHE_KEY];
  if (!base64) {
    const dataUrl = await fetchAsDataURL(`/fonts/${FONT_FILE}`, CACHE_KEY);
    base64 = dataUrl.split(",")[1];
    (ensureZhengTiFan as any)[CACHE_KEY] = base64;
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
  const nameInitials = initials(data.investor);

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

  /* ============ Page 1 – Cover ================================== */
  doc.addImage(bg, "PNG", 0, 0, pageW, pageH);
  doc.addImage(logoCover, "PNG", 20.4, 16.4, 129.2, 45.8);

  // ${data.investor}存續報告
  doc.setFont("helvetica", "bold").setFontSize(26).setTextColor(255);
  
  const investorW = doc.getTextWidth(data.investor);

  doc.setFont("ZhengTiFan", "normal").setFontSize(26).setTextColor(255);
  const reportLabel = " 存續報告";
  const labelW = doc.getTextWidth(reportLabel);

  /* centre the *combined* string by drawing two slices               */
  const titleY = pageH / 2 - 20;
  const titleX = (pageW - (investorW + labelW)) / 2;

  doc.setFont("helvetica", "bold").text(data.investor, titleX, titleY);
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
    const split = (s: string) => s.split("\n");

    const cols = [
      split(r.productName),
      split(r.subscriptionTime).map(fmtYYYYMM),
      split(r.dataDeadline).map(fmtYYYYMM),
      split(fmtMoneyLines(r.subscriptionAmount)),
      split(fmtMoneyLines(r.marketValue)),
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
          fmtMoneyLines(row.subscriptionAmount),
          fmtMoneyLines(row.marketValue),
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

          lines.forEach((ln, li) => {
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


  /* ============ Page 3 – Disclaimer ============================== */
  doc.addPage();
  doc.addImage(bg, "PNG", 0, 0, pageW, pageH);
  doc.addImage(logoDisc, "PNG", 238, 14.7, 83.5, 29.6);

  doc.setFont("helvetica").setFontSize(15).setTextColor(255);
  const disclaimer =
    "Disclaimer: This document is confidential and is intended solely for its recipient(s) only. Any unauthorized use of the contents is expressly prohibited. If you are not the intended recipient, you are hereby notified that any use, distribution, disclosure, dissemination or copying of this document is strictly prohibited. Annum Capital, its group companies, subsidiaries and affiliates and their content provider(s) shall not be responsible for the accuracy or completeness of this document or information herein. This document is for information purpose only. It is not intended as an offer or solicitation for the purchase or sale of any financial instrument or as an official confirmation of any transaction. All data and other information are not warranted as to completeness or accuracy and subject to change without notice. Liabilities for any damaged caused by this document will not be accepted.";
  doc.text(doc.splitTextToSize(disclaimer, 227.2), 53.3, 71.7);

  const investorSlug = data.investor.trim().replace(/\s+/g, "_");  // "Che Xiao" → "Che_Xiao"
  const yyyymm = data.reportDate.substring(0, 7).replace("-", "");  // "2025-06-17" → "202506"
  doc.save(`${investorSlug}_存續報告_${yyyymm}.pdf`);
}
