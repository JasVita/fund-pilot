/* ──────────────────────────────────────────────────────────
   files/page.tsx
────────────────────────────────────────────────────────── */
"use client";

import React, { useState } from "react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Upload,
  Search,
  Filter,
  Eye,
  RotateCcw,
  Trash2,
  MoreHorizontal,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  CheckCircle,
  Clock,
} from "lucide-react";

import { useGlobalStore } from "@/store/useGlobalStore";

/* ─── utilities ─── */
const formatCurrency = (v: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(v);

/* ─── mock data ─── */
const filesData = [
  {
    id: 1,
    name: "NAV_2024_12_03.xlsx",
    type: "NAV Report",
    fund: "Equity Fund",
    uploadDate: "2024-12-03 10:30:00",
    status: "Parsed",
    records: 1_247,
    errors: 2,
    size: "2.4 MB",
  },
  {
    id: 2,
    name: "Holdings_2024_12_02.csv",
    type: "Holdings",
    fund: "Bond Fund",
    uploadDate: "2024-12-02 14:45:00",
    status: "Error",
    records: 0,
    errors: 15,
    size: "5.7 MB",
  },
  {
    id: 3,
    name: "Transactions_2024_12_01.xlsx",
    type: "Transactions",
    fund: "Hybrid Fund",
    uploadDate: "2024-12-01 09:15:00",
    status: "Pending",
    records: 0,
    errors: 0,
    size: "1.8 MB",
  },
  {
    id: 4,
    name: "Investor_Registry_Nov.xlsx",
    type: "Investor Data",
    fund: "All Funds",
    uploadDate: "2024-11-30 16:20:00",
    status: "Parsed",
    records: 324,
    errors: 0,
    size: "892 KB",
  },
];

/* status → coloured pill badge */
const StatusBadge = ({ status }: { status: string }) => {
  switch (status) {
    case "Parsed":
      return (
        <Badge className="bg-green-500/10 text-green-700 dark:text-green-400">
          <CheckCircle className="w-3 h-3 mr-1" />
          Parsed
        </Badge>
      );
    case "Error":
      return (
        <Badge className="bg-red-500/10 text-red-700 dark:text-red-400">
          <AlertCircle className="w-3 h-3 mr-1" />
          Error
        </Badge>
      );
    case "Pending":
      return (
        <Badge className="bg-amber-400/10 text-amber-700 dark:text-amber-300">
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const FileIcon = ({ name }: { name: string }) =>
  name.endsWith(".xlsx") || name.endsWith(".xls") ? (
    <FileSpreadsheet className="w-4 h-4 text-green-600" />
  ) : (
    <FileText className="w-4 h-4 text-blue-600" />
  );

/* ─── page component ─── */
export default function FilesPage() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { searchTerm, setSearchTerm } = useGlobalStore();

  /* fake upload */
  const startUpload = () => {
    setUploading(true);
    setProgress(0);
    const timer = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(timer);
          setUploading(false);
          setDrawerOpen(false);
          return 100;
        }
        return p + 10;
      });
    }, 200);
  };

  const filtered = filesData.filter(
    (f) =>
      f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      {/* ── header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Files</h1>
          <p className="text-muted-foreground">
            Upload and manage fund data files
          </p>
        </div>

        <Button onClick={() => setDrawerOpen(true)}>
          <Upload className="w-4 h-4 mr-2" /> Upload File
        </Button>
      </div>

      {/* ── toolbar ── */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search files…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Button variant="outline" size="sm">
          <Filter className="w-4 h-4 mr-2" /> Fund Filter
        </Button>
      </div>

      {/* ── table ── */}
      <Card>
        <CardHeader>
          <CardTitle>File Processing Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-64">File Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Fund</TableHead>
                  <TableHead>Upload Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Records</TableHead>
                  <TableHead className="text-right">Errors</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filtered.map((f) => (
                  <TableRow key={f.id}>
                    {/* name + icon */}
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <FileIcon name={f.name} />
                        <span className="font-medium">{f.name}</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline">{f.type}</Badge>
                    </TableCell>
                    <TableCell>{f.fund}</TableCell>

                    <TableCell className="font-mono text-sm">
                      {new Date(f.uploadDate).toLocaleDateString()}{" "}
                      {new Date(f.uploadDate).toLocaleTimeString()}
                    </TableCell>

                    <TableCell>
                      <StatusBadge status={f.status} />
                    </TableCell>

                    <TableCell className="text-right font-mono">
                      {f.records ? f.records.toLocaleString() : "—"}
                    </TableCell>

                    <TableCell className="text-right">
                      {f.errors ? (
                        <span className="text-destructive font-medium">
                          {f.errors}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell className="font-mono text-sm">{f.size}</TableCell>

                    {/* row actions */}
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="w-4 h-4 mr-2" /> View Details
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
          </div>
        </CardContent>
      </Card>

      {/* ── upload drawer ── */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Upload New File</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* drag-and-drop area */}
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
              <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="font-medium">Drop files here or click to browse</p>
              <p className="text-sm text-muted-foreground">
                Supports .xlsx .xls .csv (max 50 MB)
              </p>
              <Button className="mt-4">Choose Files</Button>
            </div>

            {/* progress bar */}
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

            {/* processing log */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Processing Log</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-muted rounded-md p-3 font-mono text-xs space-y-1">
                  <div className="text-success">✓ File validation passed</div>
                  <div className="text-success">✓ Schema validation passed</div>
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
