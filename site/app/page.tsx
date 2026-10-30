import Copies from "@/components/Copies";
import GetIt from "@/components/GetIt";
import Header from "@/components/Header";
import { AvatarStack } from "@/components/Avatar";
import ReportPreview from "@/components/ReportPreview";
import { bookmarkHref, consoleScript, currentVersion, fixedBookmarkHref } from "@/lib/script";
import { base } from "@/lib/base";

// The sample people waiting in the hero, and why. Names are made up.
const WAITING = [
  { name: "Dana R.", role: "Waiting since 10/12/2026" },
  { name: "Priya S.", role: "Reply saved as a work note" },
  { name: "Chris L.", role: "On hold, follow-up 3 of 3 due" },
  { name: "Rosa P.", role: "Event on 10/15/2026, not confirmed" },
  { name: "Morgan B.", role: "Closed with “issue fixed.”" },
];

// What the panel flags. Each pill is the exact label the panel shows.
const FLAGS = [
  { pill: "No reply", tone: "red", title: "Users nobody answered", body: "Someone wrote back and the newest message on the ticket is still theirs." },
  { pill: "Work note", tone: "red", title: "Replies that never went out", body: "A message to the user was typed as a work note, so they never got it." },
  { pill: "Follow-up 2/3", tone: "amber", title: "Follow-ups on hold tickets", body: "Counts the days you followed up and says when a ticket can close as no response." },
  { pill: "Thu 10/15", tone: "blue", title: "Events this week", body: "Pulls the date, time and room out of ticket text, including “tomorrow”, and follows work notes that move the date." },
  { pill: "Weak note", tone: "violet", title: "Resolutions that need a fix", body: "Notes like “issue fixed.” that don't say what was done, work closed before it's finished, and tickets closed as no response too early." },
];

// Every request the script sends, in order. Taken from ticket-check.js.
const REQUESTS = [
  { table: "sys_user_grmember", why: "Which groups you're in" },
  { table: "incident", why: "Open tickets in those groups" },
  { table: "incident", why: "Tickets resolved since your last check" },
  { table: "incident", why: "Tickets opened since your last check" },
  { table: "sys_user_grmember", why: "Who's on those groups, so staff replies count as IT" },
  { table: "sys_user", why: "Profile pictures for the people in the report (optional)" },
];

export default function Page() {
  const href = bookmarkHref();
  return (
    <>
      <Header />
      <main id="top">
        <section className="hero" aria-labelledby="hero-h">
          <h1 id="hero-h">
            See who&rsquo;s still
            <br />
            waiting
            <span className="chip" aria-hidden="true">
              <AvatarStack className="chip-stack" people={WAITING} max={2} />
              <span className="chip-dot" />
            </span>
            on IT.
          </h1>
          <div className="hero-side">
            <p className="hero-sub">
              Ticket Check is a bookmark for ServiceNow. One click lists the tickets where a user hasn&rsquo;t heard back, replies saved as work notes, this week&rsquo;s events, and resolved tickets that need a better note.
            </p>
            <div className="hero-ctas">
              <a className="btn btn-dark" href="#get">
                Get the bookmark
              </a>
              <a className="btn btn-light" href="#flags">
                See what it flags
              </a>
            </div>
          </div>
        </section>

        <div className="stage" aria-label="Sample run of Ticket Check. Names and tickets are made up.">
          <ReportPreview />
          <p className="stage-note">Sample run. The names and tickets are made up.</p>
        </div>

        <section className="flags" id="flags" aria-labelledby="flags-h">
          <div className="flags-head">
            <p className="kicker">What it flags</p>
            <h2 id="flags-h">Five things that slip when the queue gets busy.</h2>
          </div>
          <ul className="flag-grid">
            {FLAGS.map((f) => (
              <li key={f.title} className="flag">
                <span className={`tag ${f.tone}`}>{f.pill}</span>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </li>
            ))}
            <li className="flag flag-dark">
              <span className="tag light">Copied</span>
              <h3>Ready to paste in Teams</h3>
              <p>Copy turns the panel into the plain-text report, grouped by In progress, On hold and Resolved, with full dates.</p>
            </li>
          </ul>
        </section>

        <Copies />

        <section className="privacy" id="privacy" aria-labelledby="privacy-h">
          <div className="privacy-text">
            <p className="kicker">Privacy</p>
            <h2 id="privacy-h">Read-only, and nothing leaves your browser.</h2>
            <ul className="facts">
              <li>
                <b>Runs as you.</b> It uses the ServiceNow session you&rsquo;re signed in with and sees only what your account can see.
              </li>
              <li>
                <b>Only reads.</b> Every request is a GET, so it can&rsquo;t change a ticket.
              </li>
              <li>
                <b>No server.</b> The bookmark downloads the latest script from this site, then talks only to your own ServiceNow instance. No ticket data is sent anywhere, and the report stays in the panel until you copy it.
              </li>
            </ul>
          </div>
          <div className="req-card" aria-label="Every request the script sends">
            <div className="req-top">
              <span>Requests it sends</span>
              <span>your-campus.service-now.com</span>
            </div>
            <ol>
              {REQUESTS.map((r, i) => (
                <li key={i}>
                  <code>
                    <span className="get-verb">GET</span> /api/now/table/<b>{r.table}</b>
                  </code>
                  <span>{r.why}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <GetIt href={href} fixedHref={fixedBookmarkHref()} version={currentVersion()} script={consoleScript()} />
      </main>

      <footer className="ftr">
        <span>Ticket Check. Read-only. Built by a help desk tech for a CUNY help desk queue.</span>
        <span className="ftr-links">
          <a href={`${base}/changelog/`}>Changelog</a>
          <a href="#top">Back to top</a>
        </span>
      </footer>
    </>
  );
}
