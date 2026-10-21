"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AvatarStack, Avatar as Pic } from "./Avatar";
import { BookmarkIcon, CalendarIcon, ChatIcon, CheckMark, CircleCheckIcon, GridIcon, TeamIcon } from "./icons";

// Sample data only. Names and ticket numbers are made up.
type Tone = "red" | "amber" | "blue" | "green" | "violet";
type Item = { who: string; inc: string; title: string; msg: string; pill: string; tone: Tone };
type Section = { title: string; items: Item[] };
type ViewId = "report" | "replies" | "events" | "resolved";
type View = { stat: number; sections: Section[]; well?: string };


const replies: Item[] = [
  { who: "Jordan", inc: "INC0042817", title: "Projector in 310", msg: "Dana hasn't had a reply since 10/12/2026. Jordan should reply.", pill: "No reply", tone: "red" },
  { who: "Jordan", inc: "INC0042760", title: "Mailbox access", msg: "The 10/14/2026 message to Priya was saved as a work note, so she never got it.", pill: "Work note", tone: "red" },
  { who: "Alex", inc: "INC0042799", title: "Account locked", msg: "Chris hasn't answered since 10/13/2026. Send follow-up 2 of 3.", pill: "Follow-up 2/3", tone: "amber" },
];
const events: Item[] = [
  { who: "Sam", inc: "INC0043001", title: "Faculty Senate setup", msg: "10/15/2026, 1:00 PM, Room 212. Rosa last heard from us on 10/09/2026.", pill: "Thu 10/15", tone: "blue" },
  { who: "Jordan", inc: "INC0043014", title: "Provost Q&A", msg: "10/16/2026, 9:30 AM, Room 606. Nadia hasn't had a reply confirming it.", pill: "Fri 10/16", tone: "blue" },
];
const resolved: Item[] = [
  { who: "Alex", inc: "INC0042655", title: "Printer setup", msg: "The note (\"issue fixed.\") doesn't say what was done.", pill: "Weak note", tone: "violet" },
  { who: "Jordan", inc: "INC0042640", title: "Laptop request", msg: "Morgan never got a reply in the 6 days it was open.", pill: "No reply", tone: "red" },
  { who: "Sam", inc: "INC0042631", title: "ID reprint", msg: "The note tells the user not to respond.", pill: "Weak note", tone: "violet" },
];

const VIEWS: Record<ViewId, View> = {
  report: {
    stat: -1,
    sections: [
      { title: "Events this week", items: events.slice(0, 1) },
      { title: "In progress, needs a reply", items: replies.slice(0, 2) },
      { title: "Resolved, needs a fix", items: resolved.slice(0, 1) },
    ],
    well: "Sam has nothing waiting on a reply.",
  },
  replies: { stat: 0, sections: [{ title: "In progress, needs a reply", items: replies.slice(0, 2) }, { title: "On hold, needs a reply", items: replies.slice(2) }] },
  events: { stat: 2, sections: [{ title: "Events this week, 10/12/2026 to 10/16/2026", items: events }] },
  resolved: { stat: 3, sections: [{ title: "Resolved, needs a fix", items: resolved }] },
};

const STATS = [
  { n: 9, label: "Need a reply", color: "#E5484D" },
  { n: 3, label: "On hold", color: "#F2A43A" },
  { n: 2, label: "Events", color: "#3E7BEA" },
  { n: 3, label: "To fix", color: "#6E5CE6" },
];

// The fake ServiceNow list behind the panel. `flag` marks the rows the
// current view is talking about, so they light up as the panel changes.
type Row = { inc: string; t: string; st: string; cls: string; who: string; ago: string; flag?: "reply" | "event" };
const OPEN_ROWS: Row[] = [
  { inc: "INC0042817", t: "Projector in 310 not turning on", st: "In progress", cls: "prog", who: "Jordan", ago: "2d", flag: "reply" },
  { inc: "INC0042760", t: "Access to shared mailbox", st: "In progress", cls: "prog", who: "Jordan", ago: "1d", flag: "reply" },
  { inc: "INC0042799", t: "Account locked after password reset", st: "On hold", cls: "hold", who: "Alex", ago: "1d", flag: "reply" },
  { inc: "INC0043001", t: "Faculty Senate room setup", st: "In progress", cls: "prog", who: "Sam", ago: "5h", flag: "event" },
  { inc: "INC0043014", t: "Provost Q&A, Room 606", st: "On hold", cls: "hold", who: "Jordan", ago: "6d", flag: "event" },
  { inc: "INC0043022", t: "VPN on new laptop", st: "In progress", cls: "prog", who: "Sam", ago: "2h" },
  { inc: "INC0043027", t: "Printer jam, 4th floor", st: "New", cls: "new", who: "Alex", ago: "40m" },
  { inc: "INC0043031", t: "Brightspace login loop", st: "New", cls: "new", who: "Sam", ago: "12m" },
];
const RESOLVED_ROWS: Row[] = [
  { inc: "INC0042655", t: "Printer setup in 504", st: "Resolved", cls: "done", who: "Alex", ago: "3h", flag: "reply" },
  { inc: "INC0042640", t: "Laptop request for new hire", st: "Resolved", cls: "done", who: "Jordan", ago: "5h", flag: "reply" },
  { inc: "INC0042631", t: "ID card reprint", st: "Resolved", cls: "done", who: "Sam", ago: "6h", flag: "reply" },
  { inc: "INC0042622", t: "Wifi drops in library", st: "Resolved", cls: "done", who: "Sam", ago: "8h" },
  { inc: "INC0042618", t: "Zoom license for adjunct", st: "Resolved", cls: "done", who: "Alex", ago: "9h" },
  { inc: "INC0042604", t: "Monitor flickering", st: "Resolved", cls: "done", who: "Jordan", ago: "1d" },
];
const LIST: Record<ViewId | "team", { title: string; count: number; chips: string[]; rows: Row[]; hl?: Row["flag"] }> = {
  report: { title: "Incidents", count: 48, chips: ["assignment_group = Service Desk", "active = true"], rows: OPEN_ROWS },
  replies: { title: "In progress", count: 31, chips: ["assignment_group = Service Desk", "state = In progress"], rows: OPEN_ROWS, hl: "reply" },
  events: { title: "Room events", count: 6, chips: ["assignment_group = Service Desk", "description LIKE room"], rows: OPEN_ROWS, hl: "event" },
  resolved: { title: "Resolved", count: 214, chips: ["assignment_group = Service Desk", "resolved >= 10/13/2026"], rows: RESOLVED_ROWS, hl: "reply" },
  team: { title: "Incidents", count: 48, chips: ["assignment_group = Service Desk", "active = true"], rows: OPEN_ROWS },
};

const SIDE = [
  { group: "Service desk", label: "Open incidents", c: "48", icon: <ChatIcon size={14} /> },
  { label: "In progress", c: "31", icon: <GridIcon size={14} /> },
  { label: "On hold", c: "11", icon: <TeamIcon size={14} /> },
  { label: "Resolved", c: "214", icon: <CircleCheckIcon size={14} /> },
  { group: "Planning", label: "Room events", c: "6", icon: <CalendarIcon size={14} /> },
  { group: "Apps", label: "Teams", c: "", icon: <TeamIcon size={14} /> },
];

// ------------------------------------------------------------- the walkthrough
// Each scene is a short script: the cursor moves to a target, clicks, and the
// fake page reacts. The dock tab for the scene fills up while it plays.
type Sim = {
  panel: "closed" | "loading" | "open";
  view: ViewId;
  side: number;
  copied: boolean;
  teams: 0 | 1 | 2 | 3 | 4 | 5; // hidden, open, pasted, sent, someone typing, reply in
};
type Api = {
  move: (target: string, fx?: number, fy?: number) => void;
  click: () => void;
  set: (s: Partial<Sim>) => void;
  // Scrolls a box (by data-t) to its bottom, or to bring a child to its top.
  scroll: (target?: string, child?: string, ms?: number) => void;
};
type Scene = { id: string; label: string; icon: ReactNode; ms: number; init: Sim; steps: [number, (a: Api) => void][] };

const base: Sim = { panel: "open", view: "report", side: 0, copied: false, teams: 0 };
const pick = (view: ViewId, side: number, stat: number, next: string): Scene["steps"] => [
  [150, (a) => a.move(`stat-${stat}`)],
  [900, (a) => a.click()],
  [1000, (a) => a.set({ view, side })],
  [2100, (a) => a.move("panel-body", 0.55, 0.45)],
  [2500, (a) => a.scroll()],
  [4900, (a) => a.move(next)],
];

const SCENES: Scene[] = [
  {
    id: "report", label: "Report", icon: <GridIcon />, ms: 7400,
    init: { ...base, panel: "closed" },
    steps: [
      [250, (a) => a.move("bookmark")],
      [1200, (a) => a.click()],
      [1300, (a) => a.set({ panel: "loading" })],
      [2600, (a) => a.set({ panel: "open" })],
      [3700, (a) => a.move("panel-body", 0.55, 0.45)],
      [4100, (a) => a.scroll()],
      [6700, (a) => a.move("stat-0")],
    ],
  },
  { id: "replies", label: "Replies", icon: <ChatIcon />, ms: 5800, init: base, steps: pick("replies", 1, 0, "stat-2") },
  { id: "events", label: "Events", icon: <CalendarIcon />, ms: 5800, init: { ...base, view: "replies", side: 1 }, steps: pick("events", 4, 2, "stat-3") },
  { id: "resolved", label: "Resolved", icon: <CircleCheckIcon />, ms: 5800, init: { ...base, view: "events", side: 4 }, steps: pick("resolved", 3, 3, "copy") },
  {
    id: "team", label: "Team", icon: <TeamIcon />, ms: 16500,
    init: { ...base, view: "resolved", side: 3 },
    steps: [
      [150, (a) => a.move("copy")],
      [850, (a) => a.click()],
      [950, (a) => a.set({ copied: true })],
      [1800, (a) => a.move("side-5")],
      [2500, (a) => a.click()],
      [2600, (a) => a.set({ side: 5, teams: 1, panel: "closed" })],
      [3500, (a) => a.move("compose", 0.3, 0.5)],
      [4100, (a) => a.click()],
      [4250, (a) => a.set({ teams: 2 })],
      [5200, (a) => a.move("send")],
      [5800, (a) => a.click()],
      [5900, (a) => a.set({ teams: 3, copied: false })],
      [6000, (a) => a.scroll("thread", ".tmsg.mine", 600)],
      [6400, (a) => a.move("thread", 0.7, 0.55)],
      [7600, (a) => a.scroll("thread", undefined, 4200)],
      [12000, (a) => a.set({ teams: 4 })],
      [12100, (a) => a.scroll("thread", undefined, 500)],
      [13600, (a) => a.set({ teams: 5 })],
      [13700, (a) => a.scroll("thread", undefined, 700)],
    ],
  },
];

// Where a scene ends up, for reduced motion: apply every state change, skip the motion.
const finalState = (s: Scene) => {
  let out = { ...s.init };
  s.steps.forEach(([, f]) => f({ move: () => {}, click: () => {}, scroll: () => {}, set: (p) => { out = { ...out, ...p }; } }));
  return out;
};

// ------------------------------------------------------------- pieces
function Avatar({ who, small }: { who: string; small?: boolean }) {
  return <Pic name={who} className={small ? "mini-av" : "tcp-av"} />;
}

const CopyGlyph = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </svg>
);

// The same design as the real bookmark (ticket-check.js, version 3).
function Panel({ sim, pressed }: { sim: Sim; pressed: string }) {
  const view = VIEWS[sim.view];
  const loading = sim.panel === "loading";
  const waiting = STATS[0].n + STATS[1].n;
  const all = STATS.reduce((a, s) => a + s.n, 0);
  return (
    <div className="tcp" data-state={sim.panel} aria-label="Ticket check panel">
      <div className="v3-bar">
        <span className="v3-mark" aria-hidden="true">
          <CheckMark size={13} color="#FFFFFF" />
        </span>
        <span className="v3-name">Ticket check</span>
        <span className={`v3-copy${sim.copied ? " done" : ""}${loading ? " off" : ""}${pressed === "copy" ? " pressed" : ""}`} data-t="copy">
          {sim.copied ? <CheckMark size={13} color="#FFFFFF" /> : <CopyGlyph />}
          {sim.copied ? "Copied" : "Copy"}
        </span>
        <span className="v3-x" aria-hidden="true">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </span>
      </div>

      {loading ? (
        <>
          <div className="v3-top">
            <div className="v3-when">Reading your tickets...</div>
            <div className="v3-sk short" />
            <div className="v3-sk short" />
          </div>
          <div className="v3-body">
            <div className="v3-sk" />
            <div className="v3-sk" />
            <div className="v3-sk" />
          </div>
        </>
      ) : (
        <>
          <div className="v3-top">
            <div className="v3-when">10/14/2026, 5:30 PM · since 10/13/2026 5:00 PM</div>
            <div className="v3-headline">
              <span className="v3-dot" aria-hidden="true" />
              {waiting} tickets need a reply
            </div>
            <p className="v3-summary">6 tickets were resolved and 4 new ones came in. 3 resolved tickets need a second look.</p>
          </div>
          <div className="v3-tabs">
            <span className={`v3-tab${view.stat === -1 ? " on" : ""}`}>
              All <b>{all}</b>
            </span>
            {STATS.map((s, i) => (
              <span key={s.label} data-t={`stat-${i}`} className={`v3-tab${view.stat === i ? " on" : ""}${pressed === `stat-${i}` ? " pressed" : ""}`}>
                <i style={{ background: s.color }} />
                {s.label} <b>{s.n}</b>
              </span>
            ))}
          </div>
          <div className="v3-body" key={sim.view} data-t="panel-body" tabIndex={-1}>
            {view.sections.map((sec) => (
              <section className="v3-sec" key={sec.title}>
                <h5>
                  {sec.title} <span>{sec.items.length}</span>
                </h5>
                {sec.items.map((it, i) => (
                  <div className="v3-item" key={it.inc} style={{ animationDelay: `${i * 40}ms` }}>
                    <Pic name={it.who} className="v3-av" />
                    <div className="v3-main">
                      <div className="v3-row1">
                        <span className="v3-who">{it.who}</span>
                        <span className="v3-inc">{it.inc}</span>
                        <span className={`tcp-pill ${it.tone}`}>{it.pill}</span>
                      </div>
                      <div className="v3-t">{it.title}</div>
                      <div className="v3-msg">{it.msg}</div>
                    </div>
                  </div>
                ))}
              </section>
            ))}
            {view.well && (
              <div className="v3-well">
                <AvatarStack className="v3-stack" people={[{ name: "Sam K.", role: "Help desk" }]} />
                {view.well}
              </div>
            )}
          </div>
        </>
      )}
      <div className="v3-foot">
        <span>Read-only. Nothing leaves your browser.</span>
        <span>Esc to close</span>
      </div>
    </div>
  );
}

// What gets pasted into Teams: the same plain text the Copy button gives you.
// Lines starting with "#" are section headings.
const REPORT_LINES = [
  "Since 10/13/2026 5:00 PM, 6 tickets were resolved and 4 new ones came in. 9 open tickets need a reply and 3 resolved tickets need a second look.",
  "#Events this week (10/12/2026 to 10/16/2026)",
  "• 10/15/2026: Sam, INC0043001 (Faculty Senate setup), 1:00 PM, Room 212. Rosa last heard from us on 10/09/2026.",
  "#In progress, needs a reply",
  "• Jordan, INC0042817 (Projector in 310): Dana hasn't had a reply since 10/12/2026. Jordan should reply.",
  "• Jordan, INC0042760 (Mailbox access): the 10/14/2026 message to Priya was saved as a work note, so she never got it. Post it as a comment.",
  "#On hold, needs a reply",
  "• Alex, INC0042799 (Account locked): Chris hasn't had a reply since 10/13/2026. Send follow-up 2 of 3.",
  "#Resolved, needs a fix",
  "• Alex, INC0042655 (Printer setup): the note (\"issue fixed.\") doesn't say what was done.",
  "#Doing well",
  "• Sam has nothing waiting on a reply.",
];

function Teams({ step, pressed }: { step: Sim["teams"]; pressed: string }) {
  return (
    <div className="teams" data-state={step ? "open" : "closed"}>
      <div className="teams-rail" aria-hidden="true">
        <span className="teams-logo">T</span>
        <span className="on"><ChatIcon size={15} /></span>
        <span><TeamIcon size={15} /></span>
        <span><CalendarIcon size={15} /></span>
      </div>
      <div className="teams-main">
        <div className="teams-top">
          <span className="teams-ch">#</span>
          <b>IT Help Desk</b>
          <span className="teams-sep">›</span>
          <span>General</span>
          <AvatarStack
            className="teams-people"
            people={[
              { name: "Jordan M.", role: "Help desk" },
              { name: "Alex T.", role: "Help desk" },
              { name: "Sam K.", role: "Help desk" },
              { name: "You", role: "Help desk" },
            ]}
          />
        </div>
        <div className="teams-thread" data-t="thread" tabIndex={-1}>
          <div className="tmsg">
            <Avatar who="Sam" />
            <div>
              <div className="tmsg-head"><b>Sam</b><span>4:52 PM</span></div>
              <div className="tmsg-body">Senate room is set for Thursday, mics tested.</div>
            </div>
          </div>
          {step >= 3 && (
            <div className="tmsg mine">
              <Avatar who="You" />
              <div>
                <div className="tmsg-head"><b>You</b><span>5:31 PM</span></div>
                <div className="tmsg-body report">
                  <b>Ticket check for 10/14/2026, 5:30 PM</b>
                  {REPORT_LINES.map((l) => (
                    <span key={l} className={l.startsWith("#") ? "h" : ""}>{l.replace(/^#/, "")}</span>
                  ))}
                </div>
                {step >= 5 && (
                  <div className="tmsg-react">
                    <span>👍 2</span>
                    <span>✅ 1</span>
                  </div>
                )}
              </div>
            </div>
          )}
          {step === 4 && (
            <div className="tmsg typing">
              <Avatar who="Jordan" />
              <div className="dots3"><i /><i /><i /></div>
            </div>
          )}
          {step >= 5 && (
            <div className="tmsg">
              <Avatar who="Jordan" />
              <div>
                <div className="tmsg-head"><b>Jordan</b><span>5:33 PM</span></div>
                <div className="tmsg-body">On it. Replying to Dana and moving the Priya note to a comment now.</div>
              </div>
            </div>
          )}
        </div>
        <div className={`teams-compose${step === 2 ? " filled" : ""}${pressed === "compose" ? " focus" : ""}`} data-t="compose">
          {step === 2 ? (
            <div className="teams-draft">
              <b>Ticket check for 10/14/2026, 5:30 PM</b>
              <span>{REPORT_LINES[0]}</span>
            </div>
          ) : (
            <span className="ph">Type a message</span>
          )}
          <span className={`teams-send${step === 2 ? " ready" : ""}${pressed === "send" ? " pressed" : ""}`} data-t="send">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M3 20l18-8L3 4l2.5 8L3 20zm2.5-8H13" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------- main
export default function ReportPreview() {
  const [current, setCurrent] = useState(0);
  const [cycle, setCycle] = useState(0); // restarts the scene and the tab fill
  const [sim, setSim] = useState<Sim>(SCENES[0].init);
  const [cursor, setCursor] = useState({ x: 0, y: 0, on: false, down: false, clicks: 0 });
  const [pressed, setPressed] = useState("");
  const [reduceMotion, setReduceMotion] = useState(false);
  const [inView, setInView] = useState(false);
  const winRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const lastTarget = useRef("");
  const indRef = useRef<HTMLSpanElement>(null);

  // Slide the sidebar highlight to the active item.
  useLayoutEffect(() => {
    const ind = indRef.current;
    const item = winRef.current?.querySelector<HTMLElement>(`[data-t="side-${sim.side}"]`);
    if (!ind || !item) return;
    ind.style.transform = `translateY(${item.offsetTop}px)`;
    ind.style.height = `${item.offsetHeight}px`;
  }, [sim.side]);

  useEffect(() => {
    setReduceMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const el = winRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Plays the current scene. Hovering doesn't pause it; it only waits while
  // the preview is off screen, then starts the scene over.
  useEffect(() => {
    const scene = SCENES[current];
    if (reduceMotion) {
      setSim(finalState(scene));
      setCursor((c) => ({ ...c, on: false }));
      return;
    }
    setSim(scene.init);
    setPressed("");
    if (!inView) return;
    const timers: number[] = [];
    let raf = 0;
    const later = (ms: number, f: () => void) => timers.push(window.setTimeout(f, ms));
    const api: Api = {
      move: (target, fx = 0.5, fy = 0.5) => {
        const win = winRef.current;
        const el = win?.querySelector<HTMLElement>(`[data-t="${target}"]`);
        if (!win || !el) return;
        const r = el.getBoundingClientRect();
        if (!r.width) return; // hidden on this screen size
        const w = win.getBoundingClientRect();
        lastTarget.current = target;
        setCursor((c) => ({ ...c, on: true, x: r.left - w.left + r.width * fx, y: r.top - w.top + r.height * fy }));
      },
      click: () => {
        const t = lastTarget.current;
        setCursor((c) => ({ ...c, down: true, clicks: c.clicks + 1 }));
        setPressed(t);
        later(170, () => setCursor((c) => ({ ...c, down: false })));
        later(240, () => setPressed((p) => (p === t ? "" : p)));
      },
      set: (p) => setSim((s) => ({ ...s, ...p })),
      scroll: (target = "panel-body", child, ms) => {
        const el = winRef.current?.querySelector<HTMLElement>(`[data-t="${target}"]`);
        if (!el) return;
        const max = el.scrollHeight - el.clientHeight;
        const kid = child ? el.querySelector<HTMLElement>(child) : null;
        const to = Math.max(0, Math.min(max, kid ? kid.offsetTop - 12 : max));
        const from = el.scrollTop;
        if (Math.abs(to - from) < 2) return;
        cancelAnimationFrame(raf);
        const start = performance.now();
        const dur = ms ?? Math.min(1800, 500 + Math.abs(to - from) * 6);
        const tick = (now: number) => {
          const k = Math.min(1, (now - start) / dur);
          el.scrollTop = from + (to - from) * (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
          if (k < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
    };
    scene.steps.forEach(([ms, f]) => later(ms, () => f(api)));
    later(scene.ms, () => {
      setCurrent((c) => (c + 1) % SCENES.length);
      setCycle((n) => n + 1);
    });
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      cancelAnimationFrame(raf);
    };
  }, [current, cycle, inView, reduceMotion]);

  const select = useCallback((i: number) => {
    setCurrent(i);
    setCycle((n) => n + 1);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = (current + d + SCENES.length) % SCENES.length;
    select(next);
    tabRefs.current[next]?.focus();
  };

  const list = LIST[sim.teams ? "team" : sim.view];
  const hl = sim.panel === "open" ? list.hl : undefined;

  return (
    <>
      <div className="preview" id="preview">
        <div
          className="window"
          ref={winRef}
          id={`view-${SCENES[current].id}`}
          role="tabpanel"
          aria-labelledby={`tab-${SCENES[current].id}`}
          aria-label="Sample run of Ticket Check on a ServiceNow page"
        >
          <div className="window-bar">
            <div className="dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className="url">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="5" y="11" width="14" height="9" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
              {sim.teams ? "teams.microsoft.com/l/channel/it-help-desk" : "your-campus.service-now.com/incident_list"}
            </div>
            <div className="dots" aria-hidden="true" style={{ visibility: "hidden" }}>
              <span />
              <span />
              <span />
            </div>
          </div>
          <div className="bookmarks" aria-hidden="true">
            <span className={`bm hot${pressed === "bookmark" ? " pressed" : ""}`} data-t="bookmark">
              <BookmarkIcon size={12} />
              Ticket check
            </span>
            <span className="bm">Brightspace</span>
            <span className="bm">CUNYfirst</span>
            <span className="bm">Room booking</span>
          </div>

          <div className="sn" aria-hidden="true">
            <aside className="sn-side">
              <span className="sn-ind" ref={indRef} />
              {SIDE.map((s, i) => (
                <div key={s.label} style={{ display: "contents" }}>
                  {s.group && <div className="grp">{s.group}</div>}
                  <div className={`sn-item${sim.side === i ? " on" : ""}${pressed === `side-${i}` ? " pressed" : ""}`} data-t={`side-${i}`}>
                    {s.icon}
                    {s.label}
                    {s.c && <span className="c">{s.c}</span>}
                  </div>
                </div>
              ))}
            </aside>
            <div className="sn-main">
              <div className="sn-top">
                <h4 key={list.title} className="swap">{list.title}</h4>
                <span className="sn-badge">{list.count}</span>
                <span className="sn-search">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M20 20l-3.5-3.5" />
                  </svg>
                  Search
                </span>
              </div>
              <div className="sn-filters">
                <span className="sn-chip">{list.chips[0]}</span>
                <span className="sn-sep">›</span>
                <span className="sn-chip swap" key={list.chips[1]}>{list.chips[1]}</span>
              </div>
              <div className="sn-table" key={list.rows === RESOLVED_ROWS ? "res" : "open"}>
                <div className="sn-row head">
                  <span>Number</span>
                  <span>Short description</span>
                  <span>State</span>
                  <span>Assigned</span>
                  <span>Updated</span>
                </div>
                {list.rows.map((r, i) => (
                  <div
                    className={`sn-row${hl && r.flag === hl ? ` hl ${hl}` : ""}${hl && r.flag !== hl ? " dim" : ""}`}
                    key={r.inc}
                    style={{ ["--i" as string]: i }}
                  >
                    <span className="inc">{r.inc}</span>
                    <span className="t">{r.t}</span>
                    <span className={`sn-state ${r.cls}`}>{r.st}</span>
                    <span className="who">
                      <Avatar who={r.who} small />
                      {r.who}
                    </span>
                    <span className="ago">{r.ago}</span>
                  </div>
                ))}
              </div>
            </div>
            <Teams step={sim.teams} pressed={pressed} />
          </div>

          <Panel sim={sim} pressed={pressed} />

          <div
            className={`sim-cursor${cursor.on ? " on" : ""}${cursor.down ? " down" : ""}`}
            style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }}
            aria-hidden="true"
          >
            {cursor.clicks > 0 && <span className="sim-ripple" key={cursor.clicks} />}
            <svg width="20" height="22" viewBox="0 0 20 22" aria-hidden="true">
              <path d="M2 1.5l15 9.2-6.6 1.3 3.9 7.4-2.9 1.5-3.9-7.5L2.6 18z" fill="#fff" stroke="#121019" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>

      <div className="dock" style={{ ["--tab-ms" as string]: `${SCENES[current].ms}ms` }}>
        <div className="dock-inner" role="tablist" aria-label="Sample report views" onKeyDown={onKeyDown}>
          {SCENES.map((v, i) => (
            <button
              key={v.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              className="tab"
              role="tab"
              id={`tab-${v.id}`}
              aria-controls={i === current ? `view-${v.id}` : undefined}
              aria-selected={i === current}
              tabIndex={i === current ? 0 : -1}
              onClick={() => select(i)}
            >
              <span className={`bar${reduceMotion || !inView ? " still" : ""}`} key={i === current ? cycle : "idle"} />
              {v.icon}
              <span className="label">{v.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
