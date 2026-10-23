# Changelog

All dates are MM/DD/YYYY. The plain-text report that Copy produces has kept
the same format since 1.0, so pasting it into Teams works the same way in
every version.

## 3.3.0 (10/22/2026)

Rule fixes, each tested against 3 years of tickets before release.

- Events written as "tomorrow" or "today" are now found, counted from the day
  the ticket was opened. They only count with a time, a room or equipment on
  the same line, and never for logins, MFA, deadlines or someone's
  availability.
- User replies like "I'll check tomorrow when I'm back" or "everything is
  running smoothly" no longer put a ticket behind. A bare "yes" or "no" still
  does, because it's usually an answer IT has to act on.
- Only the automated PaperCut and Xerox notices are skipped now. Real requests
  with "PaperCut" or "Xerox" in the title, like "PaperCut Access", are checked
  like any other ticket.
- Tickets closed as no response are checked against the follow-up rule: they
  need follow-ups on three different days first. It also flags a ticket closed
  as "haven't heard back" when the user actually wrote last.
- "Not finished" closing notes are narrowed to IT's own unfinished work
  ("closing this for now", "I'll update you once it's done", "will contact you
  in 2 weeks", "unable to set up TOTP"). Normal closings like "please try
  again", "return the laptop tomorrow" or "test it again" no longer trip it.
- Resolution notes: greetings only remove the greeting and the name, so "Good
  morning Alex, here is the link for the depot form" keeps its content. Staff
  names alone ("Resolved by Pat") don't count as saying what was done.
  Stock thank-you lines are recognized without swallowing a real fix ("Thank
  you for confirming the VPN was fixed").
- More placeholder work notes are recognized ("waiting for updates",
  "awaiting response", "please assist"), and a line no longer says both "post
  the update as a comment" and "send an update".

## 3.2.0 (10/21/2026)

More rule fixes found by checking a report line by line.

- Resolution notes with a real "Resolution Notes:" line after the closing
  template were wrongly flagged as not saying what was done. The "Have a great
  rest of the day" pattern ran to the end of the note when no period followed
  it, and swallowed the line that said what was done. Greeting and closing
  patterns now stop within one sentence.
- Closing templates in the singular ("If you have any question, feel free to
  email us") and "If any other issues occur" are now recognized, so a note
  that's only the template is flagged.
- Closing notes that say the work isn't done are flagged as not finished,
  for example "unable to set up TOTP, hope we can test again soon" or "please
  try again tomorrow".
- Status-only work notes since the last reply, like "I am still working on
  this", "no update" or the same note pasted every day, are called out the
  same way "Ticket in progress" notes were, with a reminder to post the update
  as a comment the user can see.

## 3.1.0 (10/19/2026)

Rule fixes found by checking a report line by line.

- Rescheduled events: a staff work note or comment like "new date Tuesday the
  27th 10 am", "moved to 10/27" or "rescheduled to October 29" moves the
  event. If the new date isn't this week it leaves this week's list, and the
  ticket says to confirm the new date with the user when nobody has commented
  since the note.
- Duplicates: a ticket with a staff note or comment saying "duplicate", whose
  caller has another open ticket that it names or that is for the same event
  day, now says "this is a duplicate of INC..., close it or link the two"
  instead of asking for a reply. Its event is listed once.
- Promised updates: when IT told the user "I'll keep you updated" (or "let you
  know", "get back to you" and similar), the ticket is no longer marked ready
  to close as no response. Only follow-ups after the promise count.
- In progress but waiting on the user: when IT has written on two or more days
  with no answer, the report suggests putting it on hold awaiting caller and
  sending the next follow-up.
- Placeholder notes: when the only staff activity since the last reply is
  "Ticket in progress" work notes, the report says the user can't see those.
- The "new ones came in" count leaves out automated notices like End User
  Digest, the same way the rest of the report does.

## 3.0.0 (10/19/2026)

A new panel design, matching the Ticket Check site.

- New header with the Ticket Check mark, a round Copy button and Close.
- The top of the panel now says how many tickets need a reply, with an orange
  dot when someone is waiting and a green one when everyone has had a reply.
- The four stat boxes are now filter tabs with counts: All, Need a reply, On
  hold, Events and To fix.
- Each ticket card shows the assignee's profile picture, name, ticket number,
  status tag, title and what to do next.
- Profile pictures come from your own ServiceNow instance (the avatar or photo
  on the user record). This adds one read request to the `sys_user` table. If
  a picture is missing, hidden or fails to load, the card shows the person's
  initial instead, and the report is never held up by it.
- "Doing well" shows the people who are caught up as a stack of pictures.
- Errors now show inside the panel with a Close button, instead of a browser
  pop-up. The pop-up is still used if the panel couldn't open at all (for
  example, when you're not on a ServiceNow page).
- The filter tabs wrap onto a second line on narrow screens instead of running
  off the edge.

## 2.0.0 (10/18/2026)

The first designed panel.

- The report opens in a panel on the right of the page instead of a plain
  text box. The panel is kept in its own shadow root so ServiceNow's styles
  can't change how it looks, and it uses system fonts so it loads nothing from
  the internet.
- A loading state shows while the tickets are read.
- Four stat boxes (Need a reply, On hold, Events, To fix) filter the list.
- Every finding gets a status tag, such as No reply, Work note, Follow-up 2/3,
  Close it, Weak note or the event's day.
- All ticket text is added to the page as plain text, never as HTML.
- Esc closes the panel.

## 1.2.0 (10/15/2026)

Rule fixes after testing against 2 months, then 12 months, of tickets.

- Who counts as IT: members of the groups that own the tickets, anyone
  assigned a ticket, anyone who wrote a work note, and anyone other than the
  caller who typed a comment straight into ServiceNow (user replies arrive by
  email and start with "reply from:"). This picks up former staff and Central.
- User messages that don't need an answer, like "thanks, that worked" or "I'll
  let you know", no longer put a ticket behind, unless they also ask for
  something.
- Quoted emails, sign-offs and confidentiality footers are ignored when
  reading what a user wrote.
- A work note only counts as a message stranded from the user when it greets
  the user, isn't addressed to a colleague, isn't the user's own email pasted
  in, and wasn't also posted as a comment.
- Follow-ups are counted by day, so two replies on the same day count once.
- Resolution notes are checked for whether they say what was done, after
  taking out the closing template, names and filler words.
- Events: deadlines, date ranges, loan due dates, policy start dates and
  elections are no longer listed as events. "7/6/25" is no longer read as
  6/25, and a date in the title only counts for event or support requests.
- The "since last check" window now moves only when you press Copy, so test
  runs don't shrink the next report.

## 1.1.0 (10/15/2026)

- Runs from a bookmark. `build-bookmark.js` turns `ticket-check.js` into
  `bookmark.html`, with a button to drag to the bookmarks bar.
- A clear message when the ServiceNow session has expired: sign in again and
  click the bookmark again.

## 1.0.0

- First version, pasted into the browser console on a ServiceNow page.
- Lists open tickets where the user is waiting on a reply, events this week,
  recently resolved tickets that need a better note, and who is caught up.
- Read-only: it only sends GET requests to your own instance, as you.
