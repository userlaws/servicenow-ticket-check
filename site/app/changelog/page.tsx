import type { Metadata } from "next";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { ReactNode } from "react";
import Header from "@/components/Header";
import { base } from "@/lib/base";

export const metadata: Metadata = { title: "Changelog · Ticket Check" };

// Read the tool's own CHANGELOG.md at build time, so this page and the file
// can never disagree.
type Release = { version: string; date: string; intro: string[]; items: string[] };

function parse(md: string): Release[] {
  const out: Release[] = [];
  let cur: Release | null = null;
  let para: string[] = [];
  const flush = () => {
    if (cur && para.length) cur.intro.push(para.join(" "));
    para = [];
  };
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const head = line.match(/^## (\S+)(?: \(([^)]+)\))?/);
    if (head) {
      flush();
      cur = { version: head[1], date: head[2] ?? "", intro: [], items: [] };
      out.push(cur);
    } else if (!cur) {
      continue;
    } else if (line.startsWith("- ")) {
      flush();
      cur.items.push(line.slice(2));
    } else if (/^\s{2,}\S/.test(line) && cur.items.length) {
      cur.items[cur.items.length - 1] += ` ${line.trim()}`;
    } else if (line.trim()) {
      para.push(line.trim());
    } else {
      flush();
    }
  }
  flush();
  return out;
}

// `code` spans are the only inline formatting the changelog uses.
const inline = (text: string): ReactNode[] =>
  text.split(/(`[^`]+`)/).map((part, i) => (part.startsWith("`") ? <code key={i}>{part.slice(1, -1)}</code> : part));

export default function Changelog() {
  const releases = parse(readFileSync(path.join(process.cwd(), "..", "CHANGELOG.md"), "utf8"));
  return (
    <>
      <Header />
      <main className="log" id="top">
        <p className="kicker">Changelog</p>
        <h1 className="log-h">What changed in the bookmark.</h1>
        <p className="sub">The report Copy gives you has kept the same format in every version, so pasting it into Teams works the same way.</p>
        <ol className="log-list">
          {releases.map((r, i) => (
            <li key={r.version} className="log-rel">
              <div className="log-side">
                <span className={`log-v${i === 0 ? " now" : ""}`}>v{r.version}</span>
                {r.date && <span className="log-date">{r.date}</span>}
              </div>
              <div className="log-body">
                {r.intro.map((p) => (
                  <p key={p} className="log-intro">
                    {inline(p)}
                  </p>
                ))}
                <ul>
                  {r.items.map((it) => (
                    <li key={it}>{inline(it)}</li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>
      </main>
      <footer className="ftr">
        <span>Ticket Check. Read-only. Built by a help desk tech for a CUNY help desk queue.</span>
        <a href={`${base}/`}>Back to the home page</a>
      </footer>
    </>
  );
}
