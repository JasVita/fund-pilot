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
    fr.onload  = () => ok(fr.result as string);
    fr.onerror = err;
    fr.readAsDataURL(blob);
  });
  return (anyFn[key] = dataUrl);
}

/* ---------- helpers for static images ---------------------------- */
const getCoverImg          = () => fetchAsDataURL("/cover-bg.png",           "cover");
const getLogoImg           = () => fetchAsDataURL("/logo-white-cover.png",   "logo1");
const getBlackLogoTableImg = () => fetchAsDataURL("/logo-black-table.png",   "logo2");
const getLogoTableImg      = () => fetchAsDataURL("/logo-white-table.png",   "logoT");
const getLogoDiscImg       = () => fetchAsDataURL("/logo-white-disclaimer.png","logoD");

/* ---------- helpers for numbers / dates -------------------------- */
const fmtYYYYMM = (s: string) => {
  const d = new Date(s);
  return isNaN(d.getTime()) ? s
         : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const to2dp = (s: string) => {
  const n = Number(s.replace(/,/g, ""));
  return isNaN(n) ? s : n.toFixed(2);
};

/* ————— initials from full name ————— */
const initials = (full: string) =>
  full.trim().split(/\s+/).map(w => w[0].toUpperCase()).join("");

/* ————— 1-comma-per-thousand, 2 dp ————— */
const fmtMoney = (v: string) => {
  const n = Number(String(v).replace(/,/g, ""));
  return isNaN(n)
    ? v
    : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/* a helper for multiline cells (split on \n) */
const fmtMoneyLines = (v: string) => v.split("\n").map(fmtMoney).join("\n");

/* ---------- load & register NotoSans font (once) ------------------- */
async function ensureZhengTiFan(doc: jsPDF) {
  const FLAG = "_zhengTiFanLoaded";
  if ((ensureZhengTiFan as any)[FLAG]) return;

  const dataUrl = await fetchAsDataURL("/fonts/ZhengTiFan.ttf", "zhengTiFan");
  const base64  = dataUrl.split(",")[1];                // strip the prefix

  (doc as any).addFileToVFS("ZhengTiFan.ttf", base64);
  (doc as any).addFont("ZhengTiFan.ttf", "ZhengTiFan", "normal");

  console.log("[FontList]", doc.getFontList());         // optional debug
  (ensureZhengTiFan as any)[FLAG] = true;
}

/* ---------- main builder ----------------------------------------- */
export async function generateInvestmentReport(data: ReportData) {
  const nameInitials = initials(data.investor);

  /* ---------- page geometry (A4 landscape) ----------------------- */
  const pageH = 210;                       // mm
  const pageW = (4000 / 2259) * pageH;     // ≈ 372 mm
  const doc   = new jsPDF({ orientation: "landscape",
                            unit: "mm", format: [pageW, pageH] });

  await ensureZhengTiFan(doc);

  const [bg, logo1, logo2, logo3, logo4] = await Promise.all([
    getCoverImg(), getLogoImg(), getLogoTableImg(), getLogoDiscImg(), getBlackLogoTableImg()
  ]);

  /* ============ Page 1 – Cover ================================== */
  doc.addImage(bg,    "PNG", 0, 0, pageW, pageH);
  doc.addImage(logo1, "PNG", 20.4, 16.4, 129.2, 45.8);

  // ${data.investor}存續報告
  doc.setFont("helvetica", "bold").setFontSize(26).setTextColor(255);
  const investorW   = doc.getTextWidth(nameInitials);

  doc.setFont("ZhengTiFan", "normal").setFontSize(26).setTextColor(255);
  const reportLabel = " 存續報告"; 
  const labelW      = doc.getTextWidth(reportLabel);

  /* centre the *combined* string by drawing two slices               */
  const titleY  = pageH / 2 - 20;
  const titleX  = (pageW - (investorW + labelW)) / 2;

  doc.setFont("helvetica", "bold").text(nameInitials, titleX, titleY);
  doc.setFont("ZhengTiFan", "normal").text(reportLabel, titleX + investorW, titleY);
  
  // ${data.reportDate}
  doc.setFont("helvetica", "normal").setFontSize(16).setTextColor(255);
  doc.text(data.reportDate, (pageW - doc.getTextWidth(data.reportDate)) / 2, pageH / 2 + 10);
  
  doc.setFont("ZhengTiFan", "normal").setFontSize(16).setTextColor(255);
  const subtitle = "表格為計算數位，實際數位以正式報告為主";
  doc.text(subtitle, (pageW - doc.getTextWidth(subtitle)) / 2, pageH / 2 + 30);

  /* ============ Page 2 – Table ================================== */
  doc.addPage();
  // doc.addImage(bg, "PNG", 0, 0, pageW, pageH);
  doc.addImage(logo4, "PNG", 280, 12, 70, 29.6);

  doc.setFont("ZhengTiFan", "normal").setFontSize(28).setTextColor(0); // black
  doc.text("已投資產品總結", 30, 40);

  /* table geometry */
  const TABLE_GAP  = 0.5; 
  const tableX  = 30;
  // const tableW  = 310;
  const colW    = [73, 32, 32, 41, 41, 41, 50];
  const headerH = 25;
  const lineGap = 6;
  const colX: number[] = [];
  let   cursor = tableX;
  colW.forEach(w => {
    colX.push(cursor);
    cursor += w + TABLE_GAP;
  });

  const tableW = cursor - tableX - TABLE_GAP;   // effective width

  
  /* ---------- header row (ZhengTiFan only here) ---------------------- */
  let y = 55;
  
  // doc.setFillColor(208, 206, 206).rect(tableX, y, tableW, headerH, "F");
  
  colW.forEach((w, i) => {
    doc.setFillColor(208, 206, 206).rect(colX[i], y, w, headerH, "F");  
  });
  doc.setFont("ZhengTiFan", "normal").setFontSize(14).setTextColor(0); // black

  const headers = [
    "產品名稱\n(開放式基金)",
    "認購時間",
    "數據截止",
    "認購金額\n(USD)",
    "市值",
    "含息後總額",
    "估派息後盈虧(%)"
  ];
  // let x = tableX;
  headers.forEach((h, i) => {
    const cx = colX[i] + colW[i] / 2;  
    // doc.text(h, colX[i] + 3, y + 10);        // +3 mm left-padding
    doc.text(h, cx, y + headerH / 2, { align: "center", baseline: "middle" });
  });
  y += headerH + TABLE_GAP;  

  /* ---- switch back to Helvetica for the rest ------------------- */
  doc.setFont("helvetica", "normal").setTextColor(0);

  /* ---------- body rows ----------------------------------------- */
  for (const [idx, row] of data.tableData.entries()) {
    const cells = [
      row.productName,
      row.subscriptionTime.split("\n").map(fmtYYYYMM).join("\n"),
      row.dataDeadline.split("\n").map(fmtYYYYMM).join("\n"),
      fmtMoneyLines(row.subscriptionAmount), // row.subscriptionAmount,
      fmtMoneyLines(row.marketValue),  // row.marketValue,
      fmtMoneyLines(row.totalAfterDeduction.split("\n").map(to2dp).join("\n")),
      row.estimatedProfit
    ];

    /* wrap text */
    const wrapped = cells.map((cell, i) =>
      doc.splitTextToSize(
        i === 0 ? cell.replace(/(.{1,20})/g, "$1\n") : cell,
        colW[i] - 4
      ) as string[]
    );

    const rowH = Math.max(...wrapped.map(w => w.length)) * lineGap + 4;

    /* background stripe per column (so the 1 mm gaps stay blank) */
    const bg = idx % 2 ? [217, 217, 217] : [232, 232, 232];
    colW.forEach((w, i) =>
      doc.setFillColor(bg[0], bg[1], bg[2]).rect(colX[i], y, w, rowH, "F")
    );

    /* write the cells */
    wrapped.forEach((lines, colIdx) => {
      // const cellX = colX[colIdx];                 // ← use pre-computed x
      const cx   = colX[colIdx] + colW[colIdx] / 2; 
      lines.forEach((ln, li) => {
        if (colIdx === 6) {                       // profit-% colouring
          const t = ln.trimStart();
          doc.setTextColor(
            t.startsWith("+") ? 0   : t.startsWith("-") ? 192 : 0,
            t.startsWith("+") ? 192 : t.startsWith("-") ? 0   : 0,
            0
          );
        } else {
          doc.setTextColor(0);
        }
        // doc.text(ln, cellX + 3, y + 8 + li * lineGap);
        const lineY = y + 8 + li * lineGap;  
        doc.text(ln, cx, lineY, { align: "center" });
      });
    });

    y += rowH + TABLE_GAP;
  }

  /* ---------- footer -------------------------------------------- */
  doc.setFont("ZhengTiFan", "normal").setFontSize(12).setTextColor(0);
  doc.text(
    "存續報告僅供內部參考使用 投資人實際數字以月結單為准",
    30, pageH - 20
  );

  /* ============ Page 3 – Disclaimer ============================== */
  doc.addPage();
  doc.addImage(bg, "PNG", 0, 0, pageW, pageH);
  doc.addImage(logo3, "PNG", 238, 14.7, 83.5, 29.6);

  doc.setFont("helvetica").setFontSize(15).setTextColor(255);
  const disclaimer =
    "Disclaimer: This document is confidential and is intended solely for its recipient(s) only. Any unauthorized use of the contents is expressly prohibited. If you are not the intended recipient, you are hereby notified that any use, distribution, disclosure, dissemination or copying of this document is strictly prohibited. Annum Capital, its group companies, subsidiaries and affiliates and their content provider(s) shall not be responsible for the accuracy or completeness of this document or information herein. This document is for information purpose only. It is not intended as an offer or solicitation for the purchase or sale of any financial instrument or as an official confirmation of any transaction. All data and other information are not warranted as to completeness or accuracy and subject to change without notice. Liabilities for any damaged caused by this document will not be accepted.";
  doc.text(doc.splitTextToSize(disclaimer, 227.2), 53.3, 71.7);

  const yyyymm = data.reportDate.substring(0, 7).replace("-", "");  // "2025-06-17" → "202506"
  doc.save(`${nameInitials}_存續報告_${yyyymm}.pdf`);
}
