import { bestSideAngle, LM } from '../landmarks' // angle helper and body-point numbers
import { makeMetricDetector } from './makeMetricDetector' // builds a rep-counting detector

// Signal: hip-knee-ankle angle of whichever leg is better visible.
// Near-straight (~160-180 degrees) standing, folds toward ~90-100 degrees
// at the bottom of the squat.
const REST_ANGLE = 160 // standing: knee nearly straight
const PEAK_ANGLE = 100 // bottom of the squat: knee bent

// Knee valgus check: if the knees are noticeably narrower apart than the
// ankles, they're caving inward rather than tracking over the toes - a
// common squat fault. The 0.6 factor and 0.02 minimum ankle spread are
// starting points, like the angle thresholds above.
const VALGUS_KNEE_TO_ANKLE_RATIO = 0.6 // knees closer than 60% of the ankle gap = fault
const MIN_ANKLE_SPREAD = 0.02 // only check when the ankles are clearly apart

// Form check: are the knees caving inward?
function checkSquatForm(landmarks) {
  const lk = landmarks[LM.LEFT_KNEE] // left knee
  const rk = landmarks[LM.RIGHT_KNEE] // right knee
  const la = landmarks[LM.LEFT_ANKLE] // left ankle
  const ra = landmarks[LM.RIGHT_ANKLE] // right ankle
  if (!lk || !rk || !la || !ra) return null // a point is missing: no verdict

  const kneeDist = Math.abs(lk.x - rk.x) // horizontal gap between the knees
  const ankleDist = Math.abs(la.x - ra.x) // horizontal gap between the ankles
  if (ankleDist > MIN_ANKLE_SPREAD && kneeDist < ankleDist * VALGUS_KNEE_TO_ANKLE_RATIO) { // knees much closer than ankles
    return 'Push your knees out over your toes — avoid letting them cave inward.' // fault message
  }
  return null // no fault
}

// Creates the squat detector.
export function createSquatDetector() {
  return makeMetricDetector({
    id: 'squat',
    label: 'Squat',
    computeMetric: (lm) => // signal: knee angle of the better-visible leg
      bestSideAngle(
        lm,
        [LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE],
        [LM.RIGHT_HIP, LM.RIGHT_KNEE, LM.RIGHT_ANKLE]
      ),
    restValue: REST_ANGLE,
    peakValue: PEAK_ANGLE,
    minDwellMs: 200, // 200 ms debounce
    checkForm: checkSquatForm,
  })
}
