/* ──────────────────────────────────────────────────────────
   files/page.tsx  –  overview of uploaded & missing files
────────────────────────────────────────────────────────── */
"use client";

import React, { useState, useMemo } from "react";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Upload, Search, Filter, Eye, RotateCcw, Trash2, MoreHorizontal,
  FileSpreadsheet, FileText, AlertCircle, CheckCircle, Clock, Folder,
} from "lucide-react";

import { useGlobalStore } from "@/store/useGlobalStore";

/* ───────────  MOCK DATA  (use API later) ─────────── */
type RawFile = {
  id: number;
  name: string;
  type: string;
  fund: string;
  uploadDate: string;          // ISO string
  status: "Parsed" | "Error" | "Pending";
  records: number;
  errors: number;
  size: string;
};

const mock: RawFile[] = [
  {
    id: 1,
    name: "Qingwen_Mao_20230901_2000000509477.pdf",
    type: "Subscription",
    fund: "Income Fund",
    uploadDate: "2025-07-04T16:16:00Z",
    status: "Parsed",
    records: 1,
    errors: 0,
    size: "520 KB",
  },
  {
    id: 2,
    name: "Hu_Yanyan_20220301_2000000473537.pdf",
    type: "Subscription",
    fund: "Income Fund",
    uploadDate: "2025-07-04T16:17:47Z",
    status: "Parsed",
    records: 1,
    errors: 0,
    size: "512 KB",
  },
  // … add the remaining eight rows from your query here
];

/* ───────────  HELPERS  ─────────── */
const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-CA", { month: "short", day: "2-digit", year: "numeric" });

const StatusBadge = ({ status }: { status: RawFile["status"] }) => {
  switch (status) {
    case "Parsed":
      return (
        <Badge className="bg-green-500/10 text-green-700 dark:text-green-400">
          <CheckCircle className="w-3 h-3 mr-1" /> Parsed
        </Badge>
      );
    case "Error":
      return (
        <Badge className="bg-red-500/10 text-red-700 dark:text-red-400">
          <AlertCircle className="w-3 h-3 mr-1" /> Error
        </Badge>
      );
    case "Pending":
      return (
        <Badge className="bg-amber-400/10 text-amber-700 dark:text-amber-300">
          <Clock className="w-3 h-3 mr-1" /> Pending
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const FileIcon = ({ name }: { name: string }) =>
  name.match(/\.(xlsx?|csv)$/i) ? (
    <FileSpreadsheet className="w-4 h-4 text-green-600 shrink-0" />
  ) : (
    <FileText className="w-4 h-4 text-blue-600 shrink-0" />
  );

/* ───────────  COMPONENT  ─────────── */
export default function FilesPage() {
  /* ui state */
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [view, setView] = useState<"date" | "investor">("date");
  const { searchTerm, setSearchTerm } = useGlobalStore();

  /* fake upload */
  const startUpload = () => {
    setUploading(true);
    setProgress(0);
    const t = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(t);
          setUploading(false);
          setDrawerOpen(false);
          return 100;
        }
        return p + 10;
      });
    }, 200);
  };

  /* filter by search box */
  const files = useMemo(
    () =>
      mock.filter(
        (f) =>
          f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          f.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
          f.fund.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [searchTerm]
  );

  /* ------------ GROUPERS ------------ */
  const byDate = useMemo(() => {
    const map = new Map<string, RawFile[]>();
    [...files]
      .sort((a, b) => +new Date(b.uploadDate) - +new Date(a.uploadDate))
      .forEach((f) => {
        const k = fmtDate(new Date(f.uploadDate));
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(f);
      });
    return [...map.entries()];
  }, [files]);

  const byInvestor = useMemo(() => {
    // infer investor from leading token before first underscore
    const map = new Map<string, RawFile[]>();
    files.forEach((f) => {
      const inv = f.name.split("_")[0] ?? "Unknown";
      if (!map.has(inv)) map.set(inv, []);
      map.get(inv)!.push(f);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [files]);

  /* ------------ RENDER ------------ */
  return (
    <div className="p-6 space-y-6">
      {/* header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Files</h1>
          <p className="text-muted-foreground">
            Overview of uploaded data&nbsp;&amp;&nbsp;what’s still missing
          </p>
        </div>
        {/* <Button onClick={() => setDrawerOpen(true)}>
          <Upload className="w-4 h-4 mr-2" /> Upload&nbsp;File
        </Button> */}
      </div>

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search files…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Button variant="outline" size="sm" className="shrink-0">
          <Filter className="w-4 h-4 mr-2" /> Fund&nbsp;Filter
        </Button>

        {/* prettier toggle pills */}
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(v) => v && setView(v as typeof view)}
          className="ml-auto inline-flex rounded-full bg-muted p-1 shadow-inner overflow-hidden"
        >
          {(["date", "investor"] as const).map((v) => (
            <ToggleGroupItem
              key={v}
              value={v}
              /* prettier pills – no ugly ring */
              className="px-3 py-1 text-sm rounded-full transition
                        focus-visible:outline-none focus-visible:ring-0
                        data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              {v === "date" ? "By Date" : "By Investor"}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {/* explorer – by DATE */}
      {view === "date" &&
        byDate.map(([day, list]) => (
          <Card key={day}>
            <CardHeader>
              <CardTitle>{day}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {list.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between px-2 py-1 rounded-md hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileIcon name={f.name} />
                    <span className="truncate">{f.name}</span>
                    <StatusBadge status={f.status} />
                  </div>
                  <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    <span>{new Date(f.uploadDate).toLocaleTimeString()}</span>
                    <span className="font-mono">{f.size}</span>
                    {/* row-actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Eye className="w-4 h-4 mr-2" /> View&nbsp;Details
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <RotateCcw className="w-4 h-4 mr-2" /> Re-parse
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

      {/* explorer – by INVESTOR */}
      {view === "investor" &&
        byInvestor.map(([inv, list]) => (
          <Card key={inv}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Folder className="w-4 h-4 text-primary" /> {inv}
                <Badge variant="secondary">{list.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/2">File</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Size</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="flex items-center gap-2">
                        <FileIcon name={f.name} />
                        <span className="truncate">{f.name}</span>
                      </TableCell>
                      <TableCell>{f.type}</TableCell>
                      <TableCell>
                        <StatusBadge status={f.status} />
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {f.size}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="w-4 h-4 mr-2" /> View&nbsp;Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <RotateCcw className="w-4 h-4 mr-2" /> Re-parse
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              <Trash2 className="w-4 h-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}

      {/* upload drawer (unchanged) */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Upload New File</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
              <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="font-medium">
                Drop files here or click to browse
              </p>
              <p className="text-sm text-muted-foreground">
                Supports .xlsx .xls .csv .pdf&nbsp;(max 50 MB)
              </p>
              <Button className="mt-4">Choose Files</Button>
            </div>

            {uploading && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    NAV_2024_12_04.xlsx
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {progress}%
                  </span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Processing Log</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-muted rounded-md p-3 font-mono text-xs space-y-1">
                  <div className="text-success">
                    ✓ File validation passed
                  </div>
                  <div className="text-success">
                    ✓ Schema validation passed
                  </div>
                  <div className="text-warning">
                    ⚠ 2 rows with missing data
                  </div>
                  <div className="text-muted-foreground">Processing…</div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setDrawerOpen(false)}
                disabled={uploading}
              >
                Cancel
              </Button>
              <Button onClick={startUpload} disabled={uploading}>
                {uploading ? "Uploading…" : "Upload & Process"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
