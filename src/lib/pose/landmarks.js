// Shared geometry helpers for the rep detectors in ./detectors/. All
// detection runs on the 33-point BlazePose landmark set that MediaPipe
// Pose returns (see poseEngine.js) - normalized (0-1) image coordinates,
// origin top-left. Only x/y are used, never z: a single monocular camera's
// depth estimate is unreliable, so every detector here is built on 2D
// angles and distances, matching the design rationale in Chapter 4.

// Index numbers of the body points the detectors use (MediaPipe numbers 33 points from 0 to 32).
export const LM = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
}

const MIN_VISIBILITY = 0.5 // MediaPipe's confidence (0-1) that a point is visible; below 0.5 it is ignored

// True if the body point exists and MediaPipe is confident enough that it can see it.
export function isVisible(landmarks, index) {
  const p = landmarks[index] // the point, e.g. the left knee
  return !!p && (p.visibility === undefined || p.visibility >= MIN_VISIBILITY) // exists, and visible enough
}

/**
 * Angle in degrees at point B, formed by rays B->A and B->C. Returns null
 * if any point is missing.
 */
export function angleAt(landmarks, aIdx, bIdx, cIdx) {
  const a = landmarks[aIdx] // first outer point, e.g. hip
  const b = landmarks[bIdx] // the joint where the angle is measured, e.g. knee
  const c = landmarks[cIdx] // second outer point, e.g. ankle
  if (!a || !b || !c) return null // a point is missing: no angle
  const abx = a.x - b.x // vector from the joint to point A (x part)
  const aby = a.y - b.y // ...(y part)
  const cbx = c.x - b.x // vector from the joint to point C (x part)
  const cby = c.y - b.y // ...(y part)
  const dot = abx * cbx + aby * cby // dot product of the two vectors
  const magAB = Math.hypot(abx, aby) // length of vector BA
  const magCB = Math.hypot(cbx, cby) // length of vector BC
  if (magAB === 0 || magCB === 0) return null // two points on top of each other: angle undefined
  const cos = Math.min(1, Math.max(-1, dot / (magAB * magCB))) // cosine of the angle, kept within -1..1 against rounding errors
  return (Math.acos(cos) * 180) / Math.PI // turn the cosine into an angle in degrees
}

/**
 * Picks whichever side (left or right) has better-visible joints for a
 * 3-point angle, so a detector keeps working when the user is angled
 * slightly away from square-on to the camera. Averages both sides when
 * both are visible, for a steadier reading.
 */
export function bestSideAngle(landmarks, leftTriplet, rightTriplet) {
  const leftOk = leftTriplet.every((i) => isVisible(landmarks, i)) // all three left-side points visible?
  const rightOk = rightTriplet.every((i) => isVisible(landmarks, i)) // all three right-side points visible?
  if (leftOk && rightOk) { // both sides visible
    const l = angleAt(landmarks, ...leftTriplet) // left-side angle
    const r = angleAt(landmarks, ...rightTriplet) // right-side angle
    if (l == null) return r // left failed: use right
    if (r == null) return l // right failed: use left
    return (l + r) / 2 // use the average of both sides
  }
  if (leftOk) return angleAt(landmarks, ...leftTriplet) // only the left side is visible
  if (rightOk) return angleAt(landmarks, ...rightTriplet) // only the right side is visible
  return null // neither side visible: no reading this frame
}

/**
 * Whether enough of the body is visible in frame to trust rep counting
 * and form checking at all: both shoulders and both hips (the torso is
 * visible from any angle the user stands at), plus at least one complete
 * hip-knee-ankle leg chain (both legs aren't always visible in a side-on
 * exercise, where the far leg can be partly hidden behind the near one -
 * this mirrors the tolerance bestSideAngle already has for that case).
 *
 * This exists because without it, a detector whose checkForm can't find
 * the landmarks it needs (e.g. the user has only stepped partway into
 * frame) simply has nothing to flag - which reads as "no fault found",
 * i.e. correct form, when really nothing has been checked yet. Gating
 * rep counting and form checking on this first avoids that false-green.
 */
export function isBodyFramed(landmarks) {
  if (!landmarks) return false // no person detected at all
  const torsoOk = [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP].every((i) => // both shoulders and both hips visible?
    isVisible(landmarks, i)
  )
  if (!torsoOk) return false // torso not fully in frame
  const leftLegOk = [LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE].every((i) => // whole left leg visible?
    isVisible(landmarks, i)
  )
  const rightLegOk = [LM.RIGHT_HIP, LM.RIGHT_KNEE, LM.RIGHT_ANKLE].every((i) => // whole right leg visible?
    isVisible(landmarks, i)
  )
  return leftLegOk || rightLegOk // one complete leg is enough
}
