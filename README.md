# Ticket Check

A bookmark for ServiceNow help desks. Click it on any ServiceNow page and it lists the open tickets where a user is still waiting on IT, replies that were saved as work notes by mistake, this week's events, and resolved tickets whose notes don't say what was done. One button copies the whole thing as a report for Teams, with bold headings, bullets and ticket numbers that link to the ticket.

It runs in your own browser, as you. It only reads: nothing in ServiceNow changes and no ticket data leaves your computer.

**Site and install:** https://userlaws.github.io/servicenow-ticket-check/

See [CHANGELOG.md](CHANGELOG.md) for what changed in each version.

## Install

### From a bookmark

1. Open the [site](https://userlaws.github.io/servicenow-ticket-check/#get) and drag the **Ticket check** button to your bookmarks bar. Press Ctrl+Shift+B if the bar is hidden.
2. Sign in to ServiceNow and open any page, such as your dashboard.
3. Click **Ticket check** in the bookmarks bar. A panel opens on the right and fills in after a few seconds.
4. Click **Copy** and paste the report into Teams.

If you see "not signed in", sign in again and click the bookmark again.

The bookmark is a one-line loader. Each click downloads the latest `ticket-check.js` from the site, so updates reach you without reinstalling. Bookmarks made before 3.7.0 contain the whole script and stay on the version they were made from; drag the button from the site once more to switch to the loader.

If you'd rather update by hand, the site also has a fixed bookmark under "Prefer to update yourself?". It contains the whole script for the current version and never changes on its own. To update, check the [changelog](CHANGELOG.md) and drag it from the site again.

### From the console

1. Sign in to ServiceNow and open any page.
2. Press F12 and open the Console tab.
3. Paste all of [`ticket-check.js`](ticket-check.js) and press Enter. The first time, the browser may ask you to type `allow pasting` first.
4. The same panel opens, and the report also prints in the console.

### Offline bookmark page

`node build-bookmark.js` writes `bookmark.html`, a local page with the same drag-to-install button. Since the bookmark is a loader, it doesn't need rebuilding when the script changes.

The Copy button is what marks a report as sent. The next report counts resolved and new tickets from that point.

## What the report covers

The opening lines count how many tickets were resolved and opened since the last report you copied. Automated notices (PaperCut, Xerox, order and digest emails) are left out.

**Events this week** lists events found in open tickets for the Monday to Friday week the report will be read in. After 3 PM it assumes you'll read it the next morning. It shows the time and room when the ticket mentions them, and whether the user has heard from IT. If a work note moves the event ("new date Tuesday the 27th"), the new date is used. An event written as "tomorrow" or "today" is counted from the day the ticket was opened, and one written only as a weekday ("on Thursday") is the first such day after it was opened. An event earlier today counts as passed once its start time has gone by.

**In progress, needs a reply** and **On hold, needs a reply** list open tickets where:

- the user has never had a reply;
- the user wrote last and nobody answered;
- IT's last reply is more than a day old;
- a message meant for the user was saved as a work note, so they never got it;
- the event already happened and the ticket is still open;
- the event moved and nobody confirmed the new date with the user;
- a work note calls the ticket a duplicate of another open one, so it should be closed or linked.

Tickets on hold waiting for the user show which follow-up is next. The first reply (the answer or the question to the user) isn't a follow-up; each later day IT writes is one. After follow-ups on three different days with no answer, the report says the ticket can be closed as no response, unless IT promised the user an update. An In Progress ticket where IT has written on two or more days with no answer is flagged to go on hold.

**Resolved, needs a fix** lists tickets closed since the last run where the resolution note doesn't say what was done, still has a placeholder like "Good afternoon name", tells the user not to respond, says the work isn't finished, or contains rude wording. It also lists email tickets that were closed without the user ever getting a reply, and tickets closed as no response before follow-ups on three different days.

**Doing well** names the people with nothing waiting on a reply.

## Settings

The settings are at the top of the script, in `CONFIG`.

- `groups`: the assignment groups to check. Leave it empty to use every group you belong to. Groups that own no tickets (an all-employees group, for example) are ignored.
- `behindDays`: how old IT's last reply can be before a ticket counts as behind. The default is 1.
- `since`: the start of the "since last check" window. Left empty, it uses the time of the last report you copied, or 24 hours ago. Runs you don't copy don't move the window.
- `readOn`: the date the report will be read, if you want to set the events week yourself.
- `extraStaff`: names outside your groups whose comments count as replies from IT.
- `skipPatterns`: automated tickets to leave out.
- `flagWords`: words that should never appear in a resolution note.

## How it decides

A reply to the user is an "Additional comment" from IT. Someone counts as IT if they're in your groups, are assigned a ticket, have written a work note, or typed the comment straight into ServiceNow. User replies arrive by email and start with "reply from:", so a typed comment from anyone other than the caller is IT. Work notes never count as replies, because the user can't see them.

Tickets opened by IT staff for themselves are left out of the reply and resolution checks but still show up as events.

Each rule change is tested against three years of a help desk's tickets before release; [CHANGELOG.md](CHANGELOG.md) says what changed and why.

## What it can't see

Phone calls, Teams messages and walk-ups don't count unless someone wrote them in the ticket. Events are found by looking for this week's dates next to words like event, session, meeting or setup, so an event described only as "next Thursday" won't be found.

## Requests it sends

The bookmark first downloads `ticket-check.js` from the site (GitHub Pages). It sends nothing to the site. After that, all requests are `GET` requests to your own instance's Table API, with your session:

1. `sys_user_grmember`: which groups you're in
2. `incident`: open tickets in those groups
3. `incident`: tickets resolved since your last check
4. `incident`: tickets opened since your last check
5. `sys_user_grmember`: who is in the groups that own those tickets
6. `sys_user`: profile pictures for the people in the report (optional; initials are shown if it fails)

## The site

The site in [`site/`](site) is a Next.js app that builds to static files and is published to GitHub Pages on every push to `main`.

```sh
cd site
npm install
npm run dev
```

The site serves `ticket-check.js` at `/ticket-check.js`, which is what the bookmark loads. The copy button and the download are built from the same file, so they always match the script. The sample people's pictures are [DiceBear Notionists](https://www.dicebear.com/styles/notionists/) (CC0), generated with `npm run avatars`.

## License

[MIT](LICENSE)
