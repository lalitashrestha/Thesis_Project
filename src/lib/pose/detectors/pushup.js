import { bestSideAngle, LM } from '../landmarks' // angle helper and body-point numbers
import { makeMetricDetector } from './makeMetricDetector' // builds a rep-counting detector

// Signal: shoulder-elbow-wrist angle. Near-straight arm at the top,
// folding toward ~90 degrees at the bottom of the push-up.
const REST_ANGLE = 155 // arms straight (top)
const PEAK_ANGLE = 95 // elbows bent (bottom)

// Body-line check: shoulder-hip-ankle should stay close to a straight
// line throughout. Sagging hips (angle folds downward) or a piked-up
// hips both show up as this angle dropping well below straight.
const MIN_STRAIGHT_BODY_ANGLE = 150

// Form check: is the body staying in a straight line?
function checkPushupForm(landmarks) {
  const angle = bestSideAngle( // shoulder-hip-ankle angle
    landmarks,
    [LM.LEFT_SHOULDER, LM.LEFT_HIP, LM.LEFT_ANKLE],
    [LM.RIGHT_SHOULDER, LM.RIGHT_HIP, LM.RIGHT_ANKLE]
  )
  if (angle != null && angle < MIN_STRAIGHT_BODY_ANGLE) { // body bent at the hips
    return "Keep your body in a straight line — don't let your hips sag or pike up." // fault message
  }
  return null // no fault
}

// Creates the push-up detector.
export function createPushupDetector() {
  return makeMetricDetector({
    id: 'pushup',
    label: 'Push-Up',
    computeMetric: (lm) => // signal: elbow angle of the better-visible arm
      bestSideAngle(
        lm,
        [LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.LEFT_WRIST],
        [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW, LM.RIGHT_WRIST]
      ),
    restValue: REST_ANGLE,
    peakValue: PEAK_ANGLE,
    minDwellMs: 200,
    checkForm: checkPushupForm,
  })
}
