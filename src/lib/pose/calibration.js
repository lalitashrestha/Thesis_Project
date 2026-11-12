// Per-user calibration of the "back at the start position" threshold.
//
// Every detector ships with a population-level starting value (e.g. 160
// degrees of knee extension for a squat). People differ: someone who
// stands with slightly bent knees may never reach 160 and so never
// finishes a rep. Before a set, the camera screen asks the user to hold
// the starting position for two seconds, takes the median of the signal
// over that time, and nudges the detector's rest threshold to match.
//
// Guard rails: the measured value is only used if it is close enough to
// the default that it plausibly IS the start position (otherwise the user
// was probably mid-movement or mis-framed), and the resulting threshold is
// clamped to stay near the default so one odd reading cannot break
// counting. The peak value is deliberately not changed.

export const CALIBRATION_MS = 2000 // the user holds the start position for 2 seconds
const PULL_TOWARD_PEAK = 0.15 // threshold sits 15% of the way from rest to peak
const MAX_DEVIATION = 0.6 // measured rest may differ from default by at most 60% of the range
const MAX_SHIFT = 0.35 // final threshold may move at most 35% of the range from default

// The middle value of a list (less affected by a few bad readings than the average).
export function median(values) {
  if (!values.length) return null // empty list: no median
  const s = [...values].sort((a, b) => a - b) // sorted copy, smallest first
  const mid = Math.floor(s.length / 2) // index of the middle
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2 // odd count: middle value; even count: average of the two middle values
}

/**
 * @returns {{ used: boolean, restValue: number, measured: number|null, reason?: string }}
 */
export function calibrateRest(samples, defaultRest, peak) {
  const measured = median(samples) // typical signal while the user held still, e.g. 165 degrees
  if (measured == null || samples.length < 8) { // fewer than 8 readings is not enough to trust
    return { used: false, restValue: defaultRest, measured, reason: 'too few readings' } // keep the default
  }
  const range = Math.abs(defaultRest - peak) // size of the movement, e.g. 160 - 100 = 60
  if (Math.abs(measured - defaultRest) > MAX_DEVIATION * range) { // reading is too far from a normal start position
    return {
      used: false, // ignore the measurement
      restValue: defaultRest, // keep the default threshold
      measured,
      reason: 'start position looked different from expected',
    }
  }
  let adjusted = measured + PULL_TOWARD_PEAK * (peak - measured) // move 15% towards the peak so returning to start is easy to reach
  const lo = defaultRest - MAX_SHIFT * range // lowest allowed threshold
  const hi = defaultRest + MAX_SHIFT * range // highest allowed threshold
  adjusted = Math.min(hi, Math.max(lo, adjusted)) // keep the result within those limits
  return { used: true, restValue: Math.round(adjusted * 100) / 100, measured } // new threshold, rounded to 2 decimals
}
