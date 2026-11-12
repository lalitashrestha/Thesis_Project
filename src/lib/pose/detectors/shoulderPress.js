import { LM, isVisible } from '../landmarks' // body-point numbers and visibility test
import { makeMetricDetector } from './makeMetricDetector' // builds a rep-counting detector

// Overhead press, filmed from the front. Signal: how far the wrists sit
// above the shoulders, as a fraction of torso length (so it does not
// depend on how far the user stands from the camera). Hands at the
// shoulders read about 0.2; arms fully overhead read about 1.0 or more.
// Holding dumbbells or nothing makes no difference: only the joints are
// tracked, not the equipment.
const REST_RATIO = 0.25 // hands at shoulder height
const PEAK_RATIO = 0.95 // arms nearly straight overhead

const MAX_LEAN = 0.3 // torso lean as fraction of torso length
const MAX_ASYMMETRY = 0.4 // wrist-height difference at the top

// Middle points of the shoulders and hips, plus the torso length (or null if not visible).
function torso(lm) {
  const need = [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP] // the four torso points
  if (!need.every((i) => isVisible(lm, i))) return null // torso not fully visible
  const sx = (lm[LM.LEFT_SHOULDER].x + lm[LM.RIGHT_SHOULDER].x) / 2 // shoulder middle (x)
  const sy = (lm[LM.LEFT_SHOULDER].y + lm[LM.RIGHT_SHOULDER].y) / 2 // shoulder middle (y)
  const hx = (lm[LM.LEFT_HIP].x + lm[LM.RIGHT_HIP].x) / 2 // hip middle (x)
  const hy = (lm[LM.LEFT_HIP].y + lm[LM.RIGHT_HIP].y) / 2 // hip middle (y)
  const length = Math.hypot(hx - sx, hy - sy) // torso length
  return length > 0.05 ? { sx, sy, hx, hy, length } : null // ignore an unrealistically short torso
}

// Height of each visible wrist above the shoulders, in torso lengths.
export function wristHeightRatios(lm) {
  const t = torso(lm) // torso measurements
  if (!t) return null
  const wrists = [LM.LEFT_WRIST, LM.RIGHT_WRIST].filter((i) => isVisible(lm, i)) // visible wrists only
  if (wrists.length === 0) return null // no wrist visible
  return wrists.map((i) => (t.sy - lm[i].y) / t.length) // y grows downward, so shoulder y minus wrist y = height above shoulder
}

// Signal for this exercise: average height of the visible wrists.
function wristHeight(lm) {
  const r = wristHeightRatios(lm)
  return r ? r.reduce((a, b) => a + b, 0) / r.length : null // average, or null
}

// Form check: leaning back, or pressing unevenly.
function checkPressForm(lm) {
  const t = torso(lm)
  if (!t) return null // cannot check without the torso
  if (Math.abs(t.hx - t.sx) / t.length > MAX_LEAN) { // shoulders shifted sideways from the hips: leaning
    return 'Keep your ribs down and your torso upright. Do not lean back to press.'
  }
  const r = wristHeightRatios(lm)
  if (r && r.length === 2 && Math.min(...r) > 0.7 && Math.abs(r[0] - r[1]) > MAX_ASYMMETRY) { // both arms high, but one much higher
    return 'Press both arms up evenly.'
  }
  return null // no fault
}

// Creates the shoulder-press detector.
export function createShoulderPressDetector() {
  return makeMetricDetector({
    id: 'dumbbell_shoulder_press',
    label: 'Shoulder Press',
    computeMetric: wristHeight, // signal: wrist height above the shoulders
    restValue: REST_RATIO,
    peakValue: PEAK_RATIO,
    minDwellMs: 250,
    checkForm: checkPressForm,
  })
}
