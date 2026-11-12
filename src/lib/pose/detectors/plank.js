import { angleAt, isVisible, LM } from '../landmarks' // geometry helpers and body-point numbers
import { makeHoldDetector } from './makeHoldDetector' // builds a timer-based detector

// Plank, filmed side-on. In position when:
//  1. the body is roughly horizontal (shoulder-to-ankle line is much
//     longer across than up/down), and
//  2. shoulder-hip-ankle is close to a straight line.
// Which way a bad plank fails (hips sagging below the line, or piking
// above it) comes from the sign of the hip's offset from that line.
const MIN_BODY_ANGLE = 160 // shoulder-hip-ankle angle must be at least 160° (nearly straight)
const HORIZONTAL_RATIO = 0.45 // |dy| must be under 45% of |dx|
const MIN_BODY_LENGTH = 0.2 // in normalized image width

// Chooses the body side (left or right) to read: the one that is fully visible, or the clearer one.
function pickSide(lm) {
  const left = [LM.LEFT_SHOULDER, LM.LEFT_HIP, LM.LEFT_ANKLE] // left shoulder, hip, ankle
  const right = [LM.RIGHT_SHOULDER, LM.RIGHT_HIP, LM.RIGHT_ANKLE] // right shoulder, hip, ankle
  const lOk = left.every((i) => isVisible(lm, i)) // all left points visible?
  const rOk = right.every((i) => isVisible(lm, i)) // all right points visible?
  if (lOk && rOk) {
    // use the side with the higher mean visibility
    const vis = (arr) => arr.reduce((n, i) => n + (lm[i].visibility ?? 1), 0) // sum of visibility scores
    return vis(left) >= vis(right) ? left : right
  }
  return lOk ? left : rOk ? right : null // the only visible side, or none
}

// Decides, for one frame, whether the user is in a correct plank.
export function checkPlankPosition(lm) {
  const side = pickSide(lm) // which side to read
  if (!side) return null // neither side visible: cannot judge
  const [s, h, a] = side.map((i) => lm[i]) // shoulder, hip and ankle points
  const dx = a.x - s.x // horizontal distance shoulder -> ankle
  const dy = a.y - s.y // vertical distance shoulder -> ankle
  const length = Math.hypot(dx, dy) // body length shoulder -> ankle
  if (Math.abs(dx) < MIN_BODY_LENGTH || Math.abs(dy) > HORIZONTAL_RATIO * Math.abs(dx)) { // body too short in view, or not horizontal
    return {
      inPosition: false,
      metric: null,
      message: 'Get into a plank, side-on to the camera, with your whole body in view.',
    }
  }
  const angle = angleAt(lm, side[0], side[1], side[2]) // shoulder-hip-ankle angle (180 = perfectly straight)
  const yOnLine = s.y + ((h.x - s.x) * dy) / dx // where the hip would be on a straight shoulder-ankle line
  const deviation = (h.y - yOnLine) / length // positive = hips below the line
  if (angle != null && angle < MIN_BODY_ANGLE) { // body not straight enough
    return {
      inPosition: false,
      metric: angle,
      message:
        deviation > 0 // hips below the line, or above it?
          ? 'Your hips are sagging. Squeeze your glutes and brace your core.'
          : 'Your hips are too high. Lower them into a straight line.',
    }
  }
  return { inPosition: true, metric: angle, message: null } // good plank: the timer runs
}

// Creates the plank detector used by the camera screen.
export function createPlankDetector() {
  return makeHoldDetector({ id: 'plank', label: 'Plank Hold', checkPosition: checkPlankPosition })
}
