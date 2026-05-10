"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "tenderfish.cookieConsent.v1";

// Cookie notice — Tenderfish only sets technically-necessary auth cookies,
// so under § 25 Abs. 2 TTDSG no opt-in is required. We still surface a one-off
// notice with a link to the Datenschutzerklärung as a transparency measure.

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (localStorage.getItem(STORAGE_KEY) !== "ack") setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  function acknowledge() {
    try {
      localStorage.setItem(STORAGE_KEY, "ack");
    } catch {
      // Cookies / localStorage disabled — banner won't reappear if the page
      // simply reloads, but that's acceptable.
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Cookie-Hinweis"
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 rounded-2xl border border-border bg-white shadow-lg p-4 text-sm"
    >
      <p className="text-text-primary">
        Wir verwenden ausschließlich technisch notwendige Sitzungs-Cookies zur
        Authentifizierung. Kein Tracking, keine Analyse.
      </p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <Link href="/datenschutz" className="text-xs text-brand-orange hover:underline">
          Datenschutzerklärung
        </Link>
        <button
          type="button"
          onClick={acknowledge}
          className="btn-primary text-xs px-4 py-1.5"
        >
          Verstanden
        </button>
      </div>
    </div>
  );
}
