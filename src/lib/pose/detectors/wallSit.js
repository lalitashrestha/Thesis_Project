import { LM, bestSideAngle, isVisible } from '../landmarks' // geometry helpers and body-point numbers
import { makeHoldDetector } from './makeHoldDetector' // builds a timer-based detector

// Wall sit, filmed side-on. In position when the knee angle is near 90
// degrees (thighs about parallel to the floor) and the torso is upright
// (shoulder roughly above hip, i.e. back flat against the wall).
const MIN_KNEE_ANGLE = 75 // knees bent more than this is too low
const MAX_KNEE_ANGLE = 110 // knees bent less than this is too high
const MAX_TORSO_LEAN = 0.35 // |dx| / |dy| of shoulder vs hip

// Decides, for one frame, whether the user is in a correct wall sit.
export function checkWallSitPosition(lm) {
  const knee = bestSideAngle( // hip-knee-ankle angle of the better-visible leg
    lm,
    [LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE],
    [LM.RIGHT_HIP, LM.RIGHT_KNEE, LM.RIGHT_ANKLE]
  )
  if (knee == null) return null // legs not visible: cannot judge

  if (knee > MAX_KNEE_ANGLE) { // not low enough
    return {
      inPosition: false,
      metric: knee,
      message: 'Slide lower until your thighs are parallel to the floor.',
    }
  }
  if (knee < MIN_KNEE_ANGLE) { // too low
    return {
      inPosition: false,
      metric: knee,
      message: 'Slide up a little. Your knees are bending too far.',
    }
  }
  const needs = [LM.LEFT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_SHOULDER, LM.RIGHT_HIP] // points needed to check the back
  if (needs.every((i) => isVisible(lm, i))) { // only check the back if all four are visible
    const sx = (lm[LM.LEFT_SHOULDER].x + lm[LM.RIGHT_SHOULDER].x) / 2 // middle of the shoulders (x)
    const sy = (lm[LM.LEFT_SHOULDER].y + lm[LM.RIGHT_SHOULDER].y) / 2 // middle of the shoulders (y)
    const hx = (lm[LM.LEFT_HIP].x + lm[LM.RIGHT_HIP].x) / 2 // middle of the hips (x)
    const hy = (lm[LM.LEFT_HIP].y + lm[LM.RIGHT_HIP].y) / 2 // middle of the hips (y)
    const dy = Math.abs(hy - sy) // vertical torso length
    if (dy > 0.02 && Math.abs(hx - sx) / dy > MAX_TORSO_LEAN) { // shoulders too far in front of the hips: leaning off the wall
      return {
        inPosition: false,
        metric: knee,
        message: 'Press your back flat against the wall.',
      }
    }
  }
  return { inPosition: true, metric: knee, message: null } // good wall sit: the timer runs
}

// Creates the wall-sit detector used by the camera screen.
export function createWallSitDetector() {
  return makeHoldDetector({ id: 'wall_sit', label: 'Wall Sit', checkPosition: checkWallSitPosition })
}
