import { readFileSync } from "node:fs";
import path from "node:path";

// The real tool lives in the repo root, next to this folder. Reading it at build time means
// the bookmark, the console copy and the download are always the same code.
const SCRIPT_PATH = path.join(process.cwd(), "..", "ticket-check.js");

export function readScript(): string {
  return readFileSync(SCRIPT_PATH, "utf8");
}

// Same encoding as ticket-check/build-bookmark.js.
export function bookmarkHref(): string {
  const source = readScript();
  const body = source.slice(source.indexOf("(async () => {"));
  return `javascript:${encodeURIComponent(body)}`;
}
