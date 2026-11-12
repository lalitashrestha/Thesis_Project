import { bestSideAngle, LM } from '../landmarks' // angle helper and body-point numbers
import { makeMetricDetector } from './makeMetricDetector' // builds a rep-counting detector

// Signal: knee-to-hip distance for whichever leg is currently driven in,
// normalized by torso length. Large (leg extended back in the plank) at
// rest, small (knee driven up toward the chest) at the peak. Using the
// minimum of the two sides means either leg driving in counts, matching
// how mountain climbers alternate legs.
const REST_RATIO = 1.1 // leg extended: knee far from hip
const PEAK_RATIO = 0.35 // knee driven in: knee close to hip

// Shortest knee-to-hip distance of the two legs, divided by torso length.
function minKneeToHipRatio(landmarks) {
  const ls = landmarks[LM.LEFT_SHOULDER]
  const rs = landmarks[LM.RIGHT_SHOULDER]
  const lh = landmarks[LM.LEFT_HIP]
  const rh = landmarks[LM.RIGHT_HIP]
  const lk = landmarks[LM.LEFT_KNEE]
  const rk = landmarks[LM.RIGHT_KNEE]
  if (!ls || !rs || !lh || !rh || !lk || !rk) return null // a point is missing: no reading

  const torsoLength = // average shoulder-to-hip length of both sides
    (Math.hypot(ls.x - lh.x, ls.y - lh.y) + Math.hypot(rs.x - rh.x, rs.y - rh.y)) / 2
  if (torsoLength === 0) return null // avoid dividing by zero

  const leftDist = Math.hypot(lk.x - lh.x, lk.y - lh.y) // left knee to left hip
  const rightDist = Math.hypot(rk.x - rh.x, rk.y - rh.y) // right knee to right hip
  return Math.min(leftDist, rightDist) / torsoLength // the leg driven in, measured in torso lengths
}

// Plank-line check, same idea as the push-up detector: the hips should
// stay roughly level with a straight shoulder-hip-ankle line rather than
// riding up into a piked position.
const MIN_STRAIGHT_BODY_ANGLE = 150

// Form check: are the hips raised (piked)?
function checkMountainClimberForm(landmarks) {
  const angle = bestSideAngle( // shoulder-hip-ankle angle
    landmarks,
    [LM.LEFT_SHOULDER, LM.LEFT_HIP, LM.LEFT_ANKLE],
    [LM.RIGHT_SHOULDER, LM.RIGHT_HIP, LM.RIGHT_ANKLE]
  )
  if (angle != null && angle < MIN_STRAIGHT_BODY_ANGLE) { // body line bent too much
    return 'Keep your hips level in a plank position — avoid raising them up.' // fault message
  }
  return null // no fault
}

// Creates the mountain-climber detector.
export function createMountainClimberDetector() {
  return makeMetricDetector({
    id: 'mountain_climber',
    label: 'Mountain Climber',
    computeMetric: minKneeToHipRatio, // signal: knee-to-hip distance in torso lengths
    restValue: REST_RATIO,
    peakValue: PEAK_RATIO,
    minDwellMs: 120, // short debounce because the movement is fast
    checkForm: checkMountainClimberForm,
  })
}
