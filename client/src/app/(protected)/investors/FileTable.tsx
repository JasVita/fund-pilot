"use client";

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/* ---------- types (match fund_files) ---------- */
export type FileRow = {
  id: number;
  investor_name: string;
  as_of: string;                    // ISO date
  type: "is" | "cn" | "other";
  class: string;
  fund_id: number;
  url: string;
};

/* ---------- helpers ---------- */
const typeText = (t: FileRow["type"]) =>
  t === "is" ? "Investor Statement" : t === "cn" ? "Contract Note" : "Other";

const fmtDate = (s: string) => {
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("en-CA");
};

/* loose name normalizer: lowercase + strip non-alphanum */
// const norm = (s: string) =>
//   (s || "")
//     .toLowerCase()
//     .normalize("NFKD")
//     .replace(/[\u0300-\u036f]/g, "")
//     .replace(/[^a-z0-9]/g, "");

/* ---------- MOCK (from fund_files) ---------- */
// const MOCK_FILES: FileRow[] = [
//   {
//     id: 1,
//     investor_name: "Feng Fan",
//     as_of: "2022-02-28",
//     type: "is",
//     class: "class a - lead series",
//     fund_id: 2,
//     url: "https://prod-fundpilot.s3.us-east-1.amazonaws.com/62d68849c591450d88b94d2dc4becc5b_Feng_Fan_20220228.pdf",
//   },
//   {
//     id: 2,
//     investor_name: "Xiang Youjin",
//     as_of: "2022-02-28",
//     type: "is",
//     class: "class a - lead series",
//     fund_id: 2,
//     url: "https://prod-fundpilot.s3.us-east-1.amazonaws.com/70d5ab9d12004ad4bc8525ba51c759dc_Xiang_Youjin_20220228.pdf",
//   },
//   {
//     id: 3,
//     investor_name: "He Guangming",
//     as_of: "2022-02-28",
//     type: "is",
//     class: "class a - lead series",
//     fund_id: 2,
//     url: "https://prod-fundpilot.s3.us-east-1.amazonaws.com/ccea62f9e69a4eb7bd4fbd330c1477b8_He_Guangming_20220228.pdf",
//   },
//   {
//     id: 4,
//     investor_name: "CN_213602974",         // example CN row for demo
//     as_of: "2025-07-14",
//     type: "cn",
//     class: "—",
//     fund_id: 7,
//     url: "https://example.com/CN_213602974.pdf",
//   },
// ];

/* ---------- props ---------- */
type Props = {
  investor: string;             // e.g. "Kai Zeng"
  fundId: number;               // current fund id
  apiBase?: string;             // default uses window origin
//   useMock?: boolean;            // true => read from MOCK_FILES
  title?: string;               // optional card title
};

export default function FileTable({
  investor,
  fundId,
  apiBase,
//   useMock = true,
  title,
}: Props) {
  /* ---------- fetch rows ---------- */
  const [rows, setRows] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
        if (!investor || !fundId) { setRows([]); return; }
        setLoading(true);
        try {
        const base = (apiBase?.trim() || window.location.origin).replace(/\/$/, "");
        const u = new URL(`${base}/investors/files`);
        u.searchParams.set("fund_id", String(fundId));
        u.searchParams.set("investor", investor);
        u.searchParams.set("limit", "100");
        u.searchParams.set("sort", "desc");

        const r = await fetch(u.toString(), { credentials: "include" });
        if (!mounted) return;
        if (!r.ok) { setRows([]); setLoading(false); return; }

        const j = await r.json() as { rows?: Partial<FileRow>[] };
        const mapped: FileRow[] = (j.rows ?? []).map((x, i) => ({
            id:         (x.id as number) ?? i + 1,
            investor_name: (x.investor_name as string) ?? investor,
            as_of:      (x.as_of as string) ?? "",
            type:       (x.type as FileRow["type"]) ?? "other",
            class:      (x.class as string) ?? "—",
            fund_id:    (x.fund_id as number) ?? fundId,
            url:        (x.url as string) ?? "#",
        }));
        setRows(mapped);
        } catch {
        if (!mounted) return;
        setRows([]);
        } finally {
        if (mounted) setLoading(false);
        }
    })();
    return () => { mounted = false; };
    }, [investor, fundId, apiBase]);


  /* ---------- filters & sort (in headers) ---------- */
  const [typeFilter, setTypeFilter]   = useState<"all"|"is"|"cn"|"other">("all");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [dateSort, setDateSort]       = useState<"desc"|"asc">("desc");

  // class options from current dataset
  const classOptions = useMemo(() => {
    const s = new Set<string>();
    rows.forEach(r => s.add(r.class || "—"));
    return Array.from(s);
  }, [rows]);

  // apply filters + sort
  const visibleRows = useMemo(() => {
    const filtered = rows.filter(r => {
      const mt = typeFilter === "all" || r.type === typeFilter;
      const mc = classFilter === "all" || (r.class || "—") === classFilter;
      return mt && mc;
    });
    const dir = dateSort === "desc" ? -1 : 1;
    return filtered.sort(
      (a, b) => (new Date(a.as_of).getTime() - new Date(b.as_of).getTime()) * dir
    );
  }, [rows, typeFilter, classFilter, dateSort]);

  const dateLabel = dateSort === "desc" ? "Date ↓" : "Date ↑";

  /* ---------- layout: Type | Class | Date | Download ---------- */
  const COLS = ["30%", "30%", "20%", "20%"] as const; // sums to 100%

  return (
    <Card className="mt-4 min-w-0">
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          {title ?? `Files — ${investor}`}
        </CardTitle>
      </CardHeader>

      <CardContent className="p-6">
        <div className="overflow-x-hidden">
          <Table className="w-full table-fixed border-collapse [&_th]:align-top [&_th]:pt-0.5 [&_th]:pb-2 [&_th]:truncate [&_td]:truncate">
            <colgroup>
              {COLS.map((w, i) => <col key={i} style={{ width: w }} />)}
            </colgroup>

            <TableHeader>
              <TableRow>
                {/* Type with inline filter */}
                <TableHead className="align-middle">
                  <Select value={typeFilter} onValueChange={(v)=>setTypeFilter(v as any)}>
                    <SelectTrigger className="h-7 w-full text-xs">
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      <SelectItem value="all">All types</SelectItem>
                      <SelectItem value="is">Investor Statement</SelectItem>
                      <SelectItem value="cn">Contract Note</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </TableHead>

                {/* Class with inline filter */}
                <TableHead className="align-middle">
                  <Select value={classFilter} onValueChange={setClassFilter}>
                    <SelectTrigger className="h-7 w-full text-xs">
                      <SelectValue placeholder="All classes" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      <SelectItem value="all">All classes</SelectItem>
                      {classOptions.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableHead>

                {/* Date with sort toggle */}
                <TableHead className="align-middle">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setDateSort(dateSort === "desc" ? "asc" : "desc")}
                    title={`Sort by date ${dateSort === "desc" ? "ascending" : "descending"}`}
                  >
                    {dateLabel}
                  </Button>
                </TableHead>

                {/* Download header */}
                <TableHead className="text-right whitespace-nowrap pr-1">Download</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">Loading…</TableCell>
                </TableRow>
              ) : visibleRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">No files</TableCell>
                </TableRow>
              ) : (
                visibleRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell title={typeText(r.type)}>{typeText(r.type)}</TableCell>
                    <TableCell title={r.class || "—"}>{r.class || "—"}</TableCell>
                    <TableCell title={fmtDate(r.as_of)}>{fmtDate(r.as_of)}</TableCell>

                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 p-0"
                        onClick={() => window.open(r.url, "_blank", "noopener")}
                        aria-label={`Download ${r.url.split("/").pop() || "file"}`}
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
