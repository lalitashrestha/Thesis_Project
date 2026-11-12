import { bestSideAngle, LM } from '../landmarks' // angle helper and body-point numbers
import { makeMetricDetector } from './makeMetricDetector' // builds a rep-counting detector

// Signal: shoulder-hip-knee angle, viewed from the side while lying down.
// Unlike squat/push-up/lunge, this one is LOW at rest (hips down, torso
// and thigh folded) and rises toward straight (~170 degrees) at the top of
// the bridge - makeMetricDetector works out the direction automatically
// from restValue < peakValue, no special-casing needed here.
const REST_ANGLE = 130 // hips down
const PEAK_ANGLE = 170 // hips lifted, body nearly straight

// Same knee-valgus idea as the squat detector: lying-down bridges are
// also prone to the knees dropping inward instead of staying tracked
// over the ankles.
const VALGUS_KNEE_TO_ANKLE_RATIO = 0.55 // knees closer than 55% of the ankle gap = fault
const MIN_ANKLE_SPREAD = 0.02 // only check when the ankles are clearly apart

// Form check: are the knees falling inward?
function checkGluteBridgeForm(landmarks) {
  const lk = landmarks[LM.LEFT_KNEE] // left knee
  const rk = landmarks[LM.RIGHT_KNEE] // right knee
  const la = landmarks[LM.LEFT_ANKLE] // left ankle
  const ra = landmarks[LM.RIGHT_ANKLE] // right ankle
  if (!lk || !rk || !la || !ra) return null // a point is missing: no verdict

  const kneeDist = Math.abs(lk.x - rk.x) // horizontal gap between the knees
  const ankleDist = Math.abs(la.x - ra.x) // horizontal gap between the ankles
  if (ankleDist > MIN_ANKLE_SPREAD && kneeDist < ankleDist * VALGUS_KNEE_TO_ANKLE_RATIO) { // knees much closer than ankles
    return 'Keep your knees in line with your hips — avoid letting them fall inward.' // fault message
  }
  return null // no fault
}

// Creates the glute-bridge detector.
export function createGluteBridgeDetector() {
  return makeMetricDetector({
    id: 'glute_bridge',
    label: 'Glute Bridge',
    computeMetric: (lm) => // signal: shoulder-hip-knee angle of the better-visible side
      bestSideAngle(
        lm,
        [LM.LEFT_SHOULDER, LM.LEFT_HIP, LM.LEFT_KNEE],
        [LM.RIGHT_SHOULDER, LM.RIGHT_HIP, LM.RIGHT_KNEE]
      ),
    restValue: REST_ANGLE,
    peakValue: PEAK_ANGLE,
    minDwellMs: 200,
    checkForm: checkGluteBridgeForm,
  })
}
