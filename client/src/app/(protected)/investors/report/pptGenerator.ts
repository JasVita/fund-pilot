// pptGenerator.ts – build a 3-slide PowerPoint that mirrors the PDF report
// ------------------------------------------------------------
//  deps:  pptxgenjs 3.x   (npm i pptxgenjs)
// ------------------------------------------------------------

import PptxGenJS from "pptxgenjs";

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
type StyledCell = {
  text: string | number;
  options?: {
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

  /* 4. master for table pages -------------------------------- */
  pptx.defineSlideMaster({
    title: "TableMaster",
    background: { color:"FFFFFF" },
    objects: [
      { text:{
          text:"已投資產品總結",
          options:{ x:0.4, y:0.3, w:"50%", h:0.5, fontSize:24, bold:true, fontFace:"DengXian" },
        }},
      { image:{ data:logoTable, x:8.0, y:0.0, w:2.0, h:0.85 } },
      { text:{
          text:"存續報告僅供內部參考使用 投資人實際數字以月結單為准",
          options:{ x:0.4, y:4.9, w:"30%", h:0.4, fontSize:7, fontFace:"DengXian" },
        }},
    ],
  });

  /* 5. table slide(s) ---------------------------------------- */
  {
    const slide = pptx.addSlide({ masterName:"TableMaster" });

    /* column headers (7 cols) */
    const headerRow: StyledCell[] = [
      { text:"產品名稱(開放式基金)", options:{ bold:true } },
      { text:"認購時間",              options:{ bold:true } },
      { text:"數據截止",              options:{ bold:true } },
      { text:"認購金額(USD)",         options:{ bold:true } },
      { text:"市值",                  options:{ bold:true } },
      { text:"含息後總額",            options:{ bold:true } },
      { text:"估派息後盈虧(%)",       options:{ bold:true } },
    ];

    const rows: (string | number | StyledCell)[][] = [headerRow];
    
    data.tableData.forEach(r => {
      rows.push([
        r.productName ?? "",
        fmtYYYYMM(r.subscriptionTime),
        fmtYYYYMM(r.dataDeadline),
        fmtMoney(r.subscriptionAmount),
        fmtMoney(r.marketValue),
        fmtMoney(to2dp(r.totalAfterDeduction)),
        { text: fmtPercent(r.estimatedProfit), options: { color: "C00000", bold: true } },
      ]);
    });

    slide.addTable(rows as any, {
        /* position */
        x: 0.4,
        y: 0.75,
        /* give the table a max height — everything that doesn’t fit
            within these 4.6 inches will be pushed to a fresh slide */
        h: 5.0,              // ←  adjust to whatever margin you want
        colW: [2.4, 0.8, 0.8, 1.2, 1.2, 1.2, 1.3],

        /* cell defaults */
        fontSize: 10,
        fontFace: "DengXian",
        align: "center",
        valign: "middle",
        rowH: 0.32,
        fill: "F2F2F2",
        margin: 0.03,
        border: { pt: 1, color: "FFFFFF" },

        /* paging rules */
        autoPage: true,
        autoPageSlideStartY: 0.75,   // top boundary
        autoPageSlideEndY: 5.55,     // bottom boundary of each slide (≈¼-inch margin)
        autoPageMaster: "TableMaster",
        autoPageRepeatHeader: true,  // repeat header row
        rowHeader: true,             // repeat the *left* column (fund name) too

        /* header styling */
        headerRow: true,
        columnHeaderBold: true,
        columnHeaderFill: "D0CECE",
        color: "000000",
        } as any);

  }

  /* 6. disclaimer -------------------------------------------- */
  {
    const slide = pptx.addSlide();
    slide.background = { data:bgCover };
    slide.addImage({ data:logoDisc, x:7.2, y:0.4, w:2.16, h:0.8 });

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
