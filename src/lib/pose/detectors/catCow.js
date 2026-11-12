import { bestSideAngle, LM } from '../landmarks' // angle helper and body-point numbers
import { makeMetricDetector } from './makeMetricDetector' // builds a rep-counting detector

// Cat-Cow's range of motion is subtle (spinal flexion/extension while on
// hands and knees) and reads best directly side-on, so this is the least
// reliable of the seven detectors built here - it should be checked
// carefully against manual observation before being trusted (see the
// dissertation's Chapter 3 evaluation methodology). The wider dwell time
// below is deliberate: it trades off missing some genuine reps against
// not over-counting on camera or lighting noise.
const REST_ANGLE = 150 // neutral/"cow" - slightly more open shoulder-hip-knee angle
const PEAK_ANGLE = 110 // "cat" - spine rounded, more folded angle

// Creates the cat-cow detector (no form check for this exercise).
export function createCatCowDetector() {
  return makeMetricDetector({
    id: 'cat_cow_stretch',
    label: 'Cat-Cow Stretch',
    computeMetric: (lm) => // signal: shoulder-hip-knee angle of the better-visible side
      bestSideAngle(
        lm,
        [LM.LEFT_SHOULDER, LM.LEFT_HIP, LM.LEFT_KNEE],
        [LM.RIGHT_SHOULDER, LM.RIGHT_HIP, LM.RIGHT_KNEE]
      ),
    restValue: REST_ANGLE,
    peakValue: PEAK_ANGLE,
    minDwellMs: 300, // longer debounce than other exercises because the signal is noisy
  })
}
