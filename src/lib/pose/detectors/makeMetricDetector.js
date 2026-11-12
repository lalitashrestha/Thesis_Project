import { TwoPhaseRepCounter } from './common' // the two-phase counter shared by every repetition exercise

/**
 * Builds a rep-counting detector from any single numeric signal - a joint
 * angle in degrees, or a normalized landmark distance. `restValue` is what
 * the signal reads at the resting/start position, `peakValue` is what it
 * reads at the peak of the movement. Whether the raw signal rises or falls
 * during the movement is worked out automatically from those two numbers,
 * so each exercise file only has to describe what its two end positions
 * look like, not manage sign flips itself.
 *
 * `minDwellMs` is a debounce: the minimum time the signal must stay past a
 * threshold before a phase change is accepted, filtering out single-frame
 * jitter from the pose model. All thresholds here are starting points -
 * this project's own risk analysis (see the dissertation's Chapter 3)
 * expects these to need tuning against real camera footage, so they are
 * kept as plain top-of-file constants in each exercise's detector file
 * rather than buried in logic.
 *
 * `checkForm` is optional: `(landmarks, phase) => string | null`. It runs
 * every frame alongside the rep-counting signal and looks for a specific,
 * common form fault for that exercise (e.g. knees caving in, hips
 * sagging). Returning a string flags that fault with that message;
 * returning null/undefined means no fault was found this frame. A
 * detector with no `checkForm` simply never flags a fault (`formOk` stays
 * `null` throughout) - form checking is a best-effort addition on top of
 * rep counting, not every exercise has one yet.
 */
export function makeMetricDetector({
  id, // exercise id, e.g. 'squat'
  label, // readable name
  computeMetric, // function that turns the 33 body points into one number (an angle or a distance)
  restValue, // value of that number at the start position
  peakValue, // value of that number at the peak of the movement
  minDwellMs = 200, // debounce time in milliseconds
  checkForm, // optional form-fault check
}) {
  const ascending = peakValue > restValue // true if the signal goes UP during the movement (e.g. glute bridge)
  const toInternal = (v) => (ascending ? -v : v) // flip rising signals so the counter always sees "high at rest, low at peak"
  const counter = new TwoPhaseRepCounter({ // the counter for this exercise
    enterHighThreshold: toInternal(restValue), // back at the start
    enterLowThreshold: toInternal(peakValue), // at the peak
    minDwellMs,
  })
  let lastRaw = null // last valid reading, shown on screen when a frame has no reading

  return {
    id,
    label,
    restValue,
    peakValue,

    /** Raw signal for one frame (used by the calibration step). */
    readMetric: computeMetric,

    /** Moves the "back at start" threshold, e.g. after calibration. */
    setRestValue(value) {
      counter.enterHighThreshold = toInternal(value) // replace the start threshold with the calibrated one
    },

    // Clears the counter between sets.
    reset() {
      counter.reset()
      lastRaw = null
    },

    /**
     * Feed one frame. Returns
     * { ok, phase, repCompleted, reps, metric, formOk, formMessage }.
     * `formOk`/`formMessage` are null when this detector has no
     * `checkForm`, `true`/null when the frame passed the check, and
     * `false`/a message string when a fault was found.
     */
    update(landmarks, nowMs) {
      const raw = computeMetric(landmarks) // this frame's angle or distance
      if (raw == null) { // the needed body points were not visible
        return {
          ok: false, // no usable reading this frame
          phase: counter.phase, // phase stays as it was
          repCompleted: false,
          reps: counter.reps,
          metric: lastRaw, // show the last good reading
          formOk: null,
          formMessage: null,
        }
      }
      lastRaw = raw // remember this reading
      const { phase, repCompleted, reps } = counter.update(toInternal(raw), nowMs) // feed the counter
      const formMessage = checkForm ? checkForm(landmarks, phase) ?? null : null // run the form check, if this exercise has one
      const formOk = checkForm ? formMessage == null : null // true = no fault, false = fault, null = no check
      return {
        ok: true, // usable reading
        phase, // 'high' or 'low'
        repCompleted, // true on the frame a rep finishes
        reps, // repetitions counted so far
        metric: Math.round(raw * 10) / 10, // the reading rounded to 1 decimal, for display
        formOk,
        formMessage, // text shown (and spoken) when a fault is found
      }
    },
  }
}
