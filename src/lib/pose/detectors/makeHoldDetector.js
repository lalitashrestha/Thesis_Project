/**
 * Builds a hold (isometric) detector: instead of counting repetitions it
 * accumulates the time the body spends in a correct position. The timer
 * pauses, rather than resets, when the position breaks, so a wobble costs
 * the user seconds, not the whole set.
 *
 * `checkPosition(landmarks)` returns null when the position cannot be
 * judged this frame (landmarks missing), otherwise
 * `{ inPosition: boolean, message: string|null, metric: number|null }`.
 */
export function makeHoldDetector({ id, label, checkPosition }) {
  let heldMs = 0 // total time held in the correct position, in milliseconds
  let lastT = null // time of the previous frame
  let lastMetric = null // last measured angle, for display

  return {
    id,
    label,
    kind: 'hold', // tells the camera screen this is a timed exercise

    // Clears the timer between sets.
    reset() {
      heldMs = 0
      lastT = null
      lastMetric = null
    },

    // Lets the camera screen read the time held so far.
    get heldMs() {
      return heldMs
    },

    // Called once per video frame.
    update(landmarks, nowMs) {
      // Cap dt so a stalled frame (tab in background) cannot add seconds.
      const dt = lastT == null ? 0 : Math.min(250, Math.max(0, nowMs - lastT)) // time since the previous frame, at most 250 ms
      lastT = nowMs // remember this frame's time
      const res = checkPosition(landmarks) // is the body in the correct position?
      if (!res) { // body points missing: cannot judge this frame
        return { ok: false, kind: 'hold', holding: false, heldMs, metric: lastMetric, formOk: null, formMessage: null }
      }
      if (res.inPosition) heldMs += dt // in position: add this frame's time to the timer
      if (res.metric != null) lastMetric = Math.round(res.metric * 10) / 10 // remember the angle (1 decimal)
      return {
        ok: true,
        kind: 'hold',
        holding: res.inPosition, // true while the timer is running
        heldMs, // total time held so far
        dtMs: dt, // time added on this frame
        metric: lastMetric,
        formOk: res.inPosition, // in position counts as good form
        formMessage: res.inPosition ? null : res.message, // tell the user what to fix when out of position
      }
    },
  }
}
