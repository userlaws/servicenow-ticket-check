// Builds bookmark.html, an offline page with the drag-to-install button.
//   node build-bookmark.js
// The bookmark is a loader: it pulls the hosted ticket-check.js on every
// click, so it never needs rebuilding when the script changes.
const fs = require('fs');
const path = require('path');

const SCRIPT_URL = 'https://userlaws.github.io/servicenow-ticket-check/ticket-check.js';
// Same loader as the site (site/lib/script.ts). The ?t= keeps the browser
// from using an old cached copy.
const url = "javascript:(function(){var s=document.createElement('script');"
  + `s.src='${SCRIPT_URL}?t='+Date.now();`
  + "s.onerror=function(){alert('Ticket check could not load. Check your connection and try again.')};"
  + 'document.body.appendChild(s);})();';

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ticket check bookmark</title>
<style>
  body { font: 16px/1.5 "Segoe UI", Arial, sans-serif; color: #1b1b1b; background: #fff; max-width: 720px; margin: 40px auto; padding: 0 16px; }
  h1 { font-size: 24px; }
  a.bm { display: inline-block; padding: 10px 18px; background: #0b2a6f; color: #fff; border-radius: 6px; text-decoration: none; font-weight: 600; }
  ol li { margin: 6px 0; }
  textarea { width: 100%; height: 120px; font: 12px Consolas, monospace; }
  .note { color: #555; font-size: 14px; }
</style>
</head>
<body>
<h1>Ticket check bookmark</h1>
<p>Drag this button to your favorites bar:</p>
<p><a class="bm" href="${escapeHtml(url)}">Ticket check</a></p>
<ol>
  <li>If the favorites bar is hidden, press Ctrl+Shift+B to show it.</li>
  <li>Sign in to ServiceNow and open any page, such as your dashboard.</li>
  <li>Click <strong>Ticket check</strong> in the favorites bar.</li>
  <li>The report opens on top of the page after a few seconds. Click Copy and paste it into Teams.</li>
</ol>
<p class="note">If dragging doesn't work: right-click the favorites bar, choose Add page, name it Ticket check, and paste everything from the box below into the URL field.</p>
<textarea readonly>${escapeHtml(url)}</textarea>
<p class="note">Each click loads the latest version of the script, so there's nothing to reinstall. The bookmark only reads tickets as you. It doesn't change anything in ServiceNow or send ticket data anywhere.</p>
</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, 'bookmark.html'), html);
console.log(`bookmark.html written (bookmark is ${url.length} characters)`);
