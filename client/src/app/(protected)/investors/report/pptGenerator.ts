// pptGenerator.ts – build a 3-slide PowerPoint that mirrors the PDF report
// ------------------------------------------------------------
//  deps:  pptxgenjs 3.x   (npm i pptxgenjs)
// ------------------------------------------------------------

import PptxGenJS from "pptxgenjs";

declare module "pptxgenjs" {
  interface TableOptions {
    autoPageSlideCallback?: (slide: PptxGenJS.Slide, idx: number) => void;
    autoPageSlideMaster?: string;
  }

  interface Presentation {
    slides: PptxGenJS.Slide[];
  }
}


/* ---------- data models ------------------------------------ */
interface TableRowData {
  productName:          string;
  subscriptionTime:     string;
  dataDeadline:         string;
  subscriptionAmount:   string;
  marketValue:          string;
  totalAfterDeduction:  string;
  estimatedProfit:      string;
}

interface ReportData {
  investor:                 string;
  reportDate:               string;          // YYYY-MM-DD
  tableData:                TableRowData[];
  totalSubscriptionAmount:  string;
  totalMarketValue:         string;
  totalAfterDeduction:      string;
  totalProfit:              string;
}

/* ---------- helper type for table cells -------------------- */
type CellOpts = {
  color?: string;
  bold?: boolean;
  align?: "left" | "center" | "right";
  fill?: string;             // ← NEW: background-fill colour
};

type StyledCell = {
  text: string | number;
  options?: 
  CellOpts & {
    color?: string;
    bold?: boolean;
    align?: "left" | "center" | "right";   // <- added so {align:"center"} is legal
  };
};

/* ---------- util fns --------------------------------------- */
const fmtYYYYMM = (s: string) => {
  const d = new Date(s);
  return isNaN(d.getTime())
    ? s
    : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const to2dp    = (s: string) => {
  const n = Number(s.replace(/,/g, ""));
  return isNaN(n) ? s : n.toFixed(2);
};
const fmtMoney = (v: string) => {
  const n = Number(v.replace(/,/g, ""));
  return !Number.isFinite(n) || n === 0
    ? ""
    : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtPercent = (v: string | undefined) => v && v.trim() !== "" ? `${v}%` : "";

function profitCell(raw: string | undefined): StyledCell {
  const pct = (raw ?? "").trim();
  const num = parseFloat(pct.replace(/[+,％%]/g, ""));   // strip sign/% then cast
  if (Number.isFinite(num) && num > 0) {
    return {
      text: `+${fmtPercent(pct)}`,              // prepend “+”
      options: { color: "C00000", bold: true }, // bright-red & bold
    };
  }
  return { text: fmtPercent(pct) };             // leave ≤0 / blank unchanged
}

/* ---------- cached fetch → base-64 helpers ----------------- */
async function fetchAsDataURL(path: string, cacheKey: string): Promise<string> {
  const m = fetchAsDataURL as any;
  if (m[cacheKey]) return m[cacheKey];

  const blob = await fetch(path).then(r => r.blob());
  const dataUrl: string = await new Promise((ok, err) => {
    const fr = new FileReader();
    fr.onload  = () => ok(fr.result as string);
    fr.onerror = err;
    fr.readAsDataURL(blob);
  });
  m[cacheKey] = dataUrl;
  return dataUrl;
}

/* ──────────────────────────────────────────────────────────────
 * Helper that decorates ONE slide with editable header / footer
 * ────────────────────────────────────────────────────────────── */
function decorateTableSlide(slide: PptxGenJS.Slide, logoData: string) {
  slide.addText("已投資產品總結", { x:0.4, y:0.3, w:"50%", h:0.5, fontFace:"DengXian", fontSize:24, bold:true });
  slide.addImage({ data: logoData, x:8.0, y:0.0, w:2.0, h:0.85 });
  slide.addText("存續報告僅供內部參考使用投資人實際數字以月結單為准", { x:0.4, y:4.95, w:"50%", h:0.35, fontFace:"DengXian", fontSize:7 });
}


/* ---------- static assets ---------------------------------- */
const getCoverImg       = () => fetchAsDataURL("/cover-bg.png",            "cover");
const getLogoCoverImg   = () => fetchAsDataURL("/logo-white-cover.png",    "logoCover");
const getLogoTableBlack = () => fetchAsDataURL("/logo-black-table.png",    "logoTable");
const getLogoDisclaimer = () => fetchAsDataURL("/logo-white-disclaimer.png","logoDisc");

/* ---------- optional API call ------------------------------ */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5103";
async function fetchFormattedName(name: string): Promise<string> {
  const r = await fetch(
    `${API_BASE}/investors/format-name?name=${encodeURIComponent(name.trim())}`,
    { credentials: "include" },
  );
  if (!r.ok) throw new Error(`format-name ${r.status}`);
  return (await r.text()).trim();
}

/* ============================================================
                      MAIN – build the deck
   ============================================================ */
export async function generateInvestmentPpt(data: ReportData) {
  /* 1. meta --------------------------------------------------- */
  const canonicalName = await fetchFormattedName(data.investor);
  const initials      = canonicalName.trim().split(/\s+/).map(w => w[0].toUpperCase()).join("");
  const prettyDate    = new Date(`${data.reportDate}T00:00:00Z`)
                          .toLocaleString("en", { timeZone:"UTC", month:"short", year:"numeric" })
                          .replace(" ", " - ");

  const pptx = new PptxGenJS();
  pptx.author  = "Fund Pilot";
  pptx.company = "Annum Capital";
  pptx.subject = "存續報告";
  pptx.title   = `${initials} 存續報告 ${prettyDate}`;

  /* 2. assets ------------------------------------------------- */
  const [bgCover, logoCover, logoTable, logoDisc] =
    await Promise.all([getCoverImg(), getLogoCoverImg(),
                       getLogoTableBlack(), getLogoDisclaimer()]);

  /* 3. cover slide ------------------------------------------- */
  {
    const slide = pptx.addSlide();
    slide.background = { data: bgCover };

    slide.addImage({ data: logoCover, x:0.803, y:0.645, w:3.113, h:1.1 });

    slide.addText(`${initials} 存續報告`, {
      x:0, y:2.2, w:"100%", h:0.8, align:"center",
      fontSize:24, bold:true, color:"FFFFFF", fontFace:"DengXian",
    });

    slide.addText(prettyDate, {
      x:0, y:3.4, w:"100%", h:0.4, align:"center",
      fontSize:14, color:"FFFFFF", fontFace:"Montserrat",
    });

    slide.addText("存續報告僅供內部參考使用 投資人實際數字以月結單為准", {
      x:0, y:3.8, w:"100%", h:0.4, align:"center",
      fontSize:14, color:"FFFFFF", fontFace:"DengXian",
    });
  }

  /* 4. helper that lays the table, then decorates every slide ---- */
  function addPaginatedTable(
    pptx: PptxGenJS,
    rows: (string | number | StyledCell)[][],
    logoData: string
  ) {
    // remember where the slide list starts
    const firstSlideIndex = (pptx as any).slides.length;

    // ---------- 1️⃣  draw the (possibly long) table -------------
    const first = pptx.addSlide();

    first.addTable(rows as any, {
      x: 0.45,
      y: 0.75,
      h: 4.8,                              // 0.75 ➜ 5.55 keeps footer clear
      colW: [2.4, 0.8, 0.8, 1.2, 1.2, 1.2, 1.3],

      fontSize: 10,
      fontFace: "DengXian",
      align: "center",
      valign: "middle",
      rowH: 0.32,
      fill: "E8E8E8",
      margin: 0.03,
      border: { pt: 1, color: "FFFFFF" },

      headerRow: true,
      columnHeaderBold: true,
      columnHeaderFill: "D0CECE",
      color: "000000",

      // table slide background formatting
      autoPage: true,
      autoPageRepeatHeader: true,
      autoPageSlideStartY: 0.75,
    } as any);

    // ---------- 2️⃣  walk every slide we just created ------------
    for (let i = firstSlideIndex; i < (pptx as any).slides.length; i++) {
      decorateTableSlide((pptx as any).slides[i], logoData);
    }
  }

  /* 5. build the rows and call the helper ----------------------- */
  {
    const headerRow: StyledCell[] = [
      { text: "產品名稱(開放式基金)", options: { bold: true, fill: "D0CECE" } },
      { text: "認購時間",              options: { bold: true, fill: "D0CECE" } },
      { text: "數據截止",              options: { bold: true, fill: "D0CECE" } },
      { text: "認購金額(USD)",         options: { bold: true, fill: "D0CECE" } },
      { text: "市值",                  options: { bold: true, fill: "D0CECE" } },
      { text: "含息後總額",            options: { bold: true, fill: "D0CECE" } },
      { text: "估派息後盈虧(%)",       options: { bold: true, fill: "D0CECE" } },
    ];

    const allRows: (string | number | StyledCell)[][] = [headerRow];
    data.tableData.forEach(r => {
      allRows.push([
        r.productName ?? "",
        fmtYYYYMM(r.subscriptionTime),
        fmtYYYYMM(r.dataDeadline),
        fmtMoney(r.subscriptionAmount),
        fmtMoney(r.marketValue),
        fmtMoney(to2dp(r.totalAfterDeduction)),
        profitCell(r.estimatedProfit),
      ]);
    });

    // single call – pptxgenjs paginates, we overlay afterwards
    addPaginatedTable(pptx, allRows, logoTable);
  }


  /* 6. disclaimer -------------------------------------------- */
  {
    const slide = pptx.addSlide();
    slide.background = { data:bgCover };
    slide.addImage({ data:logoDisc, x:7.2, y:0.4, w:2.43, h:0.9 }); // w:h = 2.7:1

    const disclaimer =
      "Disclaimer: This document is confidential and is intended solely for its recipient(s) only. Any unauthorized use of the contents is expressly prohibited. If you are not the intended recipient, you are hereby notified that any use, distribution, disclosure, dissemination or copying of this document is strictly prohibited. Annum Capital, its group companies, subsidiaries and affiliates and their content provider(s) shall not be responsible for the accuracy or completeness of this document or information herein. This document is for information purpose only. It is not intended as an offer or solicitation for the purchase or sale of any financial instrument or as an official confirmation of any transaction. All data and other information are not warranted as to completeness or accuracy and subject to change without notice. Liabilities for any damaged caused by this document will not be accepted.";

    slide.addText(disclaimer, {
      x:1.5, y:2.3, w:6.9, h:1.5,
      align:"left", fontSize:8, fontFace:"Montserrat",
      color:"FFFFFF", lineSpacingMultiple:1.2,
    });
  }

  /* 7. write file -------------------------------------------- */
  const yyyymm = data.reportDate.substring(0,7).replace("-","");
  await pptx.writeFile({ fileName:`${initials}_存續報告_${yyyymm}.pptx` });
}
