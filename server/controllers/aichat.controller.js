/***********************************************************************/
/*  AI-chat controller – pure logic, no Express objects                */
/***********************************************************************/
require("dotenv").config();

const { DataSource }     = require("typeorm");
const { SqlDatabase }    = require("langchain/sql_db");       // 0.1.x path
const { ChatOpenAI }     = require("@langchain/openai");
const { PromptTemplate } = require("@langchain/core/prompts");
const { TABLE_DOCS }     = require("../config/tableDocs");

/* ---------- 1. Initialise DB and build schemaBlock once ----------- */
const datasource = new DataSource({
  type:     "postgres",
  host:     process.env.PGHOST,
  port:     Number(process.env.PGPORT),
  database: process.env.PGDATABASE,
  username: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl:      { rejectUnauthorized: false },
});

let db, schemaBlock;      // populated by initPromise
const initPromise = (async () => {
  await datasource.initialize();
  db = await SqlDatabase.fromDataSourceParams({
    appDataSource: datasource,
    sampleRowsInTableInfo: 2,
  });

  const rawDDL = await db.getTableInfo();
  const docs   = Object.entries(TABLE_DOCS)
    .map(([t, doc]) => `### ${t}\n${doc.trim()}`)
    .join("\n\n");
  schemaBlock  = `${docs}\n\n${rawDDL}`;
})();

/* ---------- 2. LLM & prompt templates ----------------------------- */
if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");

const llm = new ChatOpenAI({
  apiKey:     process.env.OPENAI_API_KEY,
  modelName:  "gpt-4.1-mini",
  temperature: 0,
});

const sqlGenPrompt = PromptTemplate.fromTemplate(`
You are FundPilot’s senior PostgreSQL engineer.

──────── DB DICTIONARY + DDL ────────
{schema}
─────────────────────────────────────

Write ONE read-only SQL statement that answers the question.

Key business rules
1. NAME search  
   • When the user looks for a *person / investor / counterparty* by name,  
     match with  
       similarity(make_fingerprint(db_name),
                  make_fingerprint(:input_name)) > 0.85

2. NUMERIC comparison  
   • When deciding if two monetary amounts are “the same”, treat them as equal
     if  ABS(a − b) / NULLIF(b,0) ≤ 0.02  (±2 %).

Other guidelines
• Use only listed tables/columns.  
• Default to whole data range if no date range.  
• SELECT only — never modify data.  
• LIMIT 200 unless aggregating.

Question: {question}

SQL:
`);

const sqlFixPrompt = PromptTemplate.fromTemplate(`
You wrote a SQL statement that returned an error.
Rewrite the query so it runs successfully.

Rules
1. Output **only** the corrected SQL, nothing else.
2. Do NOT wrap the SQL in back-ticks or Markdown fences.
3. Keep it a single statement ending with a semicolon.

Schema:
{schema}

Question: {question}
Failed SQL: {failed}
Error: {error}

Correct SQL:
`);

const analysisPrompt = PromptTemplate.fromTemplate(`
You are FundPilot’s client-facing analyst.

Inputs
──────
Question: {question}
Result   : {result}   ← JSON array already fetched for you

When to output a list
─────────────────────
• If {result} has **more than one row**, or  
• The user explicitly asks to “list / show all / each / every …”.

Output format
─────────────
1.  **Answer**  
    • Single row → one-sentence answer (≤ 25 words).  
    • List needed → bullet each row (-) showing key business columns only  
      (max 15 bullets; if more, show first 15 then “…and N more”).

2.  **Context**  
    • One sentence (≤ 25 words) why the figure/list matters.  
    • Do **not** mention queries, tables, SQL, databases, or tech.

Rules
─────
• Never reveal technical details.  
• If a number is a calc (YoY, MoM, ratio), state it plainly (“up 8 % YoY”).  
• English only. No headings, code fences, or raw JSON.
`);

/* ---------- 3. Helpers ------------------------------------------- */
const sqlFromFence = (txt) => {
  /* 1️⃣  look for ```sql fenced blocks */
  let m = txt.match(/```sql\s+([\s\S]+?)```/i);
  if (m) return m[1].trim().replace(/;+\s*$/, ";");

  /* 2️⃣  otherwise grab from first SELECT/WITH to the first semicolon */
  m = txt.match(/((?:select|with)[\s\S]+?);/i);
  if (m) return m[1].trim() + ";";

  /* 3️⃣  fallback: return the whole string, trimmed */
  return txt.trim();
};


const runWithRetry = async (question, firstSql, retries = 2) => {
  let sql = sqlFromFence(firstSql), lastErr = "";
  for (let i = 0; i <= retries; i++) {
    try {
      return { ok: true, sql, rows: await db.run(sql) };
    } catch (e) {
      lastErr = e.message;
      if (i === retries) break;

      const fix = await llm.invoke(
        await sqlFixPrompt.format({ schema: schemaBlock, question, failed: sql, error: lastErr })
      );
      sql = sqlFromFence(String(fix.content));
    }
  }
  return { ok: false, sql, error: lastErr };
};

/* ---------- 4. Exported handler – async (req,res) ----------------- */
async function aiChatHandler(req, res) {
  try {
    await initPromise;                       // ensure DB/schema ready

    const question = (req.body?.question || "").trim();
    if (!question) return res.status(400).json({ error: "Missing question" });

    /* a) generate SQL */
    const gen = await llm.invoke(await sqlGenPrompt.format({ schema: schemaBlock, question }));
    const draftSql = sqlFromFence(String(gen.content));

    /* b) execute SQL (auto-fix) */
    const run = await runWithRetry(question, draftSql);

    /* c) explain rows */
    let answer;
    if (run.ok) {
      const exp = await llm.invoke(await analysisPrompt.format({
        question, result: JSON.stringify(run.rows),
      }));
      answer = String(exp.content);
    } else {
      answer = `Sorry, I couldn't build working SQL (error: ${run.error}).`;
    }

    res.json({
      answer,
      debug: { original_sql: draftSql, final_sql: run.sql, success: run.ok, error: run.error ?? null },
    });
  } catch (err) {
    console.error("ai-chat controller error:", err);
    res.status(500).json({ error: err.message ?? "internal error" });
  }
}

module.exports = { aiChatHandler };
