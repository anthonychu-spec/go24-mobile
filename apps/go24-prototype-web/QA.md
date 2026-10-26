# GO24 member app — verification

Checked on 2026-10-26 using the local server on port 4184 and the in-app browser.

## Browser flows passed

- Guest Home, Book, Passport and Profile render; member demo accepts a display name.
- Date and club filters change the sample timetable. Yuen Long + Reformer shows two sample sessions; other GO24 clubs do not receive these classes.
- A BODYPUMP session opens details, review and confirmation with the chosen club preserved.
- Confirmed sessions appear in Passport; completed visits remain at 3 when an upcoming booking is created.
- A simultaneous booking at a different club is rejected with an overlap message.
- Full Yoga Flow offers a waitlist and is shown separately from confirmed bookings.
- Cancelling removes a confirmed booking and reduces upcoming count without changing completed visits.
- The iCalendar download contains the selected class, club, 55-minute duration and correct conversion from Hong Kong time to UTC.
- Setting a home club updates the header and home card. Regional club filtering works. Home club and a changed visit goal survive reload.
- The central member pass opens a clearly marked, non-valid demo QR.
- Recovery shows the Kennedy Town walk-in arrangement and provides no reservation action.
- PT consultation saves a local request with the selected club, date, focus and period; no network submission occurs.

## Visual checks

- Desktop Home and Reformer timetable inspected visually.
- 390px Home and 375px Book inspected in the responsive preview. Both document widths equal their viewport width; no horizontal document overflow observed.
- Visible image assets loaded on the checked Home and Book screens.
- Saved screenshots: `previews/home-desktop.png` and `previews/mobile-preview.png`.
- Checked app JavaScript and server syntax with `node --check`.

## Limits

Real authentication, PGM, door access, payment, push delivery and staff integration are outside this prototype. Actual class schedules and membership entitlements are not validated against live member services. The test browser contains sample state; a new browser profile starts as a guest.

The browser inspection layer logged one MutationObserver error while working across preview iframes. The app source does not create a MutationObserver; the main app tab logged no app errors during the checked flows.

## v1.2 — BOFA sports and Foundry alignment

- Book categories are Sports / Recovery / Classes / Fitness in the Foundry order.
- Pickleball exposes Reserve / Social Play / What’s on / Coaching; Golf Sim exposes Reserve / Coaching only.
- Foundry booking component CSS and markup structure are retained for sport choice, service tiles, date/time inputs, Layout / List, favourites and recent reservations.
- A BOFA Pickleball reservation and a Golf Sim reservation were confirmed and shown with the correct venue in Passport. Sports confirmation does not add completed visits.
- Social Play level filter narrowed the list; a beginner Social Play place completed the shared confirmation flow. A Golf private coaching session reached review with the chosen coach, time and sample fee.
- Favourites saved Golf Bay 1 and Pickleball Court 1; both appeared via the Home shortcut and Book toolbar. Both survived reload.
- Choosing a favourite at an occupied time preserved its court and disabled Review. Layout and List show the same resource set.
- Book again reused Golf Bay 1 at 15:00 on a new upcoming Tuesday (3 November), excluding the original 27 October date.
- Booking preferences were saved; reload restored the preferred sport.
- Pickleball checkout contains Private / Open Match, a demo DUPR preference and Full Court / My Share choices. Golf has a private session and full-bay choice.
- Responsive sports previews checked at 390px and 375px: document widths equal viewport widths. Updated main tab logged no errors during final checks.
- Screenshots: `previews/favourite-courts.png`, `previews/sports-foundry.png`.

Sports calendar export uses the shared calendar writer and BOFA location. A subsequent browser download attempt timed out in browser automation; that new sports download was not verified end to end. The earlier class calendar export remains verified above.
