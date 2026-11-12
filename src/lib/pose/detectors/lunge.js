import { bestSideAngle, LM } from '../landmarks' // angle helper and body-point numbers
import { makeMetricDetector } from './makeMetricDetector' // builds a rep-counting detector

// Reuses the same knee-angle signal as the squat detector. A lunge and a
// squat are distinguished by which exercise the user selected in the plan,
// not by the pose itself, so no separate geometric test is needed here -
// see Chapter 4's rationale for keeping detectors simple and explainable.
// The peak threshold is a little shallower than the squat's, since a
// lunge's front-knee bend is often not as deep as a full squat.
const REST_ANGLE = 160 // standing: knee nearly straight
const PEAK_ANGLE = 110 // bottom of the lunge: knee bent

// Torso-upright check: the shoulder midpoint shouldn't drift far
// horizontally from the hip midpoint. A forward-leaning torso (common
// when lunging too far forward) shows up as a large horizontal offset
// relative to the vertical shoulder-to-hip distance.
const MAX_LEAN_RATIO = 0.5 // sideways shift more than half the torso height = leaning
const MIN_TORSO_HEIGHT = 0.05 // only check when the torso is clearly visible

// Form check: is the torso leaning forward?
function checkLungeForm(landmarks) {
  const ls = landmarks[LM.LEFT_SHOULDER]
  const rs = landmarks[LM.RIGHT_SHOULDER]
  const lh = landmarks[LM.LEFT_HIP]
  const rh = landmarks[LM.RIGHT_HIP]
  if (!ls || !rs || !lh || !rh) return null // a point is missing: no verdict

  const shoulderMidX = (ls.x + rs.x) / 2 // middle of the shoulders (x)
  const shoulderMidY = (ls.y + rs.y) / 2 // middle of the shoulders (y)
  const hipMidX = (lh.x + rh.x) / 2 // middle of the hips (x)
  const hipMidY = (lh.y + rh.y) / 2 // middle of the hips (y)
  const dx = Math.abs(shoulderMidX - hipMidX) // horizontal shift of the shoulders over the hips
  const dy = Math.abs(shoulderMidY - hipMidY) // vertical torso height
  if (dy > MIN_TORSO_HEIGHT && dx / dy > MAX_LEAN_RATIO) { // leaning too far
    return 'Keep your torso upright during the lunge — avoid leaning forward.' // fault message
  }
  return null // no fault
}

// Creates the lunge detector.
export function createLungeDetector() {
  return makeMetricDetector({
    id: 'lunge',
    label: 'Forward Lunge',
    computeMetric: (lm) => // signal: knee angle of the better-visible leg
      bestSideAngle(
        lm,
        [LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE],
        [LM.RIGHT_HIP, LM.RIGHT_KNEE, LM.RIGHT_ANKLE]
      ),
    restValue: REST_ANGLE,
    peakValue: PEAK_ANGLE,
    minDwellMs: 200,
    checkForm: checkLungeForm,
  })
}
