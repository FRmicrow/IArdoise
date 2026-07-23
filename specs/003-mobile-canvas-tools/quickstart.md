# Quickstart: Mobile Fullscreen Canvas & Drawing Tools

Manual verification steps once the implementation is in place.

## 1. Start the app

```bash
npm install        # picks up the new `fabric` + `@erase2d/fabric` frontend deps
npm run dev         # or the project's existing per-workspace dev scripts
```

Host a session from a desktop browser, then join as a player from a phone (or Chrome DevTools device emulation / Safari Responsive Design Mode) using the join link/QR code.

## 2. Verify full-screen canvas (User Story 1)

1. On the player device, wait for the host to publish a phrase (or start the game).
2. Confirm the screen shows **only** the phrase text at the top and the canvas filling everything below it — no other visible chrome, gap, or empty margin.
3. In a real mobile browser (not just emulation), scroll or tap to trigger the address bar collapsing/reappearing. Confirm the canvas resizes to keep filling the screen with no clipped strokes or gaps.
4. Rotate the device between portrait and landscape. Confirm the canvas re-fills the new dimensions and any strokes already drawn stay visible and correctly placed.

## 3. Verify eraser (User Story 2)

1. Draw a few strokes.
2. Switch to the eraser tool and drag over part of the drawing.
3. Confirm only the touched marks disappear; untouched strokes are unaffected.
4. Switch back to the draw tool and confirm normal drawing resumes with the previously selected color/width.

## 4. Verify color control (User Story 3)

1. Open the color control and pick a different color.
2. Draw a new stroke — confirm it uses the new color.
3. Confirm strokes drawn before the change kept their original color.

## 5. Verify stroke size control (User Story 4)

1. Open the size control and change the thickness.
2. Draw a new stroke — confirm it uses the new thickness.
3. Confirm strokes drawn before the change kept their original thickness.

## 6. Regression check

- Confirm the host's separate "Mon canevas" tab still works as before (out of scope for this feature — should be unchanged).
- Confirm desktop/tablet layout is unaffected.
- Confirm the app still installs as a PWA and still works offline after a first successful load (per Constitution's Frontend & UX Standards).
