/**
 * A two-phase ('high'/'low') rep counter with hysteresis and a minimum
 * dwell time, to avoid a single noisy frame flipping the phase or
 * registering a rep.
 *
 * The convention used everywhere in this app: the caller always transforms
 * its raw signal so that it reads HIGH at the resting/start position and
 * LOW at the peak of the movement (see makeMetricDetector.js, which does
 * this transform automatically). `enterHighThreshold`/`enterLowThreshold`
 * are the hysteresis band edges - the gap between them is what prevents
 * flicker right at a single cutoff value, so it should comfortably span
 * the noisy middle of the movement, not sit right at the halfway point.
 */
export class TwoPhaseRepCounter {
  constructor({ enterHighThreshold, enterLowThreshold, minDwellMs = 150 }) {
    this.enterHighThreshold = enterHighThreshold // signal must rise to this to count as "back at the start" (e.g. 160° for a squat)
    this.enterLowThreshold = enterLowThreshold // signal must fall to this to count as "at the bottom" (e.g. 100° for a squat)
    this.minDwellMs = minDwellMs // minimum time between two phase changes, so one noisy frame cannot flip the phase
    this.phase = 'high' // every set starts in the start position
    this.lastTransitionAt = 0 // time of the last phase change
    this.reps = 0 // repetitions counted so far
    this.wasLowSinceHigh = false // has the user reached the bottom since the last return to the top?
  }

  // Puts the counter back to its starting state (used between sets).
  reset() {
    this.phase = 'high'
    this.lastTransitionAt = 0
    this.reps = 0
    this.wasLowSinceHigh = false
  }

  /** Feed one frame's metric value. Returns { phase, repCompleted, reps }. */
  update(value, nowMs) {
    let repCompleted = false // becomes true only on the frame where a rep finishes
    const sinceTransition = nowMs - this.lastTransitionAt // time since the last phase change

    if (
      this.phase === 'high' && // currently at the top...
      value <= this.enterLowThreshold && // ...the signal has dropped to the bottom threshold...
      sinceTransition > this.minDwellMs // ...and enough time has passed
    ) {
      this.phase = 'low' // switch to the bottom phase
      this.lastTransitionAt = nowMs // remember when
      this.wasLowSinceHigh = true // the bottom has been reached in this rep
    } else if (
      this.phase === 'low' && // currently at the bottom...
      value >= this.enterHighThreshold && // ...the signal has risen back to the top threshold...
      sinceTransition > this.minDwellMs // ...and enough time has passed
    ) {
      this.phase = 'high' // switch back to the top phase
      this.lastTransitionAt = nowMs
      if (this.wasLowSinceHigh) { // a full down-and-up cycle happened
        this.reps += 1 // count one repetition
        repCompleted = true // tell the caller a rep just finished
        this.wasLowSinceHigh = false // start waiting for the next bottom
      }
    }

    return { phase: this.phase, repCompleted, reps: this.reps } // the counter's state after this frame
  }
}
