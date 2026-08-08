# Sprint Timer

A camera-based sprint timer for training sessions. Place a phone, tablet, or
laptop at the finish line — it runs the starting commands, fires the gun,
and detects when you cross the line using on-device pose detection. Nothing
leaves the browser: the camera feed is processed locally and never uploaded.

## Quick start

```bash
npm install
npm run dev
```

Open the printed `localhost` URL **on the device you're placing at the
finish line**. Grant camera access, test the sound, then tap **Start Race**.

### Using a phone at the finish line

Browsers only allow camera access (`getUserMedia`) on a **secure context**:
`https://` or `http://localhost`. Running `npm run dev` directly on the
phone's own browser and opening `localhost:5173` works out of the box.

If instead you want to open the dev server *from* a phone while it runs on
a laptop, `npm run dev` already binds to your LAN (`--host` is on by
default in `vite.config.ts`), but you'll need HTTPS for the camera to work
from another device. Easiest options:
- Deploy the built app (`npm run build`) to any static HTTPS host (Vercel,
  Netlify, GitHub Pages, etc.) and open it there.
- Use a tunnel like `ngrok http 5173`, which gives you an HTTPS URL.

## How it works

**Preparation (60s countdown)** → **"On your marks"** → **"Set"** (random
1.2–2.8s hold, so the gun timing isn't predictable) → **synthesized
starting-gun sound** → timer starts → pose detection watches for the
athlete crossing the center line → timer stops and the result is shown.

- **Timing** — `src/hooks/useSprintTimer.ts`. The gun and finish-line
  timestamps are both taken from `performance.now()`; the on-screen
  digits update via `requestAnimationFrame`, but the *recorded* time is
  always the raw timestamp difference, independent of frame rate.
- **Audio** — `src/hooks/useRaceAudio.ts`. "On your marks" / "Set" use the
  browser's built-in `SpeechSynthesis`. The starting gun is synthesized
  with the Web Audio API (filtered noise burst + a low thump) — no audio
  files to fetch, works offline. The `AudioContext` is created/resumed
  from the Start Race button's own click handler so it survives autoplay
  restrictions.
- **Finish-line detection** — `src/hooks/usePoseDetection.ts`. Loads
  TensorFlow.js MoveNet (SinglePose Lightning) and, once the race is
  running, tracks the smoothed horizontal position of the athlete's torso
  (shoulders/hips — the most stable keypoints). A crossing is only
  confirmed once the tracked point has moved to the opposite side of the
  frame's center from where it started **and stayed there for 3
  consecutive frames**, and only for detections large enough to plausibly
  be someone right at the line. This combination is what filters out
  shadows, wind, background people, and momentary glitches.
- **Camera** — `src/hooks/useCamera.ts`. Requests the rear/environment
  camera, since the device faces across the track rather than the
  athlete's face.
- **History** — `src/hooks/useHistory.ts`. Saved sprints live in
  `localStorage`; nothing is sent to a server. Results aren't auto-saved —
  tap **Save Result** after a run so a false trigger can be discarded
  instead of polluting your history.

## Tuning finish-line detection

All the relevant constants are at the top of `src/hooks/usePoseDetection.ts`:

| Constant | Purpose |
|---|---|
| `CONFIDENCE_THRESHOLD` | Minimum keypoint confidence to trust. Raise if you see false positives in bad lighting. |
| `CROSS_CONFIRM_FRAMES` | Consecutive frames required past the line before triggering. Raise for more certainty, lower for less lag. |
| `SMOOTHING` | Exponential smoothing on the tracked x-position. Lower = smoother/slower to react, higher = snappier/noisier. |
| `MIN_BODY_WIDTH_RATIO` | Minimum detected body width (relative to frame width) to be considered "close enough" to the line. Filters out distant background people. |

## Camera placement

The app assumes a **side-on, photo-finish style setup**: the device sits at
the finish line facing *across* the track, and the athlete runs
left-to-right or right-to-left through frame, crossing the vertical line in
the center of the preview. It is not designed for a camera facing straight
down the track toward an oncoming runner.

## Tech stack

React + TypeScript + Vite, Tailwind CSS, TensorFlow.js (`@tensorflow-models/pose-detection`,
MoveNet) for on-device pose detection, Web Audio API + SpeechSynthesis for
starter audio, `localStorage` for history. No backend.

## Known limitations

- Pose detection needs a reasonably clear view of the athlete's torso —
  very loose/baggy clothing, extreme low light, or another person crossing
  the line at the same moment can affect accuracy.
- MoveNet runs single-pose (fastest for real-time use); if multiple people
  are in frame it tracks whichever detection is strongest.
- The 60-second prep countdown, "On your marks" → "Set" gaps, and gun-hold
  window are all timed constants — adjust them in `src/App.tsx` if you want
  a different rhythm.
