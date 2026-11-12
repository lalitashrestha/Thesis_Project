import { LM, bestSideAngle, isVisible } from '../landmarks' // geometry helpers and body-point numbers
import { makeMetricDetector } from './makeMetricDetector' // builds a rep-counting detector

// Standing band row, filmed side-on. Signal: shoulder-elbow-wrist angle.
// Arm extended toward the anchor reads about 160 degrees; pulled back
// with the elbow bent reads about 80. The band itself is never detected.
const REST_ANGLE = 155 // arm extended
const PEAK_ANGLE = 85 // elbow pulled back
const MAX_LEAN = 0.4 // |dx|/|dy| of shoulder over hip

// Form check: is the user leaning away to pull?
function checkRowForm(lm) {
  const need = [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP] // torso points
  if (!need.every((i) => isVisible(lm, i))) return null // torso not visible: no verdict
  const sx = (lm[LM.LEFT_SHOULDER].x + lm[LM.RIGHT_SHOULDER].x) / 2 // shoulder middle (x)
  const sy = (lm[LM.LEFT_SHOULDER].y + lm[LM.RIGHT_SHOULDER].y) / 2 // shoulder middle (y)
  const hx = (lm[LM.LEFT_HIP].x + lm[LM.RIGHT_HIP].x) / 2 // hip middle (x)
  const hy = (lm[LM.LEFT_HIP].y + lm[LM.RIGHT_HIP].y) / 2 // hip middle (y)
  const dy = Math.abs(hy - sy) // vertical torso length
  if (dy > 0.05 && Math.abs(sx - hx) / dy > MAX_LEAN) { // shoulders far behind/in front of the hips
    return 'Stay tall. Pull with your back, not by leaning away.'
  }
  return null // no fault
}

// Creates the band-row detector.
export function createStandingRowDetector() {
  return makeMetricDetector({
    id: 'standing_row',
    label: 'Band Row',
    computeMetric: (lm) => // signal: elbow angle of the better-visible arm
      bestSideAngle(
        lm,
        [LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.LEFT_WRIST],
        [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW, LM.RIGHT_WRIST]
      ),
    restValue: REST_ANGLE,
    peakValue: PEAK_ANGLE,
    minDwellMs: 250,
    checkForm: checkRowForm,
  })
}
