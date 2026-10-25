# Verification — 2026-10-25

Verified in the Codex in-app browser against the local preview.

- Guest Home and all four main destinations render.
- Class date selection shows the selected day’s sessions; elapsed sessions are hidden.
- Class details → demo sign-in → review → confirmation → Passport booking works.
- Cancelling that booking removes it from Passport and changes the upcoming count.
- Recovery circuit → select 10:30 → review → confirmation appears in Passport and Home.
- An overlapping Cold plunge at 10:30 is rejected with the overlap message.
- Fully booked class → waitlist changes the button to Waitlisted and states the place is not confirmed.
- Coaching consultation saves a local request and states no coach has been contacted.
- Central member-pass shortcut opens the illustrative pass with an explicit non-valid entry label.
- Visit goal changed from 16 to 12; progress and remaining visits update.
- Personal-details form saves and returns to the profile.
- Reload retains the demo session and locally saved bookings.
- 390px Home and 375px Book reviewed visually in same-origin mobile preview frames.
- Desktop preview reviewed at approximately 1280 × 720; preview rail fits without clipped branding.
- No console errors reported by the tested browser tab.
- JavaScript syntax checked with `node --check project/app.js`.

Not production tested: real authentication, payments, entry, backend booking, push, native installation or real coach availability. Calendar export is implemented but the device calendar import was not exercised. Other widths, devices and assistive technologies have not been comprehensively tested.

Colour refinement: added LAB red to the hero label and underline, Classes shortcut, card edges, active navigation and central member-pass button. Refreshed desktop Home in browser and captured updated mobile previews. CSS-only change; interaction logic unchanged.
