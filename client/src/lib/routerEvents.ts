"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useLoadingStore } from "@/lib/loadingStore";

export function useRouteLoading() {
  const router = useRouter();
  const { inc, dec } = useLoadingStore();

  useEffect(() => {
    const handleStart = () => inc();
    const handleDone  = () => dec();

    // Router events live on window for App Router:
    window.addEventListener("routeChangeStart", handleStart as any);
    window.addEventListener("routeChangeComplete", handleDone as any);
    window.addEventListener("routeChangeError", handleDone as any);
    return () => {
      window.removeEventListener("routeChangeStart", handleStart as any);
      window.removeEventListener("routeChangeComplete", handleDone as any);
      window.removeEventListener("routeChangeError", handleDone as any);
    };
  }, [inc, dec]);
}
