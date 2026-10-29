/*
 * ServiceNow ticket check
 *
 * Read-only report of which open incidents are waiting on a reply to the
 * user, which events are coming up this week, and which recently resolved
 * tickets were closed without a useful resolution note.
 *
 * How to run: sign in to ServiceNow, open any page on your instance
 * (for example your dashboard), press F12, open the Console tab, paste this
 * whole file and press Enter. The report opens in a panel on the page and
 * prints in the console. The panel's Copy button copies it as plain text.
 *
 * It only sends GET requests, as you, through your current session. It sees
 * exactly what your account can see and changes nothing.
 */
(async () => {
  // ---------------------------------------------------------------- settings
  const CONFIG = {
    // Assignment groups to check, by name or sys_id. Leave empty to use every
    // group you are a member of.
    groups: [],

    // A ticket is behind when the user has had no reply in this many days.
    behindDays: 1,

    // Start of the "since last check" window, as 'YYYY-MM-DD HH:MM:SS'.
    // null uses the time of the last report you copied, or 24 hours ago.
    since: null,

    // Date the report will be read on, as 'YYYY-MM-DD'. Events are listed for
    // the Monday to Friday week of this date. null means today, or the next
    // weekday when the script runs after 3 PM.
    readOn: null,

    // People outside the groups whose comments count as IT replies
    // (L3, Central, supervisors).
    extraStaff: [],

    // Tickets to skip: automated notices nobody needs to answer.
    skipPatterns: [
      /\[?xerox [a-z]{2}\d+\]/i, /xerox contracted supplies/i, /automatic supplies order/i,
      /papercut mf\s+notification/i, /device not communicating/i, /end user digest/i,
      /cancellation notification/i, /order notification/i,
      /shipment notification/i, /order no:/i,
    ],

    // Words that should never appear in a resolution note.
    flagWords: ['fuck', 'shit', 'bitch', 'damn', 'stupid', 'idiot', 'dumb',
      'crap', 'wtf', 'lol'],
  };

  // ------------------------------------------------------------ plumbing
  const frameToken = () => {
    for (const f of document.querySelectorAll('iframe')) {
      try { if (f.contentWindow.g_ck) return f.contentWindow.g_ck; } catch (e) { /* other origin */ }
    }
    return null;
  };
  const token = window.g_ck || frameToken();
  if (!token) throw new Error('No ServiceNow session token found. Open a ServiceNow page while signed in and run this again.');

  const api = async (table, query, fields, limit = 1000, display = true) => {
    const url = `/api/now/table/${table}?sysparm_query=${encodeURIComponent(query)}`
      + `&sysparm_display_value=${display}&sysparm_exclude_reference_link=true`
      + `&sysparm_limit=${limit}&sysparm_fields=${fields}`;
    const res = await fetch(url, { headers: { Accept: 'application/json', 'X-UserToken': token } });
    if (res.status === 401) throw new Error('ServiceNow says you are not signed in. Sign in again and rerun.');
    if (!res.ok) throw new Error(`${table} request failed with HTTP ${res.status}`);
    return (await res.json()).result || [];
  };

  const pad = (n) => String(n).padStart(2, '0');
  const fmtDate = (d) => `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
  const fmtTime = (d) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const isoLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

  // Display values come back as "MM/DD/YYYY HH:MM:SS" or "YYYY-MM-DD HH:MM:SS".
  const parseDate = (s) => {
    if (!s) return null;
    let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})/);
    if (m) return new Date(+m[3], +m[1] - 1, +m[2], +m[4], +m[5], +m[6]);
    m = s.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
    return null;
  };

  // Splits the comments / work_notes text into separate entries.
  const JOURNAL = /(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}|\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) - (.+?) \((Work notes|Additional comments)\)\n([\s\S]*?)(?=\n\n(?:\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2}) \d{2}:\d{2}:\d{2} - |\s*$)/g;
  const journal = (text, type) => {
    const out = [];
    let m;
    JOURNAL.lastIndex = 0;
    while ((m = JOURNAL.exec(text || ''))) out.push({ at: parseDate(m[1]), by: m[2], type, text: m[4].trim() });
    return out;
  };

  const firstName = (name) => (!name || /^guest$/i.test(name) ? 'the user' : name.split(' ')[0]);
  const staffName = (name) => name || 'Unassigned';
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const shorten = (s, n) => (s.length <= n ? s : `${s.slice(0, n).replace(/\s+\S*$/, '')}...`);
  // What the user actually wrote: drops the quoted email they replied to, the
  // sign-off and the confidentiality footer (which says things like "if you
  // have received this email in error").
  const ownWords = (text) => text.replace(/reply from: \S+/, '')
    .split(/\bOn .{0,90}wrote:|\bFrom: |Get Outlook for|Sent from my|________________|\bCONFIDENTIAL\b|\bThis (e-?mail|message) (and any|contains|is intended)|\b(With gratitude|Warm regards|Kind regards|Best regards|Respectfully|Sincerely|Best),/i)[0]
    .replace(/\s+/g, ' ').trim();
  const listNames = (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);

  // ------------------------------------------------------------ panel
  // The report panel. It lives in a shadow root so ServiceNow's styles can't
  // reach it, and it uses system fonts so it never loads anything from the
  // internet. Copy still copies the plain-text report for Teams.
  const PANEL_CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .p { position: fixed; top: 14px; right: 14px; bottom: 14px; z-index: 2147483647;
      width: min(480px, calc(100vw - 28px)); display: flex; flex-direction: column;
      background: #fff; color: #0E0E10; border-radius: 20px; overflow: hidden;
      font: 14px/1.45 "Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif;
      box-shadow: 0 0 0 1px rgba(14,14,16,.08), 0 30px 80px -24px rgba(14,14,16,.45);
      animation: in .45s cubic-bezier(.22,1,.36,1); }
    @keyframes in { from { opacity: 0; transform: translateX(16px) scale(.985); } to { opacity: 1; transform: none; } }
    button { font: inherit; color: inherit; cursor: pointer; border: 0; background: none; transition: background .15s, color .15s, transform .25s cubic-bezier(.22,1,.36,1), opacity .15s; }
    button:active { transform: scale(.96); }
    button:focus-visible, [tabindex]:focus-visible { outline: 2px solid #0E0E10; outline-offset: 2px; }

    .bar { display: flex; align-items: center; gap: 10px; padding: 14px 14px 0 18px; }
    .mark { position: relative; width: 28px; height: 28px; border-radius: 9px; background: #0E0E10; display: inline-flex; align-items: center; justify-content: center; flex: none; }
    .mark::after { content: ""; position: absolute; top: -3px; right: -3px; width: 10px; height: 10px; border-radius: 50%; background: #F2541B; box-shadow: 0 0 0 2px #fff; }
    .name { font-weight: 700; font-size: 15px; letter-spacing: -.01em; flex: 1; }
    .copy { display: inline-flex; align-items: center; gap: 7px; height: 36px; padding: 0 16px; border-radius: 999px; background: #0E0E10; color: #fff; font-weight: 600; font-size: 13.5px; }
    .copy:hover { background: #2A2A2E; }
    .copy.done { background: #17714A; }
    .copy[disabled] { opacity: .35; cursor: default; }
    .x { width: 36px; height: 36px; border-radius: 999px; color: #55555C; display: inline-flex; align-items: center; justify-content: center; }
    .x:hover { background: #F3F3F1; color: #0E0E10; }

    .top { padding: 18px 18px 14px; }
    .when { font-size: 12.5px; color: #6E6E76; }
    .headline { margin: 4px 0 0; font-size: 26px; line-height: 1.12; font-weight: 700; letter-spacing: -.025em; }
    .headline .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #F2541B; margin: 0 8px 4px 0; box-shadow: 0 0 0 4px rgba(242,84,27,.15); }
    .headline .dot.ok { background: #3DAA72; box-shadow: 0 0 0 4px rgba(61,170,114,.15); }
    .summary { margin-top: 8px; font-size: 13px; color: #55555C; }

    .tabs { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 14px 14px; }
    .tabs::-webkit-scrollbar { display: none; }
    .tab { display: inline-flex; align-items: center; gap: 7px; height: 34px; padding: 0 12px; border-radius: 999px; background: #F3F3F1; color: #3A3A40; font-size: 13px; font-weight: 600; white-space: nowrap; }
    .tab:hover { background: #EAEAE7; }
    .tab i { width: 7px; height: 7px; border-radius: 50%; }
    .tab b { font-weight: 700; font-size: 12px; min-width: 18px; padding: 2px 6px; border-radius: 999px; background: #fff; color: #0E0E10; text-align: center; }
    .tab[aria-pressed="true"] { background: #0E0E10; color: #fff; }
    .tab[aria-pressed="true"] b { background: rgba(255,255,255,.18); color: #fff; }

    .body { flex: 1; min-height: 0; overflow: auto; padding: 0 14px 16px; border-top: 1px solid #EEEEEC; background: #FAFAF9; }
    .sec h3 { position: sticky; top: 0; z-index: 1; display: flex; align-items: center; gap: 8px; margin: 0; padding: 14px 4px 8px; background: #FAFAF9; font-size: 12px; font-weight: 700; color: #3A3A40; }
    .sec h3 span { font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 999px; background: #EEEEEC; color: #55555C; }
    .item { display: grid; grid-template-columns: 34px minmax(0,1fr); gap: 12px; padding: 12px; margin-bottom: 8px; border-radius: 14px; background: #fff; box-shadow: 0 0 0 1px #ECECE9; animation: up .4s cubic-bezier(.22,1,.36,1) both; }
    @keyframes up { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
    .row1 { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .who { font-weight: 700; font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .inc { font: 500 11.5px/1 "Cascadia Mono", Consolas, ui-monospace, monospace; color: #2E4FB0; flex: none; }
    .pill { margin-left: auto; flex: none; font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 999px; white-space: nowrap; line-height: 1.1; }
    .t { margin-top: 2px; font-size: 13px; font-weight: 600; color: #3A3A40; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .msg { margin-top: 4px; font-size: 13px; color: #55555C; }
    .red { background: #FDECEC; color: #B4231F; } .amber { background: #FDF3E1; color: #8A5300; }
    .blue { background: #E9F1FE; color: #1E56B8; } .green { background: #E6F6EE; color: #17714A; } .violet { background: #EFECFE; color: #5440D6; }
    .none { padding: 12px; border-radius: 14px; border: 1px dashed #DCDCD8; font-size: 13px; color: #6E6E76; }

    .av { position: relative; width: 34px; height: 34px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; overflow: hidden; flex: none; font-weight: 700; font-size: 13px; color: #0E0E10; }
    .av img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .well { margin-top: 14px; display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 14px; background: #EEF8F2; color: #17714A; font-size: 13px; font-weight: 600; }
    .stack { display: inline-flex; flex: none; }
    .stack .av { width: 28px; height: 28px; font-size: 11px; box-shadow: 0 0 0 2px #EEF8F2; }
    .stack .av + .av { margin-left: -8px; }
    .stack .more { background: #fff; color: #17714A; font-size: 10.5px; }

    .foot { display: flex; justify-content: space-between; gap: 8px; padding: 10px 18px; border-top: 1px solid #EEEEEC; font-size: 11.5px; color: #6E6E76; }
    .sk { height: 74px; border-radius: 14px; margin-top: 10px; background: linear-gradient(90deg, #F0F0EE 0%, #F8F8F6 50%, #F0F0EE 100%); background-size: 200% 100%; animation: sh 1.1s linear infinite; }
    .sk.short { height: 22px; width: 60%; margin: 6px 0 0; border-radius: 8px; }
    @keyframes sh { from { background-position: 200% 0; } to { background-position: -200% 0; } }
    .err { margin: 18px 4px; padding: 16px; border-radius: 14px; background: #FDECEC; color: #8F1C18; font-size: 13.5px; }
    .err b { display: block; font-size: 15px; margin-bottom: 4px; color: #6E1512; }
    @media (prefers-reduced-motion: reduce) { .p, .item, .sk { animation: none; } button:active { transform: none; } }
  `;
  const ICON_CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>';
  const ICON_COPY = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
  const ICON_X = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const AV_COLORS = ['#E7E2FF', '#D7F3E5', '#DBE8FF', '#FFE6CF', '#FDE2EC', '#E3F1F6', '#F3ECD2', '#ECE2FF'];

  // Small element builder. Text always goes in as textContent, never as HTML.
  const h = (tag, cls, ...kids) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    kids.flat().forEach((k) => { if (k != null && k !== false) el.append(k.nodeType ? k : String(k)); });
    return el;
  };
  const icon = (svg) => { const s = document.createElement('span'); s.innerHTML = svg; s.style.display = 'inline-flex'; return s; };

  const openPanel = () => {
    document.getElementById('ticket-check-panel')?.remove();
    const host = document.createElement('div');
    host.id = 'ticket-check-panel';
    const root = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = PANEL_CSS;
    const box = h('div', 'p');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Ticket check');
    root.append(style, box);
    document.body.append(host);
    const close = () => { host.remove(); document.removeEventListener('keydown', onKey, true); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey, true);

    // Profile pictures: initials right away, the person's ServiceNow photo
    // once it loads (see setPhotos). A photo that fails to load is dropped.
    const photos = {};
    const avatars = [];
    const avatar = (name) => {
      const n = name || '?';
      let sum = 0; for (const c of n) sum += c.charCodeAt(0);
      const el = h('span', 'av', n === 'Unassigned' ? '?' : n.trim()[0]);
      el.style.background = AV_COLORS[sum % AV_COLORS.length];
      el.title = n;
      avatars.push([n, el]);
      if (photos[n]) addPhoto(el, photos[n]);
      return el;
    };
    const addPhoto = (el, src) => {
      if (el.querySelector('img')) return;
      const img = document.createElement('img');
      img.alt = '';
      img.onerror = () => img.remove();
      img.src = src;
      el.append(img);
    };

    const bar = (copyBtn) => {
      const x = h('button', 'x', icon(ICON_X));
      x.setAttribute('aria-label', 'Close');
      x.onclick = close;
      return h('div', 'bar', h('span', 'mark', icon(ICON_CHECK)), h('span', 'name', 'Ticket check'), copyBtn, x);
    };

    // Loading state while the tickets come back.
    const waitCopy = h('button', 'copy', icon(ICON_COPY), 'Copy');
    waitCopy.disabled = true;
    box.append(bar(waitCopy),
      h('div', 'top', h('div', 'when', 'Reading your tickets...'), h('div', 'sk short'), h('div', 'sk short')),
      h('div', 'body', h('div', 'sk'), h('div', 'sk'), h('div', 'sk')));

    return {
      setPhotos(map) {
        Object.assign(photos, map);
        avatars.forEach(([n, el]) => { if (photos[n]) addPhoto(el, photos[n]); });
      },
      fail(message) {
        box.textContent = '';
        const done = h('button', 'copy', 'Close');
        done.onclick = close;
        box.append(bar(h('span')), h('div', 'body', h('div', 'err', h('b', '', "Ticket check couldn't finish"), message)),
          h('div', 'foot', h('span', '', 'Nothing was changed in ServiceNow.'), done));
      },
      show(model, text, onCopy) {
        box.textContent = '';
        avatars.length = 0;
        const copy = h('button', 'copy', icon(ICON_COPY), 'Copy');
        copy.onclick = async () => {
          try {
            // Formatted for Teams and Outlook, plain text everywhere else.
            if (model.html && window.ClipboardItem) {
              await navigator.clipboard.write([new ClipboardItem({
                'text/html': new Blob([model.html], { type: 'text/html' }),
                'text/plain': new Blob([text], { type: 'text/plain' }),
              })]);
            } else await navigator.clipboard.writeText(text);
          } catch (e) {
            const ta = document.createElement('textarea'); ta.value = text; document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove();
          }
          if (onCopy) onCopy();
          copy.classList.add('done');
          copy.textContent = ''; copy.append(icon(ICON_CHECK), 'Copied');
          setTimeout(() => { copy.classList.remove('done'); copy.textContent = ''; copy.append(icon(ICON_COPY), 'Copy'); }, 1800);
        };

        const dot = h('span', `dot${model.waiting ? '' : ' ok'}`);
        const top = h('div', 'top', h('div', 'when', model.when), h('h2', 'headline', dot, model.headline), h('p', 'summary', model.summary));

        let filter = 'all';
        const body = h('div', 'body');
        const tabs = h('div', 'tabs');
        tabs.setAttribute('role', 'group');
        tabs.setAttribute('aria-label', 'Show');
        const tabEls = [{ key: 'all', label: 'All', n: model.sections.reduce((a, s) => a + s.items.length, 0) }, ...model.tabs].map((t) => {
          const b = h('button', 'tab', t.color ? h('i') : null, t.label, h('b', '', t.n));
          if (t.color) b.querySelector('i').style.background = t.color;
          b.onclick = () => { filter = t.key; render(); };
          tabs.append(b);
          return [t.key, b];
        });

        const render = () => {
          tabEls.forEach(([k, b]) => b.setAttribute('aria-pressed', String(filter === k)));
          body.textContent = '';
          model.sections.filter((s) => filter === 'all' || s.key === filter).forEach((sec) => {
            const wrap = h('section', 'sec', h('h3', '', sec.title, h('span', '', sec.items.length)));
            if (!sec.items.length) wrap.append(h('div', 'none', sec.empty));
            sec.items.forEach((it, i) => {
              const row = h('div', 'item', avatar(it.who),
                h('div', '', h('div', 'row1', h('span', 'who', it.who), h('span', 'inc', it.inc), h('span', `pill ${it.tone}`, it.pill)),
                  h('div', 't', it.title), h('div', 'msg', it.msg)));
              row.style.animationDelay = `${Math.min(i, 8) * 35}ms`;
              wrap.append(row);
            });
            body.append(wrap);
          });
          if (filter === 'all' && model.doingWell.length) {
            const people = model.doingWell;
            const stack = h('span', 'stack', people.slice(0, 4).map(avatar), people.length > 4 ? h('span', 'av more', `+${people.length - 4}`) : null);
            body.append(h('div', 'well', stack, `${listNames(people)} ${people.length === 1 ? 'has' : 'have'} nothing waiting on a reply.`));
          }
        };
        render();
        box.append(bar(copy), top, tabs, body,
          h('div', 'foot', h('span', '', 'Read-only. Nothing leaves your browser.'), h('span', '', 'Esc to close')));
      },
    };
  };

  const panel = openPanel();
  document.getElementById('ticket-check-panel').tcFail = panel.fail;

  // ------------------------------------------------------------ time window
  const now = new Date();
  const lastRunKey = 'ticketCheck.lastRun';
  let since = CONFIG.since ? parseDate(CONFIG.since) : null;
  if (!since) {
    try { since = parseDate(localStorage.getItem(lastRunKey)); } catch (e) { /* storage blocked */ }
  }
  if (!since) since = new Date(now.getTime() - 24 * 3600e3);

  let readOn = CONFIG.readOn ? new Date(`${CONFIG.readOn}T09:00:00`) : new Date(now);
  if (!CONFIG.readOn && now.getHours() >= 15) readOn.setDate(readOn.getDate() + 1);
  while (readOn.getDay() === 0 || readOn.getDay() === 6) readOn.setDate(readOn.getDate() + 1);
  const weekStart = new Date(readOn); weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - (weekStart.getDay() - 1));
  const weekDays = [0, 1, 2, 3, 4].map((i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; });

  // ------------------------------------------------------------ groups and staff
  let groups;
  if (CONFIG.groups.length) {
    const ids = CONFIG.groups.filter((g) => /^[0-9a-f]{32}$/.test(g));
    const names = CONFIG.groups.filter((g) => !/^[0-9a-f]{32}$/.test(g));
    const q = [ids.length ? `sys_idIN${ids.join(',')}` : '', names.length ? `nameIN${names.join(',')}` : ''].filter(Boolean).join('^OR');
    groups = await api('sys_user_group', q, 'sys_id,name');
  } else {
    const mine = await api('sys_user_grmember', 'user=javascript:gs.getUserID()', 'group.sys_id,group.name');
    groups = mine.map((m) => ({ sys_id: m['group.sys_id'], name: m['group.name'] }));
  }
  if (!groups.length) throw new Error('No assignment groups found. Put your group name in CONFIG.groups.');
  const groupIds = groups.map((g) => g.sys_id).join(',');

  // ------------------------------------------------------------ tickets
  const FIELDS = 'number,short_description,description,state,hold_reason,assignment_group,assigned_to,caller_id,'
    + 'contact_type,opened_at,resolved_at,close_notes,comments,work_notes';
  const sinceQ = `javascript:gs.dateGenerate('${isoLocal(since).slice(0, 10)}','${isoLocal(since).slice(11)}')`;
  const open = await api('incident', `assignment_groupIN${groupIds}^active=true^stateNOT IN6,7,8`, FIELDS);
  const resolved = await api('incident', `assignment_groupIN${groupIds}^resolved_at>=${sinceQ}`, FIELDS);
  // Automated notices (End User Digest, Xerox and so on) don't count as new tickets.
  const opened = (await api('incident', `assignment_groupIN${groupIds}^opened_at>=${sinceQ}`, 'number,short_description'))
    .filter((t) => !CONFIG.skipPatterns.some((p) => p.test(t.short_description)));

  // Staff are the members of the groups that actually own these tickets, plus
  // anyone assigned one. Groups with no tickets (like an all-employees group)
  // are left out so their members still count as users.
  const owning = new Set([...open, ...resolved].map((t) => t.assignment_group));
  const usedGroups = groups.filter((g) => owning.has(g.name));
  const members = usedGroups.length
    ? await api('sys_user_grmember', `groupIN${usedGroups.map((g) => g.sys_id).join(',')}`, 'user.name', 2000)
    : [];
  const staff = new Set([...members.map((m) => m['user.name']), ...CONFIG.extraStaff].filter(Boolean));
  [...open, ...resolved].forEach((t) => t.assigned_to && staff.add(t.assigned_to));
  // Only IT can write work notes, so anyone who wrote one counts as staff.
  // This picks up L3 and Central people who aren't in your groups.
  [...open, ...resolved].forEach((t) => journal(t.work_notes, 'note')
    .forEach((n) => { if (!/^guest$/i.test(n.by)) staff.add(n.by); }));

  const prepare = (t) => {
    const comments = journal(t.comments, 'comment');
    const notes = journal(t.work_notes, 'note');
    // A comment is from IT when the writer is known staff, or when someone
    // other than the caller typed it into ServiceNow (user replies arrive by
    // email and start with "reply from:"). The second part catches former
    // staff and Central people. Over 12 months it misread 2 of ~6,700 comments.
    const isStaff = (c) => c.by !== t.caller_id
      && (staff.has(c.by) || (!/^guest$/i.test(c.by) && !/^reply from:/i.test(c.text)));
    const replies = comments.filter((c) => isStaff(c)).sort((a, b) => b.at - a.at);
    const userMsgs = comments.filter((c) => !isStaff(c)).sort((a, b) => b.at - a.at);
    return {
      ...t, comments, notes, replies, userMsgs,
      skip: CONFIG.skipPatterns.some((p) => p.test(t.short_description)) || staff.has(t.caller_id),
      lastReply: replies[0] || null,
      lastUser: userMsgs[0] || null,
      title: shorten(clean(t.short_description), 60) || 'no title',
    };
  };
  const openAll = open.map(prepare);
  const openT = openAll.filter((t) => !t.skip);
  const resolvedT = resolved.map(prepare).filter((t) => !t.skip);

  // ------------------------------------------------------------ events this week
  const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const dayPatterns = (d) => {
    const m = d.getMonth() + 1; const day = d.getDate(); const mon = MONTHS[d.getMonth()];
    // The lookarounds stop "7/6/25" from matching as 6/25, and a date with a
    // different year from matching at all.
    return new RegExp(`(?:(?<![\\d/.-])0?${m}[/.-]0?${day}(?:[/.-](?:20)?${String(d.getFullYear()).slice(2)})?(?![\\d:]|[/.-]\\d)`
      + `|\\b(?:${mon}|${mon.slice(0, 3)})\\.? ${day}(?:st|nd|rd|th)?\\b)`, 'i');
  };
  const TIME = /\b\d{1,2}(?::\d{2})?\s?(?:am|pm|a\.m\.|p\.m\.)(?:\s?(?:-|to|–)\s?\d{1,2}(?::\d{2})?\s?(?:am|pm|a\.m\.|p\.m\.))?/i;
  const ROOM = /\b(?:room|rm\.?)\s*[a-z]?\d{2,4}[a-z]?\b|\b\d{2}-\d{3}\b|\batrium\b/i;
  // Something only counts as an event when the title or the text around the
  // date says so, which keeps election deadlines and login dates out.
  const EVENT_WORDS = /\b(event|session|meeting|summit|set ?up|workshop|presentation|training|webinar|conference|orientation|ceremony|program|council|q&a|panel|fair|common hour|booth)\b/i;
  // Lines like "Sent: Wednesday, October 14, 2026 11:23 AM" or "On Tue, Oct 13, 2026 at 11:27 AM ... wrote:".
  const EMAIL_STAMP = /\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,? [a-z]+\.? \d{1,2},? \d{4},? (at )?\d{1,2}:\d{2}/i;
  // Dates that aren't events: deadlines, date ranges, loan due dates, policy
  // start dates ("Beginning October 24, all students are required...") and
  // elections.
  const NOT_EVENT = /\b(deadline|due|period|submit|until|loan|beginning|required|starting|election|end of (the )?day)\b/i;
  // "Tomorrow" or "today" in place of a date. Tested on 3 years of tickets:
  // it only counts with a time, a room or equipment on the same line, and
  // never for logins, MFA or someone's availability.
  const REL_DAY = /\b(tomorrow|today|tonight|this (morning|afternoon|evening))\b/i;
  const NOT_SUPPORT = /\b(mfa|multi-?factor|authenticat\w*|password|log ?in|sign ?in|duo|registration is open|availab\w*)\b/i;
  const EQUIPMENT = /\b(laptops?|scanners?|mics?|microphones?|projectors?|webcams?|cameras?|zoom|speakers?|monitors?|tvs?|clickers?)\b/i;
  const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  const WEEKDAY = new RegExp(`\\b(?:on|this|this coming)\\s+(${WEEKDAYS.join('|')})\\b(?!,? (?:${MONTHS.join('|')}|\\d)| (?:mornings|afternoons|evenings|nights))`, 'i');
  // Weekday lines about something that already happened, a laptop return or
  // a start date aren't events. Tested on 3 years of tickets.
  const NOT_UPCOMING = /\b(was|were|had|came|returned|borrowed|received|took place|went|happened|last|ago|return|returning|drop(ping)? (it |the \w+ )?off|next week|start (on|date))\b/i;
  const events = [];
  // An event has passed once its day is over, or on the day itself once its
  // start time has gone by.
  const eventPassed = (e) => {
    const today = new Date(now.toDateString());
    if (e.day < today) return true;
    if (e.day > today || !e.time) return false;
    const m = e.time.match(/^(\d{1,2})(?::(\d{2}))?\s?(am|pm|a\.m\.|p\.m\.)?/i);
    const ampm = m[3] || (e.time.match(/(am|pm|a\.m\.|p\.m\.)\s*$/i) || [])[1] || '';
    let hour = +m[1] % 12;
    if (/^p/i.test(ampm)) hour += 12;
    const start = new Date(e.day);
    start.setHours(hour, +(m[2] || 0));
    return start < now;
  };
  // A staff entry like "new date Tuesday the 27th 10 am" or "moved to 10/27"
  // means the date in the ticket text is out of date. The new date is read as
  // the next matching day on or after the original one.
  const MOVED = /\b(new date|moved (it )?to|rescheduled|reschedule[ds]? (it )?(to|for)|postponed|pushed (back )?to|changed (it )?to)\b/i;
  const newDateIn = (text, from) => {
    let m = text.match(/(?<![\d/])(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?![\d/])/);
    if (m) return new Date(m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : from.getFullYear(), +m[1] - 1, +m[2]);
    m = text.match(new RegExp(`\\b(${MONTHS.join('|')}|${MONTHS.map((x) => x.slice(0, 3)).join('|')})\\.? (\\d{1,2})(?:st|nd|rd|th)?\\b`, 'i'));
    if (m) return new Date(from.getFullYear(), MONTHS.findIndex((x) => x.startsWith(m[1].toLowerCase().slice(0, 3))), +m[2]);
    m = text.match(/\b(?:the )?(\d{1,2})(?:st|nd|rd|th)\b/i);
    if (m) {
      const d = new Date(from.getFullYear(), from.getMonth(), +m[1]);
      if (d < from) d.setMonth(d.getMonth() + 1);
      return d;
    }
    return null;
  };
  const moves = new Map();
  // Events come from every open ticket, including ones staff opened for themselves.
  for (const t of openAll.filter((x) => !CONFIG.skipPatterns.some((p) => p.test(x.short_description)))) {
    // Only the user's own words count, not the email of ours they quoted back.
    const text = [t.short_description, t.description, ...t.userMsgs.map((c) => ownWords(c.text))].join('\n');
    // New-hire notices carry a start date, not an event.
    if (/\b(new hire|start date|first day)\b/i.test(t.short_description)) continue;
    const lines = text.split(/\r?\n/).filter((l) => !/^\s*>/.test(l) && !/\b(sent|date|received|subject):/i.test(l) && !/\bwrote:/i.test(l)
      && !EMAIL_STAMP.test(l) && !/screen ?shot|\[image|\.(png|jpe?g|gif)\b|undeliverable/i.test(l));
    // Prefer a date in the title, then the first date in the body. A title
    // date only counts when the title is about an event or a support request,
    // so "Payment Report Released 11/7/2025" isn't an event.
    const titleIsSupport = EVENT_WORDS.test(t.short_description)
      || /\b(request|support|laptops?|scanners?|reader|mics?|microphones?|zoom|moves?|tasks?|equipment|install|upgrade|visit|cards?|room|tech)\b/i.test(t.short_description);
    const titleDay = titleIsSupport && !NOT_EVENT.test(t.short_description)
      ? weekDays.find((d) => dayPatterns(d).test(t.short_description)) : undefined;
    let found = null;
    for (const d of titleDay ? [titleDay] : weekDays) {
      // Deadlines and date ranges ("submit by", "Campaign Period: October 13 to 16") aren't events.
      const idx = lines.findIndex((l) => dayPatterns(d).test(l) && !NOT_EVENT.test(l));
      if (idx < 0) continue;
      const near = lines.slice(Math.max(0, idx - 2), idx + 4).join(' ');
      // The event word has to sit near the date, or the date has to be in the
      // title. An event word in the title alone isn't enough: a "Faculty
      // Council" nomination email full of election dates isn't an event.
      if (d !== titleDay && !EVENT_WORDS.test(near) && !/\bwhen:/i.test(lines[idx])) continue;
      found = { t, day: d, time: (lines[idx].match(TIME) || near.match(TIME) || [])[0], room: (near.match(ROOM) || [])[0] };
      break;
    }
    // No date, but "tomorrow" or "today": count from the day it was opened.
    if (!found) {
      const openedDay = parseDate(t.opened_at);
      const rel = [t.short_description, ...(t.description || '').split(/\r?\n|(?<=[.!?])\s+/)]
        .find((l) => REL_DAY.test(l) && (EVENT_WORDS.test(l) || EVENT_WORDS.test(t.short_description))
          && !NOT_EVENT.test(l) && !NOT_SUPPORT.test(l) && !NOT_SUPPORT.test(t.short_description)
          && (TIME.test(l) || ROOM.test(l) || EQUIPMENT.test(l) || TIME.test(t.short_description) || ROOM.test(t.short_description)));
      if (openedDay && rel) {
        const day = new Date(openedDay);
        day.setHours(0, 0, 0, 0);
        if (/tomorrow/i.test(rel.match(REL_DAY)[0])) day.setDate(day.getDate() + 1);
        const inWeek = weekDays.find((d) => d.toDateString() === day.toDateString());
        if (inWeek) found = { t, day: inWeek, time: (rel.match(TIME) || t.short_description.match(TIME) || [])[0], room: (rel.match(ROOM) || [])[0] };
      }
    }
    // No date, but a weekday ("our event on Thursday"): the first such day
    // after the ticket was opened. "Next Thursday" is left out, since people
    // use it for both this week and the one after.
    if (!found) {
      const openedDay = parseDate(t.opened_at);
      const rel = openedDay && [t.short_description, ...(t.description || '').split(/\r?\n|(?<=[.!?])\s+/)]
        .find((l) => WEEKDAY.test(l) && !NOT_UPCOMING.test(l) && (EVENT_WORDS.test(l) || EVENT_WORDS.test(t.short_description) || EQUIPMENT.test(l))
          && !NOT_EVENT.test(l) && !NOT_SUPPORT.test(l) && !NOT_SUPPORT.test(t.short_description) && !EMAIL_STAMP.test(l));
      if (rel) {
        const want = WEEKDAYS.indexOf(rel.match(WEEKDAY)[1].toLowerCase()) + 1;
        const day = new Date(openedDay);
        day.setHours(0, 0, 0, 0);
        do day.setDate(day.getDate() + 1); while (day.getDay() !== want);
        const inWeek = weekDays.find((d) => d.toDateString() === day.toDateString());
        if (inWeek) found = { t, day: inWeek, time: (rel.match(TIME) || t.short_description.match(TIME) || [])[0], room: (rel.match(ROOM) || [])[0] };
      }
    }
    // No time next to the date: take it from a later message or staff note
    // that names the same day ("Atrium at 1 pm on Thursday").
    if (found && !found.time) {
      const dayName = new RegExp(`\\b${WEEKDAYS[found.day.getDay() - 1]}\\b`, 'i');
      const lines = [...t.userMsgs.map((c) => ownWords(c.text)), ...[...t.notes, ...t.replies].filter((e) => staff.has(e.by)).map((e) => e.text)]
        .flatMap((x) => x.split(/\r?\n/))
        .filter((l) => (dayName.test(l) || dayPatterns(found.day).test(l)) && TIME.test(l) && !MOVED.test(l) && !EMAIL_STAMP.test(l));
      // "The event starts at 4pm" beats "we can set up at 3pm".
      const hit = lines.find((l) => /\b(event|starts?|begins?)\b/i.test(l)) || lines[0];
      if (hit) found = { ...found, time: hit.match(TIME)[0], room: found.room || (hit.match(ROOM) || [])[0] };
    }
    if (found) {
      const note = [...t.notes, ...t.replies].filter((e) => staff.has(e.by) && MOVED.test(e.text)).sort((a, b) => b.at - a.at)[0];
      const to = note && newDateIn(note.text, found.day);
      if (to && to.toDateString() !== found.day.toDateString()) {
        moves.set(t, { from: found.day, to, time: (note.text.match(TIME) || [])[0], note });
        // It stays in this week's list only if the new date is still this week.
        const inWeek = weekDays.find((d) => d.toDateString() === to.toDateString());
        if (inWeek) events.push({ ...found, day: inWeek, time: (note.text.match(TIME) || [])[0] || found.time });
      } else {
        events.push(found);
      }
    }
  }
  events.sort((a, b) => a.day - b.day);

  // ------------------------------------------------------------ who is behind
  const dayMs = 24 * 3600e3;
  // A user message needs no answer when it's a thank-you or an "I'll get back
  // to you" and doesn't ask for anything. Tested against 12 months of tickets.
  const ACK = /\b(thank(s| you)|appreciate|sounds good|all set|got it|keep (me|us) posted|will (try|keep|let you know|reach out|update|check)|i'?ll (check|try|let you know)|still out|haven'?t heard back|it works|works now|working (fine|now|again|great|well)|running smoothly|was able to|all good|no worries|(coming|heading) (down|over)|on my way|be there shortly)\b/i;
  const ASK = /\b(not working|doesn'?t work|isn'?t working|can'?t|cannot|unable|not (been )?able|do not|does not|doesn'?t|don'?t have|error|however|but now|now it|still (not|can|getting|having|needs?|experiencing|seeing|stuck)|difficult(y|ies)|keep getting|every ?time|issue|problem|needs?|could|can you|can we|can someone|would you|if anyone|want you|let me know|would appreciate|would like|i'?d like|change it|screen ?shot|attached|find below|request|works for me|i'?m available|i am available|i can (do|come|meet|make)|asking|wondering|extension|kicked|but (it|i|the|then)|please (?!keep|feel free|disregard)\w+)\b/i;
  const isAck = (text) => { const b = ownWords(text); return ACK.test(b) && !b.includes('?') && !ASK.test(b) && b.length <= 500; };
  const GREETING = /^(hello|hi|hey|dear|good (morning|afternoon|evening))\b/i;
  // Work notes that greet a colleague ("Hi Sam", "Good afternoon, everyone")
  // or are the user's own email pasted in aren't messages meant for the user.
  const staffFirst = [...staff].map((n) => n.split(' ')[0].toLowerCase()).filter((n) => n.length >= 3);
  const addressedToStaff = (text) => {
    const m = text.match(/^(?:hello|hi|hey|dear|good (?:morning|afternoon|evening))[ ,!]*(?:and happy \w+,? )?([^,\n!.]{0,40})/i);
    if (!m) return false;
    const words = m[1].toLowerCase().split(/[\s,]+/).filter(Boolean);
    if (words.some((w) => /^(team|everyone|all|guys|colleagues|folks)$/.test(w))) return true;
    return words.some((w) => w.length >= 3 && staffFirst.some((s) => s.startsWith(w) || w.startsWith(s)));
  };
  const signedByUser = (text, t) => {
    const cal = firstName(t.caller_id);
    return cal !== 'the user' && new RegExp(`(regards|sincerely|best|thanks|warmly)[,!.]?\\s*${cal}\\b`, 'i').test(text);
  };
  // Duplicates: a staff note or comment that says "duplicate", on a ticket whose
  // caller has another open ticket that it names or that is for the same event
  // day. The twin with the newest reply is the one being worked; the other one
  // just needs closing or linking.
  const dupOf = new Map();
  for (const t of openT) {
    const entries = [...t.notes, ...t.replies].filter((e) => staff.has(e.by));
    if (!entries.some((e) => /\bduplicat/i.test(e.text)) || !t.caller_id || /^guest$/i.test(t.caller_id)) continue;
    const named = entries.flatMap((e) => e.text.match(/INC\d{7}/g) || []);
    const day = events.find((e) => e.t === t)?.day?.toDateString();
    const twin = openT.find((o) => o !== t && (named.includes(o.number)
      || (o.caller_id === t.caller_id && day && events.find((e) => e.t === o)?.day?.toDateString() === day)));
    if (twin && twin.lastReply && (!t.lastReply || twin.lastReply.at > t.lastReply.at)) dupOf.set(t, twin);
  }
  for (let i = events.length - 1; i >= 0; i -= 1) if (dupOf.has(events[i].t)) events.splice(i, 1);

  // "I'll keep you updated" from IT means the next step is ours, even when the
  // ticket is on hold for the user.
  const PROMISE = /\b(i'?ll|i will|we'?ll|we will)\s+(keep you (updated|posted|informed)|let you know|update you|provide (you with )?an update|get back to you|follow up with you|reach out (to you )?(once|when|as soon))/i;

  // Work notes that only say the ticket is still being worked on.
  const STATUS_NOTE = /^((the )?ticket (is )?(still )?in progress|in progress|(i am |i'?m |we are |we'?re )?still working on (this|it)|working on (this|it)|no update( yet)?( on this( request)?)?|still waiting( on central| for central)?|waiting (on|for) (central|updates?|an update)|waiting for (a )?response|awaiting (a )?response|assisting( user)?|will help|please (assist|help))\.?$/i;

  const behind = [];
  for (const t of openT) {
    const who = firstName(t.caller_id);
    const owner = staffName(t.assigned_to);
    const age = t.lastReply ? (now - t.lastReply.at) / dayMs : Infinity;
    // "Thanks, keep me posted" or "he's still out" doesn't need an answer.
    const userWroteLast = t.lastUser && (!t.lastReply || t.lastUser.at > t.lastReply.at);
    // Read every message since our last reply, not just the newest: users
    // often send "Could I visit tomorrow?" and then "Thank you" a second later.
    const unanswered = t.userMsgs.filter((m) => !t.lastReply || m.at > t.lastReply.at);
    const userAcked = userWroteLast && unanswered.every((m) => isAck(m.text));
    const userWaiting = userWroteLast && !userAcked;
    const onHoldForUser = /awaiting caller|awaiting evidence/i.test(t.hold_reason || '');
    // The newest work note, when it's newer than our last reply, often says
    // the ticket is really waiting on someone else.
    const newerNote = t.notes.filter((n) => staff.has(n.by) && (!t.lastReply || n.at > t.lastReply.at))
      .sort((a, b) => b.at - a.at)[0];
    // A work note that greets the user and signs off was meant for the user.
    const strandedNote = t.notes.find((n) => staff.has(n.by) && GREETING.test(n.text)
      && !addressedToStaff(n.text) && !signedByUser(n.text, t)
      && (!t.lastReply || n.at > t.lastReply.at)
      && ((who !== 'the user' && n.text.includes(who)) || /\b(best|regards|it helpdesk)\b/i.test(n.text))
      // Skip it if the same message was also posted as a comment.
      && !t.replies.some((r) => r.text.slice(0, 60) === n.text.slice(0, 60)));
    const event = events.find((e) => e.t === t);
    const twin = dupOf.get(t);
    const moved = moves.get(t);
    let line = null;
    // The short label and color the panel shows next to the ticket.
    let pill = 'Update due'; let tone = 'amber';

    if (strandedNote) {
      line = `the ${fmtDate(strandedNote.at)} message to ${who} was saved as a work note, so ${who} never got it. Post it as a comment.`;
      pill = 'Work note'; tone = 'red';
    } else if (twin) {
      line = `this is a duplicate of ${twin.number}, where ${who} got a reply on ${fmtDate(twin.lastReply.at)}. Close it as a duplicate or link the two.`;
      pill = 'Duplicate';
    } else if (event && eventPassed(event)) {
      line = `the event was on ${fmtDate(event.day)} and the ticket is still open. Confirm it was covered and close it.`;
      pill = 'Close it';
    } else if (userWaiting) {
      line = `${who} wrote on ${fmtDate(t.lastUser.at)} and nobody has answered yet.`
        + (t.assigned_to ? ` ${owner} should reply.` : ' Nobody is assigned yet.');
      pill = 'User waiting'; tone = 'red';
    } else if (moved && (!t.lastReply || t.lastReply.at < moved.note.at)) {
      line = `the event moved from ${fmtDate(moved.from)} to ${fmtDate(moved.to)}${moved.time ? ` at ${moved.time}` : ''} (${fmtDate(moved.note.at)} ${moved.note.type === 'note' ? 'work note' : 'comment'}), `
        + `but ${who} hasn't had a comment confirming it${t.lastReply ? ` since ${fmtDate(t.lastReply.at)}` : ''}. ${owner} should confirm the new date with ${who} in a comment.`;
      pill = 'Confirm date';
    } else if (userAcked && onHoldForUser) {
      // On hold and the user said they'll get back to us ("he's still out"):
      // nothing is owed yet.
      line = null;
    } else if (!t.lastReply) {
      line = `${who} hasn't had any reply since the ticket was opened on ${fmtDate(parseDate(t.opened_at))}.`
        + (t.assigned_to ? ` ${owner} should reply.` : ' Nobody is assigned yet.');
      pill = 'No reply'; tone = 'red';
    } else if (age >= CONFIG.behindDays) {
      // The team rule is one follow-up per clock-in, so count the days we
      // followed up on, not the replies. Two replies on the same day (or the
      // same reply posted twice) count once.
      const sinceUser = t.lastUser ? t.replies.filter((r) => r.at > t.lastUser.at) : t.replies;
      // A promise to update the user restarts the count: only follow-ups
      // after it are asking the user for something.
      const promise = sinceUser.filter((r) => PROMISE.test(ownWords(r.text))).sort((a, b) => b.at - a.at)[0];
      const asking = (promise ? sinceUser.filter((r) => r.at > promise.at) : sinceUser).sort((a, b) => a.at - b.at);
      // The first reply answers the user or asks them something; only the
      // ones after it are follow-ups. Re-posting the same message on a later
      // day does count: that's how the team usually follows up.
      const firstDay = !promise && asking.length ? asking[0].at.toDateString() : null;
      const followUps = new Set(asking.map((r) => r.at.toDateString()).filter((d) => d !== firstDay)).size;
      line = `${who} hasn't had a reply since ${fmtDate(t.lastReply.at)}`
        + `${t.lastReply.by !== t.assigned_to ? ` (that one was from ${staffName(t.lastReply.by)})` : ''}.`;
      // Status-only work notes since the last reply ("Ticket in progress",
      // "I am still working on this", the same note pasted every day). The
      // user can't see any of them, so the update never reaches them.
      const notesSince = t.notes.filter((n) => n.at > t.lastReply.at);
      const fillers = notesSince.filter((n) => STATUS_NOTE.test(clean(n.text))
        || notesSince.filter((o) => clean(o.text) === clean(n.text)).length >= 2);
      let postIt = false;
      if (fillers.length >= 2) {
        line += ` Since then there are only work notes like "${shorten(clean(fillers[0].text), 50)}", which ${who} can't see.`;
        if (!onHoldForUser) { line += ' Post the update as a comment.'; postIt = true; }
      }
      if (promise && onHoldForUser) {
        line += ` IT told ${who} on ${fmtDate(promise.at)} it would keep them updated, so check that work is done before closing.`
          + (followUps < 3 ? ` Follow-ups since then: ${followUps} of 3.` : '');
        pill = 'Check hold';
      } else if (onHoldForUser && followUps >= 3 && newerNote) {
        line += ` We've followed up on ${followUps} days, but the ${fmtDate(newerNote.at)} work note says "${shorten(clean(newerNote.text), 70)}". Check that it's really waiting on ${who} before closing it.`;
        pill = 'Check hold';
      } else if (onHoldForUser && followUps >= 3) {
        line += ` We've followed up on ${followUps} different days with no answer, so it can be closed as no response.`;
        pill = 'Close it';
      } else if (onHoldForUser) {
        line += ` Send follow-up ${followUps + 1} of 3.`;
        pill = `Follow-up ${followUps + 1}/3`;
      } else if (!promise && !/hold/i.test(t.state) && followUps >= 2) {
        // In progress, but we've been the ones writing for days: it's waiting
        // on the user, so the follow-up rule applies.
        line += followUps >= 3
          ? ` IT has written on ${followUps} days with no answer. Put it on hold awaiting caller, and close it as no response if the next follow-up isn't answered.`
          : ` We've followed up on ${followUps} days with no answer. Put it on hold awaiting caller and send follow-up ${followUps + 1} of 3.`;
        pill = 'Put on hold';
      } else if (!postIt) {
        line += ` ${owner} should send an update.`;
      }
    }
    if (line) behind.push({ t, line, pill, tone });
  }

  // ------------------------------------------------------------ resolved check
  // The closing template, so only what's left can count as saying what was
  // done. Every pattern stops within one sentence: an open-ended one once ate
  // a "Resolution Notes:" line. Tested on 9,229 resolution notes.
  const END = '(?:[.!]|$)';
  const TEMPLATE = [
    // The greeting, plus a short run of names only when it ends in a comma.
    /\b(?:[Gg]ood\s+(?:[Mm]orning|[Aa]fternoon|[Ee]vening|[Dd]ay)|[Hh]ello|[Hh]i|[Hh]ey|[Dd]ear)\b(?:\s+(?:\p{Lu}[\p{L}'.-]*(?:(?:\s+(?:and|&)\s+|\s+)\p{Lu}[\p{L}'.-]*){0,3}|[\p{L}'.-]+(?:\s+[\p{L}'.-]+)?)\s*(?=,))?\s*[,.!:]?/gu,
    /this ticket will be closed now[,.]?/gi, /we are closing this ticket[^.]*\./gi,
    new RegExp(`if you have any (further |other )?(questions?|concerns?)[^.!]*${END}`, 'gi'), new RegExp(`please (feel free|don'?t hesitate)[^.!]*${END}`, 'gi'),
    /if (any )?(other|further|more) (issues?|problems?|questions?) (occurs?|come up|arise)[^.,!]{0,120}[,.!]?/gi, new RegExp(`feel free (to )?(email|call|contact|reach|submit)[^.!]*${END}`, 'gi'),
    // Thank-you lines only in their stock forms, so "Thank you for confirming the VPN was fixed" keeps its content.
    new RegExp(`thank(s| you)?( so much)? for (stopping by|coming( in| by| to)?|calling|reaching out|contacting|your patience|letting (me|us) know|submitting|visiting|sending|using|signing)[^.!]{0,60}${END}`, 'gi'),
    /\bthank(s| you)( so much)?[,.!]*\s*$/gi, /\bthank(s| you)( so much)?[.!]/gi, /(best|kind|warm)? ?regards,?/gi, /best,/gi,
    /it helpdesk/gi, /(hope you )?have a (good|great|nice|wonderful)( rest of (the|your))? (weekend|week|day|evening|afternoon|morning|one)( and)?[!.]?/gi, new RegExp(`feel free to[^.!]*${END}`, 'gi'),
    /if you need (any )?(further|more) (assistance|help)[^.,!]{0,120}[,.!]?/gi, new RegExp(`(contact|email|call) (us|the helpdesk)[^.!]*${END}`, 'gi'), new RegExp(`we are open[^.!]*${END}`, 'gi'),
  ];
  const FILLER = /\b(the|this|that|a|an|it|is|was|has|have|had|been|be|now|will|i|we|our|you|your|issue|issues|ticket|request|problem|fixed|resolved|done|completed|complete|closed|closing|close|successfully|as|of|for|and|or|to|at|on|in|with|all|being|call|us|helpdesk|help|desk|team|today|per|inc|assisted|helped|helpded|received|progress|go|ahead|time|hope|great|good|day|weekend|give|thank|kind|if|any|further|questions|concerns|please|email|feel|free|reach|out|contact|anytime|task|dome|glad|m|since|spoke|phone|tel|about|course|solved|but|me|come|reaching|stopping|by|anything|else|question|concern|other|occur|occurs|coming|visiting|able|were|are|via|letting|know|updates?|ok|okay|not|use|may|wil|student|old|she|he|they|them|can|say|fix|log|open|hours|summer|business|mon|fri|everyone|assistance|recently|provided|solution|notified|responded|action|needed)\b/gi;
  // Staff names don't say what was done either ("Resolved by Pat").
  const STAFF_WORDS = new RegExp(`\\b(${[...new Set([...staff].flatMap((n) => n.split(/\s+/)))].map((w) => w.replace(/[^\w-]/g, '')).filter((w) => w.length > 2).join('|') || 'zzzz'})\\b`, 'gi');
  // Closed as no response. Since 10/08/2026 the team rule is follow-ups on three different days first.
  const NO_RESPONSE = /\b(no (response|reply)(?! from (central|cis|l3|the vendor))|(haven'?t|have not) heard (back )?from (you|the (user|student|caller))|since we (haven'?t|have not) heard back|we (haven'?t|have not) heard back from you|(did not|didn'?t) hear back from (you|the (user|student|caller))|(user|student|caller) (did not|didn'?t) (respond|reply)|failed to (reply|respond)|because no reply was sent|closed due to no|unresponsive|lack of response)\b/i;
  // IT's own unfinished work, or something that still has to happen. Tested on
  // 9,229 notes: 35 matches in 3 years, nearly all really unfinished.
  const PENDING = /\b((i|we)('ll| will)( be)? (contact|follow(ing)? up|update you|try again|attempt|reach out|look into|get back)|i'?ll update you|update the user once|when we have an update|we are (still )?waiting (on|for)|(clos(e|ing|ed)) (this |the )?(ticket|request|incident )?for now|for now,? (please )?(continue|use|keep)|for the time being|look into it (around|in|later)|still (working on|waiting (on|for))|(hope|need|we can|we'?ll|we will|have to)( to)? test (it |this )?again|try (to set (it )?up|again)? ?tomorrow|hope (some ?time )?soon|(?<!\bif (you|they|he|she) (are|is|'re) )(?<!\bif you )(unable|not able|wasn'?t able|couldn'?t|could not) to (set (it )?up|finish|complete)|will be (picked up|delivered|installed|replaced|shipped)|once (it|they|the (part|order|device|laptop)) (arrive|arrives|come in|comes in)|will (come|stop|swing) (in|by)|will pick (it )?up)\b|(^|[.!]\s+)will (follow up|contact|update|reach out|look into)\b/i;
  // Laptop loans are closed before the return on purpose.
  const LOAN = /\b(return|exchange|re-?check|bring (it |the \w+ )?back)\b/i;
  const pendingIn = (note) => {
    if (NO_RESPONSE.test(note)) return false;
    // Closed because the user asked ("closed for now as per your request").
    if (/\b(?:as per|per|at) your request\b|\bas you (?:requested|asked)\b/i.test(note)) return false;
    // Still asking the user to call or come in before it can be done.
    if (/\bplease (give us a call|call us|reach out to us|stop by|come (in|by)|visit us)\b[^.!?]{0,40}\bto (complete|finish)\b/i.test(note)) return true;
    const m = note.match(PENDING);
    return !!m && !(/come|stop|swing|pick/i.test(m[0]) && LOAN.test(note));
  };
  const fixes = [];
  for (const t of resolvedT) {
    const note = clean(t.close_notes);
    // Drop addresses, links and phone numbers first so their dots don't stop
    // the template patterns early.
    let left = note.replace(/\S+@\S+|https?:\/\/\S+|\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '. ');
    TEMPLATE.forEach((re) => { left = left.replace(re, ' '); });
    left = clean(left);
    const problems = [];
    const bad = CONFIG.flagWords.find((w) => new RegExp(`\\b${w}\\b`, 'i').test(note));
    if (bad) problems.push(`the resolution note contains "${bad}"`);
    if (/\b(good (morning|afternoon|evening)|hello|hi) name\b/i.test(note)) problems.push('the note still says "name" where the user\'s name should be');
    if (/no need to respond/i.test(note)) problems.push('the note tells the user not to respond');
    if (/^ticket in progress\.?$/i.test(note)) problems.push('the resolution note only says "Ticket in progress"');
    else if (!note) problems.push('there is no resolution note');
    else if (!/\b(duplicate|same (ticket|request|issue) as)\b/i.test(note) && !NO_RESPONSE.test(note)) {
      // Take out the signer's and user's names and filler words. If nothing
      // specific is left ("issue fixed.", "this is done", the closing
      // template), the note doesn't say what was done. Short notes that do
      // say something ("Mfa Reset", "They contacted HR.") pass.
      let specific = left;
      [t.assigned_to, t.caller_id].filter(Boolean).forEach((name) => name.split(' ').forEach((part) => {
        if (part.length > 2) specific = specific.replace(new RegExp(`\\b${part.replace(/[^\w-]/g, '')}\\b`, 'gi'), ' ');
      }));
      specific = specific.replace(STAFF_WORDS, ' ').replace(FILLER, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
      if (specific.length < 3) problems.push(`the note ("${shorten(note, 60)}") doesn't say what was done`);
    }
    if (pendingIn(note)) problems.push('the note says the work isn\'t finished yet');
    if (NO_RESPONSE.test(note)) {
      // Count the days IT wrote after the user's last message, leaving out
      // the closing message itself and the first reply (the answer or the
      // question), the same way open tickets are counted.
      const after = (t.lastUser ? t.replies.filter((x) => x.at > t.lastUser.at) : t.replies)
        .filter((x) => !NO_RESPONSE.test(x.text)).sort((a, b) => a.at - b.at);
      const firstDay = after.length ? after[0].at.toDateString() : null;
      const days = new Set(after.map((x) => x.at.toDateString()).filter((d) => d !== firstDay)).size;
      if (days < 3) {
        problems.push(t.lastUser && !after.length
          ? `it was closed as no response, but ${firstName(t.caller_id)} wrote last on ${fmtDate(t.lastUser.at)}`
          : days === 0 ? 'it was closed as no response without any follow-ups, and the rule is 3'
            : `it was closed as no response after follow-ups on ${days} day${days === 1 ? '' : 's'}, and the rule is 3`);
      }
    }
    // Only call out a missing reply when the user waited more than a day.
    // Same-day fixes are covered by the resolution email, and voicemail
    // tickets are answered by phone.
    const waited = (parseDate(t.resolved_at) - parseDate(t.opened_at)) / (24 * 3600e3);
    if (!t.replies.length && /email|self-service/i.test(t.contact_type || '') && waited > 1
      && !/message from unknown sender|voicemail/i.test(t.short_description)
      && !/\b(duplicate|same (ticket|request|issue) as)\b/i.test(note)) {
      problems.push(`${firstName(t.caller_id)} never got a reply in the ${Math.floor(waited)} day${Math.floor(waited) === 1 ? '' : 's'} it was open`);
    }
    if (problems.length) {
      const [pill, tone] = bad ? ['Wording', 'red']
        : problems.some((p) => /never got a reply/.test(p)) ? ['No reply', 'red']
          : problems.some((p) => /no response/.test(p)) ? ['Closed early', 'amber']
          : problems.some((p) => /isn't finished/.test(p)) ? ['Not finished', 'amber']
            : ['Weak note', 'violet'];
      fixes.push({ t, line: `${problems.join('; ')}.`.replace(/^./, (c) => c.toUpperCase()), pill, tone });
    }
  }

  // ------------------------------------------------------------ report
  const item = (t, text) => `• ${staffName(t.assigned_to)}, ${t.number} (${t.title}): ${text}`;
  const out = [];
  out.push(`Ticket check for ${fmtDate(now)}, ${fmtTime(now)}`);
  out.push(`Since ${fmtDate(since)} ${fmtTime(since)}, ${resolved.length} ticket${resolved.length === 1 ? ' was' : 's were'} resolved and ${opened.length} new one${opened.length === 1 ? '' : 's'} came in. `
    + `${behind.length} open ticket${behind.length === 1 ? ' needs' : 's need'} a reply and ${fixes.length} resolved ticket${fixes.length === 1 ? ' needs' : 's need'} a second look.`);

  out.push('', `Events this week (${fmtDate(weekDays[0])} to ${fmtDate(weekDays[4])})`);
  if (!events.length) out.push('• None found in open tickets.');
  for (const e of events) {
    const where = [e.time, e.room].filter(Boolean).join(', ');
    const status = eventPassed(e)
      ? 'It already happened and the ticket is still open.'
      : staff.has(e.t.caller_id) ? `${staffName(e.t.caller_id)} opened this ticket.` : (e.t.lastReply ? `${firstName(e.t.caller_id)} last heard from us on ${fmtDate(e.t.lastReply.at)}.` : `${firstName(e.t.caller_id)} hasn't had a reply confirming it.`);
    out.push(`• ${fmtDate(e.day)}: ${staffName(e.t.assigned_to)}, ${e.t.number} (${e.t.title})${where ? `, ${where}` : ''}. ${status}`);
  }

  const section = (title, list) => {
    out.push('', title);
    if (!list.length) out.push('• Nothing.');
    list.sort((a, b) => (a.t.assigned_to || '').localeCompare(b.t.assigned_to || '')).forEach((b) => out.push(item(b.t, b.line)));
  };
  section('In progress, needs a reply', behind.filter((b) => !/hold/i.test(b.t.state)));
  section('On hold, needs a reply', behind.filter((b) => /hold/i.test(b.t.state)));
  section('Resolved, needs a fix', fixes);

  const owners = [...new Set(openT.map((t) => t.assigned_to).filter(Boolean))];
  const caughtUp = owners.filter((o) => !behind.some((b) => b.t.assigned_to === o)).map(staffName);
  out.push('', 'Doing well');
  out.push(caughtUp.length ? `• ${listNames(caughtUp)} ${caughtUp.length === 1 ? 'has' : 'have'} nothing waiting on a reply.` : '• Everyone with open tickets has at least one waiting on a reply.');

  const report = out.join('\n');
  console.log(report);
  // The same report as HTML, so pasting into Teams or Outlook keeps bold
  // headings and bullets. Ticket numbers link to the ticket on this instance,
  // and the assignee at the start of each line is bold.
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const linked = (s) => esc(s).replace(/\bINC\d{7}\b/g,
    (n) => `<a href="${location.origin}/nav_to.do?uri=${encodeURIComponent(`incident.do?sysparm_query=number=${n}`)}">${n}</a>`);
  const htmlParts = [];
  let list = null;
  out.forEach((l, i) => {
    if (l.startsWith('• ')) {
      if (!list) { list = []; htmlParts.push(list); }
      const body = l.slice(2);
      // "Name, INC0000000 (title): ..." or "MM/DD/YYYY: Name, INC..." for events.
      const m = body.match(/^((?:\d{2}\/\d{2}\/\d{4}: )?)([^,]+)(, INC\d{7}[\s\S]*)$/);
      list.push(m ? `${esc(m[1])}<b>${esc(m[2])}</b>${linked(m[3])}` : linked(body));
      return;
    }
    list = null;
    if (!l) return;
    htmlParts.push(i === 1 ? `<p>${linked(l)}</p>` : `<p><b>${esc(l)}</b></p>`);
  });
  const reportHtml = htmlParts.map((p) => (Array.isArray(p) ? `<ul>${p.map((x) => `<li>${x}</li>`).join('')}</ul>` : p)).join('');
  // The next report starts from this one only once it's copied, so test
  // runs don't shrink tomorrow's "since last check" window.
  const markUsed = () => { try { localStorage.setItem(lastRunKey, isoLocal(now)); } catch (e) { /* storage blocked */ } };
  // The panel shows the same findings as the copied text, grouped and tagged.
  const today = new Date(now.toDateString());
  const byOwner = (a, b) => (a.t.assigned_to || '').localeCompare(b.t.assigned_to || '');
  const card = (b) => ({ who: staffName(b.t.assigned_to), inc: b.t.number, title: b.t.title,
    msg: b.line.replace(/^./, (c) => c.toUpperCase()), pill: b.pill, tone: b.tone });
  const reply = behind.filter((b) => !/hold/i.test(b.t.state)).sort(byOwner).map(card);
  const hold = behind.filter((b) => /hold/i.test(b.t.state)).sort(byOwner).map(card);
  const fix = fixes.slice().sort(byOwner).map(card);
  const eventCards = events.map((e) => {
    const passed = eventPassed(e);
    const where = [e.time, e.room].filter(Boolean).join(', ');
    const status = passed ? 'It already happened and the ticket is still open.'
      : staff.has(e.t.caller_id) ? `${staffName(e.t.caller_id)} opened this ticket.`
        : (e.t.lastReply ? `${firstName(e.t.caller_id)} last heard from us on ${fmtDate(e.t.lastReply.at)}.` : `${firstName(e.t.caller_id)} hasn't had a reply confirming it.`);
    return { who: staffName(e.t.assigned_to), inc: e.t.number, title: e.t.title,
      msg: `${fmtDate(e.day)}${where ? `, ${where}` : ''}. ${status}`,
      pill: passed ? 'Passed' : `${e.day.toLocaleDateString('en-US', { weekday: 'short' })} ${e.day.getMonth() + 1}/${e.day.getDate()}`,
      tone: passed ? 'amber' : 'blue' };
  });
  const needReply = reply.length + hold.length;
  panel.show({
    when: `${fmtDate(now)}, ${fmtTime(now)} · since ${fmtDate(since)} ${fmtTime(since)}`,
    waiting: needReply > 0,
    headline: needReply ? `${needReply} ticket${needReply === 1 ? ' needs' : 's need'} a reply` : 'Everyone has had a reply',
    summary: out[1],
    tabs: [
      { key: 'reply', n: reply.length, label: 'Need a reply', color: '#E5484D' },
      { key: 'hold', n: hold.length, label: 'On hold', color: '#F2A43A' },
      { key: 'events', n: events.length, label: 'Events', color: '#3E7BEA' },
      { key: 'fix', n: fix.length, label: 'To fix', color: '#6E5CE6' },
    ],
    sections: [
      { key: 'events', title: `Events this week, ${fmtDate(weekDays[0])} to ${fmtDate(weekDays[4])}`, items: eventCards, empty: 'None found in open tickets.' },
      { key: 'reply', title: 'In progress, needs a reply', items: reply, empty: 'Nothing. Everyone is caught up.' },
      { key: 'hold', title: 'On hold, needs a reply', items: hold, empty: 'Nothing.' },
      { key: 'fix', title: 'Resolved, needs a fix', items: fix, empty: 'Nothing.' },
    ],
    doingWell: caughtUp,
    html: reportHtml,
  }, report, markUsed);

  // Profile pictures for the people in the report, from your own instance.
  // This is optional: if the field is empty, hidden by an ACL or the request
  // fails, the panel keeps the initials and the report is unaffected.
  try {
    const names = [...new Set([...behind, ...fixes, ...events].map((b) => b.t.assigned_to).concat(caughtUp))].filter(Boolean);
    if (names.length) {
      const users = await api('sys_user', `nameIN${names.join(',')}`, 'name,avatar,photo', 200, false);
      panel.setPhotos(Object.fromEntries(users.filter((u) => u.avatar || u.photo).map((u) => [u.name, `/${u.avatar || u.photo}.iix?t=small`])));
    }
  } catch (e) { /* no pictures, initials stay */ }
  console.log(`Checked groups: ${(usedGroups.length ? usedGroups : groups).map((g) => g.name).join(', ')}`);
  return report;
})().catch((e) => {
  // Show the error in the panel when it's open, otherwise as an alert.
  const host = document.getElementById('ticket-check-panel');
  if (host && host.tcFail) host.tcFail(e.message);
  else alert(`Ticket check couldn't finish: ${e.message}`);
});
