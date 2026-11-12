// Bring in MediaPipe's pose model (PoseLandmarker) and its file loader.
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

// Model and WASM runtime files are fetched from Google's own CDN/storage
// the first time the camera screen opens, then cached by the browser.
// Everything else - every video frame, every landmark computed from it -
// stays on-device: no frame is ever uploaded anywhere, consistent with
// the no-server, privacy-by-design approach set out in the dissertation's
// Chapter 4. "lite" is the smallest/fastest of MediaPipe's three pose
// models, chosen for real-time performance on ordinary laptops/phones
// rather than maximum landmark precision.
const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm' // where the MediaPipe runtime is downloaded from
const MODEL_URL = // where the "lite" pose model file is downloaded from
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

let landmarkerPromise = null // the model is loaded once and then reused

// Loads the pose model (only the first time it is called).
function getLandmarker() {
  if (!landmarkerPromise) { // not loaded yet
    landmarkerPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(WASM_BASE) // download the MediaPipe runtime
      const make = (delegate) => // creates the model on the GPU or the CPU
        PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate }, // which model file, and GPU or CPU
          runningMode: 'VIDEO', // process a continuous video, frame after frame
          numPoses: 1, // track only one person
        })
      try {
        return await make('GPU') // try the faster graphics-card path first
      } catch {
        // Some machines have no usable WebGL/GPU path; the CPU path is
        // slower but works everywhere.
        return await make('CPU')
      }
    })().catch((err) => {
      landmarkerPromise = null // allow a retry after a network failure
      throw err // pass the error on so the screen can show it
    })
  }
  return landmarkerPromise // the loaded (or loading) model
}

/**
 * Starts a detection loop against a <video> element that is already
 * playing a camera stream. Calls `onResult({ landmarks, timestampMs })`
 * on every animation frame once the model is ready - `landmarks` is null
 * on frames where no person was detected. Returns a stop() function that
 * must be called when the camera screen closes.
 */
export async function startPoseLoop(videoEl, onResult, onError) {
  let stopped = false // becomes true when the camera screen closes
  let landmarker // the loaded pose model

  try {
    landmarker = await getLandmarker() // wait for the model to load
  } catch (err) {
    onError?.(err) // tell the camera screen that loading failed
    return null // caller keeps its error state and shows the message
  }

  // Runs once per screen refresh (about 30-60 times a second).
  function frame() {
    if (stopped) return // the loop has been stopped
    if (videoEl.readyState >= 2) { // the video has a frame ready to read
      const nowMs = performance.now() // current time in milliseconds
      const result = landmarker.detectForVideo(videoEl, nowMs) // find the body points in this frame
      const landmarks = result.landmarks && result.landmarks[0] ? result.landmarks[0] : null // the 33 points of the first person, or null if nobody was found
      onResult({ landmarks, timestampMs: nowMs }) // hand the points to the camera screen
    }
    requestAnimationFrame(frame) // run again on the next screen refresh
  }
  requestAnimationFrame(frame) // start the loop

  return () => { // the stop() function given back to the caller
    stopped = true
  }
}

// The list of which body points are joined by lines when the skeleton is drawn.
export const POSE_CONNECTIONS = PoseLandmarker.POSE_CONNECTIONS
