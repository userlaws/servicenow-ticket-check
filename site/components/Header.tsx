"use client";

import { useEffect, useState } from "react";
import { CheckMark } from "./icons";
import { base } from "@/lib/base";

// Plain white bar. A hairline appears under it once the page scrolls, so it
// separates from the content without a floating pill.
export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <header className={`hdr${scrolled ? " scrolled" : ""}`}>
      <div className="hdr-in">
        <a className="logo" href={`${base}/#top`} aria-label="Ticket Check, back to top">
          <span className="logo-mark" aria-hidden="true">
            <CheckMark size={13} color="#FFFFFF" />
          </span>
          Ticket Check
        </a>
        <nav className="hdr-nav" aria-label="Sections">
          <a href={`${base}/#flags`}>What it flags</a>
          <a href={`${base}/#copies`}>How it decides</a>
          <a href={`${base}/#privacy`}>Privacy</a>
          <a href={`${base}/changelog/`}>Changelog</a>
        </nav>
        <a className="btn btn-dark btn-sm" href={`${base}/#get`}>
          Get the bookmark
        </a>
      </div>
    </header>
  );
}
