// detectorRegistry.js
// Connects each exercise id to the function that creates its camera detector.

// Bring in the "create a detector" function of each of the 11 camera-checked exercises.
import { createSquatDetector } from './detectors/squat'
import { createPushupDetector } from './detectors/pushup'
import { createLungeDetector } from './detectors/lunge'
import { createGluteBridgeDetector } from './detectors/gluteBridge'
import { createJumpingJackDetector } from './detectors/jumpingJack'
import { createMountainClimberDetector } from './detectors/mountainClimber'
import { createCatCowDetector } from './detectors/catCow'
import { createPlankDetector } from './detectors/plank'
import { createWallSitDetector } from './detectors/wallSit'
import { createShoulderPressDetector } from './detectors/shoulderPress'
import { createStandingRowDetector } from './detectors/standingRow'

// Lookup table: exercise id -> function that builds its detector.
// The world's greatest stretch is missing on purpose: it has no detector and is ticked by hand.
const FACTORIES = {
  squat: createSquatDetector,
  pushup: createPushupDetector,
  lunge: createLungeDetector,
  glute_bridge: createGluteBridgeDetector,
  jumping_jack: createJumpingJackDetector,
  mountain_climber: createMountainClimberDetector,
  cat_cow_stretch: createCatCowDetector,
  plank: createPlankDetector,
  wall_sit: createWallSitDetector,
  dumbbell_shoulder_press: createShoulderPressDetector,
  standing_row: createStandingRowDetector,
}

// True if this exercise can be checked with the camera (decides whether a Start button is shown).
export function isCameraDetectable(exerciseId) {
  return exerciseId in FACTORIES // is the id in the lookup table?
}

// Creates a fresh detector for one exercise, or null if it has none.
export function createDetectorFor(exerciseId) {
  const factory = FACTORIES[exerciseId] // find the matching create function
  return factory ? factory() : null // call it to make a new detector
}
