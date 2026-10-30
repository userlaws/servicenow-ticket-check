import { readFileSync } from "node:fs";
import path from "node:path";

// The real tool lives in the repo root, next to this folder. Reading it at build time means
// the hosted script, the console copy and the download are always the same code.
const SCRIPT_PATH = path.join(process.cwd(), "..", "ticket-check.js");

// Where the site serves the script. The bookmark loads it from here on every
// click, so a push to main reaches everyone without reinstalling.
export const SCRIPT_URL = "https://userlaws.github.io/servicenow-ticket-check/ticket-check.js";

export function readScript(): string {
  return readFileSync(SCRIPT_PATH, "utf8");
}

// The script without its header comment, for pasting into the console.
export function consoleScript(): string {
  const source = readScript();
  return source.slice(source.indexOf("(async () => {"));
}

// Same loader as build-bookmark.js. The ?t= keeps the browser from using an
// old cached copy.
export function bookmarkHref(): string {
  return "javascript:(function(){var s=document.createElement('script');"
    + `s.src='${SCRIPT_URL}?t='+Date.now();`
    + "s.onerror=function(){alert('Ticket check could not load. Check your connection and try again.')};"
    + "document.body.appendChild(s);})();";
}
