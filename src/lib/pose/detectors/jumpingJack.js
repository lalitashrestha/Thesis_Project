import { LM } from '../landmarks' // body-point numbers
import { makeMetricDetector } from './makeMetricDetector' // builds a rep-counting detector

// Signal: ankle-to-ankle distance, normalized by shoulder width so it
// stays consistent regardless of how far the user stands from the camera.
// Small (feet together) at rest, large (feet jumped out) at the peak.
const REST_SPREAD = 0.4 // feet together: ankle gap about 0.4 shoulder widths
const PEAK_SPREAD = 1.6 // feet out: ankle gap about 1.6 shoulder widths

// Ankle gap divided by shoulder width (the signal for this exercise).
function ankleSpreadRatio(landmarks) {
  const la = landmarks[LM.LEFT_ANKLE]
  const ra = landmarks[LM.RIGHT_ANKLE]
  const ls = landmarks[LM.LEFT_SHOULDER]
  const rs = landmarks[LM.RIGHT_SHOULDER]
  if (!la || !ra || !ls || !rs) return null // a point is missing: no reading
  const shoulderWidth = Math.hypot(ls.x - rs.x, ls.y - rs.y) // distance between the shoulders
  if (shoulderWidth === 0) return null // avoid dividing by zero
  const ankleSpread = Math.hypot(la.x - ra.x, la.y - ra.y) // distance between the ankles
  return ankleSpread / shoulderWidth // gap in "shoulder widths"
}

// Arms-overhead check: only meaningful once the legs are near their
// peak spread (otherwise "arms not up yet" is just normal mid-rep
// motion, not a fault).
const ARM_CHECK_SPREAD_THRESHOLD = 1.1

// Form check: are the arms overhead when the feet are wide?
function checkJumpingJackForm(landmarks) {
  const spread = ankleSpreadRatio(landmarks) // how wide the feet are
  if (spread == null || spread < ARM_CHECK_SPREAD_THRESHOLD) return null // feet not wide yet: nothing to check

  const ls = landmarks[LM.LEFT_SHOULDER]
  const rs = landmarks[LM.RIGHT_SHOULDER]
  const lw = landmarks[LM.LEFT_WRIST]
  const rw = landmarks[LM.RIGHT_WRIST]
  if (!ls || !rs || !lw || !rw) return null // a point is missing: no verdict

  // Image y grows downward, so a raised wrist has a smaller y than the
  // shoulder.
  const armsRaised = lw.y < ls.y && rw.y < rs.y // both wrists above their shoulders?
  if (!armsRaised) {
    return 'Raise your arms all the way overhead as your feet jump out.' // fault message
  }
  return null // no fault
}

// Creates the jumping-jack detector.
export function createJumpingJackDetector() {
  return makeMetricDetector({
    id: 'jumping_jack',
    label: 'Jumping Jack',
    computeMetric: ankleSpreadRatio, // signal: ankle gap in shoulder widths
    restValue: REST_SPREAD,
    peakValue: PEAK_SPREAD,
    minDwellMs: 150, // shorter debounce because jumping jacks are fast
    checkForm: checkJumpingJackForm,
  })
}
