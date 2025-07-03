/* --------------------------------------------------------------------
   RouteLoader – global page-change indicator (App Router)
   ------------------------------------------------------------------ */
"use client";

import { useEffect, useRef } from "react";
import { usePathname }      from "next/navigation";
import NProgress            from "nprogress";
import "nprogress/nprogress.css";

/* ---------- configure once (typesafe) ----------------------------- */
NProgress.configure({ showSpinner: false });   // <- only supported keys
// extra props that aren’t in @types/nprogress
(NProgress as any).settings.trickleRate  = 0.15;
(NProgress as any).settings.trickleSpeed = 200;

export default function RouteLoader() {
  /* pathname changes on every navigation -------------------------------- */
  const pathname = usePathname();

  /* keep an *optional* timer ref (null at start) ------------------------- */
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  /* start bar after 100 ms (skip flash on very fast navs) --------------- */
  useEffect(() => {
    timerRef.current = setTimeout(() => NProgress.start(), 100);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pathname]);

  /* stop the bar once browser has committed the new route --------------- */
  useEffect(() => { NProgress.done(); }, [pathname]);

  return null;                // renders nothing
}
