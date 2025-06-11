import jsPDF from "jspdf";

interface ReportData {
  investor: string;
  reportDate: string;
  tableData: {
    productName: string;
    subscriptionTime: string;  // may contain "\n"-separated dates
    dataDeadline: string;      // idem
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

/* ------------------------------------------------------------------ */
/* helpers to load /public images and memoise them                    */
async function loadImg(path: string, cacheKey: string): Promise<string> {
  const anyFn = loadImg as any;
  if (anyFn[cacheKey]) return anyFn[cacheKey];

  const blob = await fetch(path).then((r) => r.blob());
  const dataUrl: string = await new Promise((ok, err) => {
    const fr = new FileReader();
    fr.onload = () => ok(fr.result as string);
    fr.onerror = err;
    fr.readAsDataURL(blob);
  });
  anyFn[cacheKey] = dataUrl;
  return dataUrl;
}
const getCoverImg = () => loadImg("/cover-bg.png", "cover");
const getLogoImg  = () => loadImg("/logo-white-cover.png", "logo");
const getLogoTableImg     = () => loadImg("/logo-white-table.png", "logoTable");
const getLogoDisclaimerImg= () => loadImg("/logo-white-disclaimer.png", "logoDisc");

const fmtYYYYMM = (s: string) => {
  const d = new Date(s);
  return isNaN(d.getTime())
    ? s
    : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const to2dp = (s: string) => {
  const n = Number(String(s).replace(/,/g, ""));
  return isNaN(n) ? s : n.toFixed(2);
};

/* ---------- load & register a CJK font ----------------------- */
async function ensureCJK(pdf: jsPDF) {
  const key = "_cjkLoaded";
  if ((ensureCJK as any)[key]) return; // already done

  const fontDataUrl = await loadImg(
    "/fonts/NotoSansSC-Regular.otf",
    "fontCJK"
  );
  const base64 = fontDataUrl.split(",")[1]; // strip data-url prefix
  (pdf as any).addFileToVFS("NotoSansSC.otf", base64);
  (pdf as any).addFont("NotoSansSC.otf", "NotoSansSC", "normal");

  (ensureCJK as any)[key] = true;
}

/* main PDF builder                                                   */
export const generateInvestmentReport = async (
  data: ReportData
): Promise<void> => {
  /* A4 landscape but scaled to 4000:2259 aspect ------------------- */
  const aspect = 4000 / 2259;
  const pageH = 210;            // mm
  const pageW = pageH * aspect; // ≈ 372 mm

  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: [pageW, pageH],
  });

  /* ============ Page 1 • COVER =================================== */
  const bg   = await getCoverImg();
  const logo = await getLogoImg();

  pdf.addImage(bg, "PNG", 0, 0, pageW, pageH);

  /* place logo image: 2.04 cm left, 1.64 cm top, 12.92 cm × 4.58 cm */
  const logoX = 20.4;  // mm
  const logoY = 16.4;  // mm
  const logoW = 129.2; // mm
  const logoH = 45.8;  // mm
  pdf.addImage(logo, "PNG", logoX, logoY, logoW, logoH);

  /* main title */
  pdf.setFont("helvetica", "bold").setFontSize(26).setTextColor(255, 255, 255);
  const title = `${data.investor} Investment Report`;
  pdf.text(title, (pageW - pdf.getTextWidth(title)) / 2, pageH / 2 - 20);

  /* date */
  pdf.setFont("helvetica", "normal").setFontSize(16);
  pdf.text(
    data.reportDate,
    (pageW - pdf.getTextWidth(data.reportDate)) / 2,
    pageH / 2 + 10
  );

  /* subtitle */
  const subtitle = "This report is for internal use only. Official figures are provided in monthly statements.";
  pdf.text(
    subtitle,
    (pageW - pdf.getTextWidth(subtitle)) / 2,
    pageH / 2 + 30
  );

  /* ============ Page 2 • TABLE ================================== */
  pdf.addPage();
  pdf.addImage(bg, "PNG", 0, 0, pageW, pageH);

  const logo2 = await getLogoTableImg();
  pdf.addImage(logo2, "PNG", 238, 14.7, 83.5, 29.6);

  pdf
    .setFont("helvetica", "bold")
    .setFontSize(28)
    .setTextColor(255, 255, 255);
  pdf.text("Investment Summary", 30, 40);

  /* --- table geometry ------------------------------------------- */
  const tableX = 30;          // left margin
  const tableW = 310;         // fixed width
  const colW   = [73, 32, 32, 41, 41, 41, 50]; // sum = 310
  const headerH   = 25;
  const lineGap   = 6;        // baseline distance
  let   y         = 55;

  /* header row ---------------------------------------------------- */
  const headers = [
    "Product Name \n(Open-end Fund)",
    "Subscription \nTime",
    "Data \nDeadline",
    "Subscription \nAmount (USD)",
    "Market Value",
    "Total \nAfter Interest",
    "Estimated \nProfit (%)",
  ];

  pdf.setFillColor(0, 0, 0, 0.9).rect(tableX, y, tableW, headerH, "F");
  pdf.setFontSize(14);

  let x = tableX;
  headers.forEach((h, i) => {
    pdf.text(h, x + 3, y + 10);
    x += colW[i];
  });
  y += headerH;
  pdf.setFont("helvetica", "normal");

  /* body rows ----------------------------------------------------- */
  /* rows */
  data.tableData.forEach((row, idx) => {
    const cells = [
      row.productName,
      row.subscriptionTime.split("\n").map(fmtYYYYMM).join("\n"),
      row.dataDeadline.split("\n").map(fmtYYYYMM).join("\n"),
      row.subscriptionAmount,
      row.marketValue,
      row.totalAfterDeduction
        .split("\n")
        .map(to2dp)
        .join("\n"),
      row.estimatedProfit,
    ];

    /* wrap each cell */
    const wrapped: string[][] = cells.map((cell, i) =>
      pdf.splitTextToSize(cell, colW[i] - 4) as string[]
    );
    const linesInRow = Math.max(...wrapped.map((w) => w.length));
    const rowH = linesInRow * lineGap + 4; // + padding

    /* background stripe */
    if (idx % 2 === 0) {
      pdf.setFillColor(0, 0, 0, 0.7).rect(tableX, y, tableW, rowH, "F");
    }

    /* text */
    x = tableX;
    wrapped.forEach((lines, i) => {
      lines.forEach((ln, li) => {
        if (i === 6) {
          ln.trimStart().startsWith("+")
            ? pdf.setTextColor(0, 255, 0)
            : ln.trimStart().startsWith("-")
            ? pdf.setTextColor(255, 0, 0)
            : pdf.setTextColor(255, 255, 255);
        } else {
          pdf.setTextColor(255, 255, 255);
        }
        pdf.text(ln, x + 3, y + 8 + li * lineGap);
      });
      x += colW[i];
    });

    y += rowH;
  });


  /* ----- totals row (disabled) ---------------------------------- */
  /*
  y += 5;
  pdf.setFillColor(0, 0, 0, 0.9).rect(tableX, y, tableW, 18, "F");
  pdf.setFont("helvetica", "bold").setTextColor(255, 255, 255);
  x = tableX;
  [
    "Total",
    "",
    "",
    data.totalSubscriptionAmount,
    data.totalMarketValue,
    data.totalAfterDeduction,
    data.totalProfit,
  ].forEach((cell, i) => {
    if (i === 6 && cell.includes("+")) pdf.setTextColor(255, 0, 0);
    pdf.text(cell, x + 3, y + 12);
    pdf.setTextColor(255, 255, 255);
    x += colW[i];
  });
  */

  /* footer -------------------------------------------------------- */
  pdf
    .setFont("helvetica", "normal")
    .setFontSize(12)
    .setTextColor(255, 255, 255)
    .text(
      "The table contains calculated numbers; actual figures are provided in the official report.",
      30,
      pageH - 20
    );

  /* ============ Page 3 • DISCLAIMER ============================== */
  pdf.addPage();
  pdf.addImage(bg, "PNG", 0, 0, pageW, pageH);

  /* NEW logo image for slide 3 */
  const logo3 = await getLogoDisclaimerImg();
  // size: 8.35 cm × 2.96 cm, pos: 23.8 cm × 1.47 cm
  pdf.addImage(logo3, "PNG", 238, 14.7, 83.5, 29.6);

  pdf.setFont("helvetica", "normal").setFontSize(15).setTextColor(255, 255, 255);
  const disclaimer = "Disclaimer: This document is confidential and is intended solely for its recipient(s) only. Any unauthorized use of the contents is expressly prohibited. If you are not the intended recipient, you are hereby notified that any use, distribution, disclosure, dissemination or copying of this document is strictly prohibited. Annum Capital, its group companies, subsidiaries and affiliates and their content provider(s) shall not be responsible for the accuracy or completeness of this document or information herein. This document is for information purpose only. It is not intended as an offer or solicitation for the purchase or sale of any financial instrument or as an official confirmation of any transaction. All data and other information are not warranted as to completeness or accuracy and subject to change without notice. Liabilities for any damaged caused by this document will not be accepted.";

  // const lines = pdf.splitTextToSize(disclaimer, pageW - 100);
  // pdf.text(lines, 50, pageH / 2 - 40);
  /* position & box per screenshot: 5.33 cm, 7.17 cm, width 22.72 cm */
  const boxX = 53.3; // mm
  const boxY = 71.7; // mm
  const boxW = 227.2;
  const lines = pdf.splitTextToSize(disclaimer, boxW);
  pdf.text(lines, boxX, boxY);

  /* ---------------------------------------------------- */
  pdf.save(`${data.investor}_investment_report_${data.reportDate}.pdf`);
};
