# Adaptive Home Workout

A Progressive Web App that builds a personalised home workout plan, adapts it
week to week based on what you actually complete, and — for seven bodyweight
exercises — uses your device's camera to count reps automatically via
on-device pose detection. Built for a BSc final-year dissertation project
("Adaptive Home Workout Planning with Camera-Based Exercise Verification").

Everything runs client-side: no account, no server, no database, no paid
APIs. Your plan and progress live in your browser's `localStorage`; your
camera feed is processed on-device and never leaves the browser.

## How to install and run

### Option 1: open it straight away (no installation)

Double-click **`Adaptive-Home-Workout.html`** in this folder. It opens the
whole app in Chrome or Edge. Allow camera access when the browser asks. The
first camera session needs an internet connection to download the pose model.

### Option 2: run from the source code

**You need:** [Node.js](https://nodejs.org) version 20.19 or newer (22 LTS
recommended; npm comes with it), Chrome or Edge, and a webcam for the camera
features.

1. Open a terminal in this folder (the one that contains `package.json`).
2. Install the libraries (needs internet, about a minute; this creates the
   `node_modules` folder):

   ```bash
   npm install
   ```

3. Start the app:

   ```bash
   npm run dev
   ```

4. Open the address it prints, normally **http://localhost:5173**, in Chrome
   or Edge. Click **"Start fitness now"**, complete the short setup, and the
   weekly plan appears. Press **Start** on an exercise to use the camera, or
   tick it off by hand.
5. Press `Ctrl + C` in the terminal to stop the app.

Use `localhost` on the same computer: browsers only allow the camera on
`localhost` or `https://` pages.

### Running the tests

```bash
npm test
```

This runs the 25 unit tests (rep counting, calibration, weekly adaptation
and helpers). `node tests/scenarios.mjs` re-runs the scenario evaluation
used in the report.

### Troubleshooting

- **`npm` is not recognised:** install Node.js, then open a new terminal.
- **Camera does not start:** allow camera permission in the browser's
  address bar, and close other apps that are using the webcam.
- **Blank page:** make sure you opened the `localhost` address printed by
  `npm run dev`, not `index.html` directly.

No account, server or database is needed. All data is stored in the
browser's `localStorage`.

## How it works

- **Landing page** - describes the app, with a live demo of the counting
  logic, animated exercise figures and a "Start fitness now" button that
  opens the app itself.
- **Onboarding** - goal, equipment, space and training days generate a
  weekly plan from the exercise library (`src/data/exercises.js`). Setup can
  be edited later without losing history.
- **Plan** - each exercise is camera-verified ("Start") or ticked off by
  hand. Progress through the week is saved, so a refresh loses nothing.
- **Camera sessions** (`CameraSession.jsx`) - how-to, a 2 second start-position
  calibration, then real sets with rest timers. Reps with a form fault are not
  counted. If form slips on a set, the next set is trimmed. Plank and wall sit
  are timed by posture. Optional voice cues; screen stays awake.
- **Eleven of twelve exercises are camera-tracked**: squat, push-up, lunge,
  glute bridge, jumping jack, mountain climber, cat-cow, band row, dumbbell
  shoulder press (rep counters) and plank, wall sit (hold timers). Equipment
  moves are tracked through the user's joints, not the equipment. Only the
  World's Greatest Stretch is ticked off by hand.
- **Weekly adaptation** - volume rises about 10% (at least +1) when an exercise
  was completed at least 80% of the time AND camera-checked form was clean at
  least 75% of the time. Otherwise it holds; it never reduces. Caps: 5 sets,
  2x starting reps, 90 s holds (`src/lib/planGenerator.js`).
- **Progress** - completion by week, volume per exercise, a plain-language reason
  for every plan change, counter agreement with the user's own counts, and a
  JSON export of all stored data.

Privacy: camera frames and landmarks are processed in memory and discarded.
Only counts, hold times and form scores are stored (`localStorage`).

## Notes on camera access

Camera access requires a **secure context**. `localhost` counts, but a plain
`http://` LAN IP does not, so test from the machine running the dev server
(or via a tunnel/HTTPS).

> **The camera cannot be tested in a sandboxed preview iframe** (e.g. a
> published chat artifact preview) — browsers block `getUserMedia` there.
> Use `npm run dev` on `localhost`, or a real HTTPS deployment.

## Opening without a server

`Adaptive-Home-Workout.html` (built with `SINGLEFILE=true npm run build`,
output in `dist-singlefile/index.html`) is the whole app in one file. Double
click it to open it in Chrome or Edge. The browser asks for camera permission
each time on a `file://` page. The first camera session needs internet to
download the pose model.

## Tests

```bash
npm test          # unit tests: detectors, calibration, adaptation, helpers
```

`tests/e2e/` holds a mock pose engine and build config used to drive a full
camera session (calibration, sets, rejected reps, trimmed set, summary) in
headless Chromium without a real person.

## Deploying (Vercel)

1. Push this repository to GitHub.
2. In Vercel, "Add New Project" → import the repo. Vercel auto-detects Vite;
   no configuration needed (`vercel.json` here only sets cache headers on
   the service worker and manifest so updates roll out promptly).
3. Deploy. The resulting `https://…vercel.app` URL is a valid secure context,
   so the camera works there on any device.
4. Visiting that URL and choosing "Add to Home Screen" / "Install" installs
   it as a standalone app (the PWA manifest + service worker, generated by
   `vite-plugin-pwa`, are what make that possible).

## Tuning the camera detectors

Every detector in `src/lib/pose/detectors/` is a small config (rest/peak
angle or ratio, a debounce time) passed to a shared factory
(`makeMetricDetector.js`). The camera screen shows a live "signal" readout
under the rep counter — the detector's raw metric — specifically so
thresholds can be checked and retuned against real footage rather than
guessed once and left. These starting values were set analytically (typical
joint angles at rest vs at the bottom/top of each movement); they have not
yet been validated against recorded evaluation footage — see the
dissertation's evaluation chapter for that process once real data exists.

## Project structure

```
src/
  components/       Onboarding, PlanView, CameraSession (camera + skeleton UI)
  data/exercises.js  Exercise library (equipment/space/goal filters, camera metadata)
  lib/
    storage.js       localStorage wrapper (profile, plans, weekly logs)
    planGenerator.js Initial plan generation + weekly adaptation logic
    pose/
      poseEngine.js         MediaPipe PoseLandmarker setup + detection loop
      drawSkeleton.js       Canvas skeleton overlay rendering
      landmarks.js          Landmark indices + angle/visibility helpers
      detectorRegistry.js   Maps exercise id -> detector factory
      detectors/            One file per exercise (makeMetricDetector.js for reps, makeHoldDetector.js for holds)
      calibration.js        Per-user start-position calibration
      session.js            Set targets and the in-session nudge
    progress.js      Series and stats for the Progress screen
```

## Build modes

- `npm run build` — the real, deployable build (`dist/`): full PWA manifest
  and service worker.
- `SINGLEFILE=true npm run build` — a single inlined HTML file
  (`dist-singlefile/`), used only for quick, non-camera UI previews (e.g. a
  shareable static preview link). No service worker/PWA in this mode.
