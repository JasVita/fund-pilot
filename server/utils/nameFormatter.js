/* eslint-disable @typescript-eslint/require-await */

const OpenAI = require("openai");
const openai = new OpenAI();               // uses OPENAI_API_KEY

/* ────────────────────────────────────────────────────────────── *
 * 1.  SURNAME LIST                                               *
 *    - duplicates OK (Set dedups); extend as needed              *
 * ────────────────────────────────────────────────────────────── */
const CN_SURNAMES = new Set([
  "Li","Wang","Zhang","Liu","Chen","Yang","Zhao","Huang","Zhou","Wu",
  "Xu","Sun","Ma","Zhu","Hu","Guo","He","Gao","Lin","Luo",
  "Zheng","Xie","Ye","Deng","Fang","Wei","Cao","Peng","Jiang","Qian",
  "Pan","Xiang","Xiong","Shi","Tan","Han","Yuan","Yao","Tong","Meng",
  "Pei","Hong","Kong","Lai","Cui","Duan","Bai","Mo","Rao","Shen",
  "Song","Tian","Su","Fan","Cheng"            // extras
]);

/* company key-words → treat as non-personal */
const COMPANY_HINTS = /\b(Ltd|Limited|Inc|Company|Holding(?:s)?|Fund)\b/i;

/* ──────────────────  helpers  ────────────────── */
const cap = w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

/* split Chaohua → [Chao, Hua] but leave Liang intact */
function splitCamel(word) {
  const m = word.slice(1).match(/[A-Z]/);
  if (!m || m.index == null) return [word];
  const idx = m.index + 1;
  return [word.slice(0, idx), word.slice(idx)];
}

/* final clean-up for any candidate name */
function normalise(raw) {
  if (COMPANY_HINTS.test(raw)) return raw.trim();     // company → return

  let tokens = raw.trim().split(/\s+/);

  /* put first recognised surname at the front */
  const sIdx = tokens.findIndex(t => CN_SURNAMES.has(t));
  if (sIdx > 0) {
    const [s] = tokens.splice(sIdx, 1);
    tokens = [s, ...tokens];
  }

  /* split camel-case given names */
  const expanded = [tokens[0]];
  for (let i = 1; i < tokens.length; i++) {
    expanded.push(...splitCamel(tokens[i]));
  }

  return expanded.map(cap).join(" ");
}
const localFallback = raw => normalise(raw);

/* ──────────────────  main helper  ────────────────── */
async function formatName(raw) {
  /* bail out early for company strings */
  if (COMPANY_HINTS.test(raw)) return raw.trim();

  try {
    const prompt = `
You will receive **exactly one** personal name in Pinyin (as typed).

— COMPANY CHECK —  
If the text contains “Ltd”, “Limited”, “Inc”, “Company”, “Holding(s)”,  
“Fund”, etc. → **return it unchanged** and stop.

— PERSON NAME LOGIC —  
1  Split on spaces → tokens T₁ T₂ […].  
2  Decide surname:  
   • If T₁ ∈ <SURNAME-LIST> → keep order.  
   • Else if T₂ ∈ <SURNAME-LIST> & T₁ ∉ <SURNAME-LIST> → swap.  
   • **If there are exactly TWO tokens and *both* are in the list,
     do NOT swap** (e.g. “Tian Ye”, “Xiang Zhao”, “Wei Su”).  
3  Insert one space before interior capitals in each given-name token  
   (Chaohua → Chao Hua, Zhiting → Zhi Ting).  
4  Capitalise every syllable (Gui Xia, Zhi Ting).  
5  Output **only**:  Surname␠Given1␠[Given2 …]

<SURNAME-LIST> =
Li Wang Zhang Liu Chen Yang Zhao Huang Zhou Wu Xu Sun Ma Zhu Hu Guo He Gao Lin Luo
Zheng Xie Ye Deng Fang Wei Cao Peng Jiang Qian Pan Xiang Xiong Shi Tan Han Yuan Yao Tong
Meng Pei Hong Kong Lai Cui Duan Bai Mo Rao Shen Song Tian Su Fan Cheng
`.trim();

    const { choices } = await openai.chat.completions.create({
      model:       "gpt-4o",
      temperature: 0,
      max_tokens:  20,
      messages: [
        { role: "system", content: prompt },
        { role: "user",   content: raw }
      ]
    });

    const candidate = choices?.[0]?.message?.content?.trim();
    if (!candidate) throw new Error("empty response from OpenAI");

    return normalise(candidate);
  } catch (err) {
    console.warn("formatName(): OpenAI failed – fallback used:", err.message);
    return localFallback(raw);
  }
}

module.exports = { formatName };
