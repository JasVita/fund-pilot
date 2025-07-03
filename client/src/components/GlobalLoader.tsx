"use client";
import { useEffect, useState } from "react";
import { useLoadingStore } from "@/lib/loadingStore";
import NProgress from "nprogress";
import "nprogress/nprogress.css";

export default function GlobalLoader() {
  const pending = useLoadingStore((s) => s.pending);
  const [showSpinner, setShowSpinner] = useState(false);

  /* NProgress bar (top) ----------------------- */
  useEffect(() => {
    if (pending > 0) NProgress.start();
    else NProgress.done();
  }, [pending]);

  /* optional centred spinner ------------------ */
  useEffect(() => {
    if (pending === 0) {
      const t = setTimeout(() => setShowSpinner(false), 200); // fade-out
      return () => clearTimeout(t);
    }
    setShowSpinner(true);
  }, [pending]);

  return showSpinner ? (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/60 backdrop-blur-sm">
      {/* tail-wind ring spinner */}
      <span className="h-12 w-12 animate-spin rounded-full border-4 border-red-500 border-t-transparent" />
    </div>
  ) : null;
}
