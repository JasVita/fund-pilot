/* ──────────────────────────────────────────────────────────
   Files Monitor – Missing & Needs‑Verification dashboard
────────────────────────────────────────────────────────── */
"use client";

import React, { useEffect, useState } from "react";
import { cn }             from "@/lib/utils";
import { fmt, fetchJson } from "@/lib/format";  
import { Badge }          from "@/components/ui/badge";
import { Separator }      from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, }       from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, }   from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent, }                        from "@/components/ui/tabs";
import { Banknote, FileWarning, FileText, AlertTriangle, }                  from "lucide-react";

/* ─── API helpers ───────────────────────────────────────── */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5103";

/* ---------- 2.  row shapes use string for numeric fields  */
type Fund = { fund_id:number; fund_name:string };

type BankMiss = { fund_id:number; fund_name:string; month:string };
type BankVer  = BankMiss & { diff:string };

type InvMiss  = { 
  fund_id:number; fund_name?:string; 
  missing_month:string;
  frequency:"monthly"|"quarterly";
  missing_quarter:string|null;
};
type InvVer   = InvMiss & {month: string;  nav_calc:string; nav_db:string };

type NoteMiss = { fund_id:number; investor:string;  month:string };
type NoteVer  = NoteMiss & { abs_diff:string };

/* ─── KPI colour helpers ───────────────────────────────── */
function cardStyles(
  count:number,
  kind :"missing"|"verify"|"total"|"verifyTotal",
) {
  if (count === 0)
    return { bg:"bg-green-50",  num:"text-green-600 font-bold", border: "border border-green-200", icon: "text-green-600"};

  if (kind === "verifyTotal")
    return { bg:"bg-gray-100",  num:"" };

  if (kind === "verify")
    return { bg:"bg-amber-50", num:"text-amber-600 font-bold", border: "border border-amber-200", icon: "text-amber-500",};

  if (kind === "total")
    return { bg:"bg-gray-100", num:"" };

  /* missing */
  return { bg:"bg-red-50",   num:"text-red-600 font-bold" };
}


function SummaryCard({ icon,label,count,kind }:{
  icon:React.ReactNode; label:string; count:number;
  kind:"missing"|"verify"|"total"|"verifyTotal";
}) {
  const { bg,num } = cardStyles(count,kind);
  return (
    <Card className={cn(bg)}>
      <CardHeader className="space-y-1">
        <CardDescription className="flex items-center gap-1 text-sm">
          {icon}{label}
        </CardDescription>
        <CardTitle className={cn("text-3xl",num)}>{count}</CardTitle>
      </CardHeader>
    </Card>
  );
}

/* ─── generic row renderers to avoid duplication ───────── */
const MissingRow = ({a,b}:{a:string;b:string}) => (
  <div className="grid grid-cols-3 py-1 items-center">
    <span>{a}</span><span>{b}</span>
    <Badge variant="destructive" className="w-fit text-xs">Missing</Badge>
  </div>
);

const MissingInvRow = ({r}:{r:InvMiss}) => (
  <div className="grid grid-cols-[3fr_1fr_1fr_1fr_1fr] py-1 items-center">
    <span>{r.fund_name ?? r.fund_id}</span>
    <span>{r.missing_month}</span>
    <Badge variant="destructive" className="w-fit text-xs">Missing</Badge>
    <span className="capitalize">{r.frequency}</span>
    <span>{r.missing_quarter ?? "—"}</span>
  </div>
);

/* ─── main component ───────────────────────────────────── */
export default function FilesDashboard() {

  /* selector & fund list */
  const [funds,setFunds]         = useState<Fund[]>([]);
  const [selectedFund,setFund]   = useState("all");
  const [loadingFunds,setLF]     = useState(true);

  /* missing */
  const [bankMiss,setBankMiss]   = useState<BankMiss[]>([]);
  const [invMiss ,setInvMiss ]   = useState<InvMiss []>([]);
  const [noteMiss,setNoteMiss]   = useState<NoteMiss[]>([]);

  /* verify */
  const [bankVer,setBankVer]     = useState<BankVer[]>([]);
  const [invVer ,setInvVer ]     = useState<InvVer []>([]);
  const [noteVer,setNoteVer]     = useState<NoteVer[]>([]);

  /* fund list once */
  useEffect(()=>{
    (async()=>{
      const r = await fetch(`${API_BASE}/funds`,{credentials:"include"});
      setFunds(await r.json()); setLF(false);
    })();
  },[]);

  /* fetch rows on fund change */
  useEffect(()=>{
    const qp = selectedFund==="all" ? "" : `?fund_id=${selectedFund}`;

    Promise.allSettled([
      /* missing */
      fetchJson<{rows:BankMiss []}>(`${API_BASE}/files/dashboard/missing-bank-statements${qp}`).then(j=>setBankMiss(j.rows||[])),
      fetchJson<{rows:InvMiss []}>(`${API_BASE}/files/dashboard/missing-investor-statements${qp}`).then(j=>setInvMiss(j.rows||[])),
      // fetchJson<{rows:NoteMiss[]}>(`${API_BASE}/files/dashboard/missing-contract-notes${qp}`).then(j=>setNoteMiss(j.rows||[])),

      /* verify */
      fetchJson<{rows:BankVer []}>(`${API_BASE}/files/dashboard/verify-bank-statements${qp}`).then(j=>setBankVer(j.rows||[])),
      fetchJson<{rows:InvVer  []}>(`${API_BASE}/files/dashboard/verify-investor-statements${qp}`).then(j=>setInvVer(j.rows||[])),
      fetchJson<{rows:NoteVer []}>(`${API_BASE}/files/dashboard/verify-contract-notes${qp}`).then(j=>setNoteVer(j.rows||[])),
    ]);
  },[selectedFund]);

  /* KPI counts */
  const missing = { bank:bankMiss.length, inv:invMiss.length };
  const verify  = { bank:bankVer.length , inv:invVer.length , note:noteVer.length };
  const total   = { missing:missing.bank+missing.inv,
                    verify :verify .bank+verify .inv+verify .note };

  /* ─── render ─────────────────────────────────────────── */
  return (
    <div className="p-6 space-y-6">

      {/* header & selector */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Files Monitor</h1>
          <p className="text-muted-foreground">Track and manage files across your portfolio</p>
        </div>

        <Select value={selectedFund} onValueChange={setFund} disabled={loadingFunds}>
          <SelectTrigger className="min-w-[20rem]"><SelectValue placeholder="All Funds"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Funds</SelectItem>
            {funds.map(f=><SelectItem key={f.fund_id} value={String(f.fund_id)}>{f.fund_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* KPI – Missing */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <SummaryCard icon={<Banknote className="w-4 h-4"/>} label="Bank Statements Missing"     kind="missing" count={missing.bank}/>
        <SummaryCard icon={<FileText className="w-4 h-4"/>} label="Investor Statements Missing" kind="missing" count={missing.inv}/>
        {/* <SummaryCard icon={<FileWarning className="w-4 h-4"/>} label="Contact Notes Missing"     kind="missing" count={missing.note}/> */}
        <SummaryCard icon={<AlertTriangle className="w-4 h-4"/>} label="Total Missing Files"     kind="total"    count={total.missing}/>
      </section>

      {/* KPI – Needs Verification */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard icon={<Banknote className="w-4 h-4"/>} label="Bank Statements ⚠︎"           kind="verify"      count={verify.bank}/>
        <SummaryCard icon={<FileText className="w-4 h-4"/>} label="Investor Statements ⚠︎"       kind="verify"      count={verify.inv}/>
        <SummaryCard icon={<FileWarning className="w-4 h-4"/>} label="Contact Notes ⚠︎"           kind="verify"      count={verify.note}/>
        {/* grey background when >0, green when 0 */}
        <SummaryCard icon={<AlertTriangle className="w-4 h-4"/>} label="Total Verification"
                     kind="verifyTotal" count={total.verify}/>
      </section>

      {/* Tabs */}
      <Tabs defaultValue="missing" className="space-y-6">
        <TabsList>
          <TabsTrigger value="missing">Missing</TabsTrigger>
          <TabsTrigger value="verify">Needs Verification</TabsTrigger>
        </TabsList>

        {/* ── Missing TAB ────────────────────────────────── */}
        <TabsContent value="missing" className="space-y-6">

          {/* Missing – Bank */}
          <Card>
            <CardHeader><CardTitle className="flex gap-2 items-center"><Banknote className="w-5 h-5"/>Bank Statements</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Separator/>
              <div className="grid grid-cols-3 font-medium"><span>Fund Name</span><span>Date</span><span>Status</span></div>
              <Separator/>
              {bankMiss.map((r,i)=><MissingRow key={i} a={r.fund_name} b={r.month}/>)}
            </CardContent>
          </Card>

          {/* Missing – Investor */}
          <Card>
            <CardHeader><CardTitle className="flex gap-2 items-center"><FileText className="w-5 h-5"/>Investor Statements</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Separator/>
              {/* <div className="grid grid-cols-3 font-medium"><span>Fund Name</span><span>Date</span><span>Status</span></div> */}
              <div className="grid grid-cols-[3fr_1fr_1fr_1fr_1fr] font-medium">
                <span>Fund Name</span>
                <span>Missing Month</span>
                <span>Status</span>
                <span>Frequency</span>
                <span>Quarter</span>
              </div>
              <Separator/>
              {invMiss.map((r,i)=><MissingInvRow key={i} r={r} />)}
            </CardContent>
          </Card>

          {/* Missing – Contact */}
          {/* <Card>
            <CardHeader><CardTitle className="flex gap-2 items-center"><FileWarning className="w-5 h-5"/>Contact Notes</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Separator/>
              <div className="grid grid-cols-3 font-medium"><span>Investor</span><span>Date</span><span>Reasons</span></div>
              <Separator/>
              {noteMiss.map((r,i)=><MissingRow key={i} a={r.investor} b={r.month}/>)}
            </CardContent>
          </Card> */}
        </TabsContent>

        {/* ── Needs‑Verification TAB ─────────────────────── */}
        <TabsContent value="verify" className="space-y-6">

          {/* Verify – Bank */}
          <Card>
            <CardHeader>
              <CardTitle className="flex gap-2 items-center">
                <Banknote className="w-5 h-5"/>Bank Statements - Needs Verification
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Separator/>
              <div className="grid grid-cols-3 font-medium">
                <span>Fund</span><span>Date</span><span>Description</span>
              </div>
              <Separator/>
              {bankVer.map((r,i)=>(
                <div key={i} className="grid grid-cols-3 py-1 items-center">
                  <span>{r.fund_name}</span>
                  <span>{r.month}</span>
                  <span className="text-amber-700">
                    Closing available balance mismatch:&nbsp;<span className="font-bold">{fmt(r.diff)}</span>
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Verify – Investor */}
          <Card>
            <CardHeader>
              <CardTitle className="flex gap-2 items-center">
                <FileText className="w-5 h-5"/>Investor Statements - Needs Verification
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Separator/>
              <div className="grid grid-cols-3 font-medium">
                <span>Fund</span><span>Date</span><span>Description</span>
              </div>
              <Separator/>
              {invVer.map((r,i)=>(
                <div key={i} className="grid grid-cols-3 py-1 items-center">
                  <span>{r.fund_name}</span>
                  <span>{r.month}</span>
                  <span className="text-amber-700">
                    Total NAV mismatch - Calculated&nbsp;
                    <span className="font-bold">{fmt(r.nav_calc)}</span>, DB&nbsp;
                    <span className="font-bold">{fmt(r.nav_db)}</span>
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Verify – Contact */}
          <Card>
            <CardHeader>
              <CardTitle className="flex gap-2 items-center">
                <FileWarning className="w-5 h-5"/>Contact Notes - Needs Verification
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Separator/>
              <div className="grid grid-cols-3 font-medium">
                <span>Investor</span><span>Date</span><span>Description</span>
              </div>
              <Separator/>
              {noteVer.map((r,i)=>(
                <div key={i} className="grid grid-cols-3 py-1 items-center">
                  <span>{r.investor}</span>
                  <span>{r.month}</span>
                  <span className="text-amber-700">
                    Holding shares difference:&nbsp;<span className="font-bold">{fmt(r.abs_diff)}</span>
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}