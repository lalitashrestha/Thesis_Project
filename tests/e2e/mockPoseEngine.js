// Test-only replacement for lib/pose/poseEngine.js. It feeds synthetic
// squat landmarks to the camera screen so the whole session flow can be
// driven end to end without a real person or the MediaPipe model.
// window.__angle sets the knee angle; window.__valgus makes the knees cave.
export const POSE_CONNECTIONS = [] // no skeleton lines are needed in the test

// Builds one fake set of 33 body points for a squatting person.
function frame() {
  const deg = window.__angle ?? 172 // knee angle chosen by the test script (172° = standing)
  const r = (deg * Math.PI) / 180 // the same angle in radians
  const lm = Array.from({ length: 33 }, () => ({ x: 0.05, y: 0.05, visibility: 1 })) // 33 points parked in a corner
  lm[11] = { x: 0.45, y: 0.2, visibility: 1 } // left shoulder
  lm[12] = { x: 0.55, y: 0.2, visibility: 1 } // right shoulder
  // two legs 0.1 apart; each ankle is placed so the hip-knee-ankle angle equals `deg`
  for (const [hipI, kneeI, ankI, x] of [[23, 25, 27, 0.45], [24, 26, 28, 0.55]]) {
    lm[hipI] = { x, y: 0.4, visibility: 1 } // hip
    const kneeX = window.__valgus ? (x < 0.5 ? 0.49 : 0.51) : x // knees pulled together when testing the "knees caving" fault
    lm[kneeI] = { x: kneeX, y: 0.6, visibility: 1 } // knee
    lm[ankI] = { x: x + 0.2 * Math.sin(r), y: 0.6 - 0.2 * Math.cos(r), visibility: 1 } // ankle, placed to make the wanted angle
  }
  return lm
}

// Same name and use as the real startPoseLoop, but sends fake frames about 30 times a second.
export async function startPoseLoop(video, onResult) {
  const id = setInterval(() => {
    if (window.__noPerson) onResult({ landmarks: null, timestampMs: performance.now() }) // simulate nobody in view
    else onResult({ landmarks: frame(), timestampMs: performance.now() }) // send a fake frame
  }, 33)
  return () => clearInterval(id) // stop() function
}
