"use client";

import { useState } from "react";

// Sample ticket. Names are made up.
const JOURNAL = [
  { at: "10/14/2026 10:05", by: "Jordan M.", note: true, text: "Hi Priya, I added you to the Admissions mailbox. Close Outlook, open it again and it should show up." },
  { at: "10/14/2026 09:51", by: "Jordan M.", note: true, text: "Added Priya to Admissions-Shared in Exchange admin." },
  { at: "10/13/2026 15:02", by: "Priya S.", note: false, text: "I still can't see the Admissions mailbox in Outlook." },
  { at: "10/13/2026 08:30", by: "Jordan M.", note: false, text: "Hi Priya, I'm looking into this now." },
];

const RULES = [
  "Only Additional comments are emailed to the user. Work notes stay with IT.",
  "“Thanks, that worked” or “I'll check tomorrow” from a user doesn't put a ticket behind.",
  "Work notes that only say “still working on this” don't count as an update. The user can't see them.",
  "Follow-ups are counted by day. Two on the same day count as one.",
  "On hold for the user with follow-ups on three different days and no answer: ready to close. Not if IT promised the user an update.",
  "A comment typed into ServiceNow by anyone other than the caller counts as IT. User replies come in by email.",
];

// The same ticket from IT's side and from the user's side. The user's side
// has no work notes, which is why a work note never counts as a reply.
export default function Copies() {
  const [view, setView] = useState<"it" | "user">("it");
  const user = view === "user";

  return (
    <section className="copies" id="copies" aria-labelledby="copies-h">
      <div className="copies-text">
        <p className="kicker">How it decides</p>
        <h2 id="copies-h">It reads every ticket the way the user sees it.</h2>
        <p className="sub">
          IT sees the whole record. The user only gets Additional comments. So a reply that only exists as a work note doesn&rsquo;t count, and the ticket still shows up as waiting.
        </p>
        <ul className="rules">
          {RULES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>

      <div className="copies-demo">
        <div className="seg" role="group" aria-label="Whose view of the ticket">
          <button type="button" aria-pressed={!user} onClick={() => setView("it")}>
            IT&rsquo;s view
          </button>
          <button type="button" aria-pressed={user} onClick={() => setView("user")}>
            Priya&rsquo;s view
          </button>
          <span className={`seg-thumb${user ? " right" : ""}`} aria-hidden="true" />
        </div>

        <div className="ticket">
          <div className="ticket-head">
            <span className="inc">INC0042760</span>
            <span className="ticket-title">Access to shared mailbox</span>
            <span className="sample">Sample</span>
          </div>
          <ol className="jr">
            {JOURNAL.map((e) => (
              <li key={e.at} className={`jr-e${e.note ? " note" : ""}${user && e.note ? " gone" : ""}`} aria-hidden={user && e.note ? true : undefined}>
                <div className="jr-in">
                  <div className="jr-meta">
                    <b>{e.by}</b>
                    <span>{e.at}</span>
                    <span className={`jr-kind${e.note ? " n" : ""}`}>{e.note ? "Work note" : "Comment"}</span>
                  </div>
                  <p>{e.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className={`verdict${user ? " waiting" : ""}`} aria-live="polite">
            <span className="dot" aria-hidden="true" />
            {user ? "Priya's last message from 10/13/2026 has no answer. Ticket Check flags it." : "From here it looks answered."}
          </div>
        </div>
      </div>
    </section>
  );
}
