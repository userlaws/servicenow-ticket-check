"use client";

import { useEffect, useRef, useState } from "react";
import { BookmarkIcon } from "./icons";
import { base } from "@/lib/base";

// The real bookmark. React won't render a javascript: URL, so the href is
// set on the element after it mounts.
function BookmarkButton({ href, onClickHere }: { href: string; onClickHere: () => void }) {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    ref.current?.setAttribute("href", href);
  }, [href]);
  return (
    <a
      ref={ref}
      href="#get"
      className="bm-btn"
      draggable
      onClick={(e) => {
        // Clicking it here would run it on this page, which isn't ServiceNow.
        e.preventDefault();
        onClickHere();
      }}
    >
      <BookmarkIcon size={16} />
      Ticket check
    </a>
  );
}

type CopyState = "idle" | "copied" | "failed";

export default function GetIt({ href, script }: { href: string; script: string }) {
  const [clicked, setClicked] = useState(false);
  const [copy, setCopy] = useState<CopyState>("idle");

  const copyScript = async () => {
    try {
      // Plain line breaks, so the Windows clipboard doesn't double them up.
      await navigator.clipboard.writeText(script.split("\r\n").join("\n"));
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
  };

  return (
    <section className="get" id="get" aria-labelledby="get-h">
      <div className="get-stage">
        <h2 id="get-h">Add it to your bookmarks bar.</h2>
        <p className="get-sub">Drag the button up to your bookmarks bar. Then open any ServiceNow page while you&rsquo;re signed in and click it.</p>

        <div className="get-drag">
          <div className="fake-bar" aria-hidden="true">
            <span />
            <span />
            <span className="fake-bar-slot">Drop it here</span>
          </div>
          <BookmarkButton href={href} onClickHere={() => setClicked(true)} />
          <p className={`get-hint${clicked ? " on" : ""}`} role="status">
            {clicked ? "Drag it instead. It only works when you click it on a ServiceNow page." : "It uses the ServiceNow session you’re already signed in with."}
          </p>
          <p className="get-once">
            You only add it once. Each click loads the latest version. If you added it before 10/29/2026, drag it again once so yours updates too.
          </p>
          <p className="get-touch">Bookmarks can&rsquo;t be dragged on a phone. Open this page on your work computer.</p>
        </div>
      </div>

      <div className="get-alt">
        <div className="card">
          <h3>Can&rsquo;t add bookmarks?</h3>
          <p>Paste the script into the browser console (F12, then Console) on a ServiceNow page. It does the same thing.</p>
          <button type="button" className="btn btn-dark" onClick={copyScript}>
            Copy the script
          </button>
          <p className="copy-state" role="status">
            {copy === "copied" && "Copied. Paste it into the console on a ServiceNow page and press Enter."}
            {copy === "failed" && "Your browser blocked the clipboard. Download the file and paste its contents instead."}
          </p>
        </div>
        <div className="card">
          <h3>Want to read it first?</h3>
          <p>It&rsquo;s one commented file. The settings at the top pick which groups to check, how many days counts as behind, and extra staff names.</p>
          <a className="btn btn-light" href={`${base}/ticket-check.js`} download>
            Download ticket-check.js
          </a>
        </div>
      </div>
    </section>
  );
}
