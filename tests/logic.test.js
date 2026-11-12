// logic.test.js: the 25 unit tests (run with "npm test"). Each test feeds made-up
// inputs to the real app logic and checks the answer. No camera is used.
import { describe, expect, it } from 'vitest' // the test framework: describe = group, it = one test, expect = check
import { LM } from '../src/lib/pose/landmarks'
import { createSquatDetector } from '../src/lib/pose/detectors/squat'
import { createPlankDetector } from '../src/lib/pose/detectors/plank'
import { createWallSitDetector } from '../src/lib/pose/detectors/wallSit'
import { createShoulderPressDetector } from '../src/lib/pose/detectors/shoulderPress'
import { createStandingRowDetector } from '../src/lib/pose/detectors/standingRow'
import { calibrateRest } from '../src/lib/pose/calibration'
import { nudgeNextTarget, buildTargets, cleanRateFor } from '../src/lib/pose/session'
import { adaptPlan, decideAction, diffPlans, generateInitialPlan, summariseAdaptation } from '../src/lib/planGenerator'
import { EXERCISES, exercisesFor } from '../src/data/exercises'
import { isCameraDetectable } from '../src/lib/pose/detectorRegistry'
import { sessionStats, volumeSeries, weeklyCompletion } from '../src/lib/progress'

// 33 landmarks, all visible, parked in a corner unless overridden.
function lm(over = {}) {
  const a = Array.from({ length: 33 }, () => ({ x: 0.05, y: 0.05, visibility: 1 })) // 33 default points
  for (const [i, p] of Object.entries(over)) a[i] = { visibility: 1, ...p } // replace the points the test cares about
  return a
}

// A standing body whose both knees are bent to `deg` degrees.
function squatFrame(deg) {
  const hip = { x: 0.5, y: 0.4 }
  const knee = { x: 0.5, y: 0.6 }
  const r = (deg * Math.PI) / 180 // angle in radians
  const ankle = { x: knee.x + 0.2 * Math.sin(r), y: knee.y - 0.2 * Math.cos(r) } // ankle placed to make that knee angle
  return lm({
    [LM.LEFT_SHOULDER]: { x: 0.45, y: 0.2 }, [LM.RIGHT_SHOULDER]: { x: 0.55, y: 0.2 },
    [LM.LEFT_HIP]: hip, [LM.RIGHT_HIP]: hip,
    [LM.LEFT_KNEE]: knee, [LM.RIGHT_KNEE]: knee,
    [LM.LEFT_ANKLE]: ankle, [LM.RIGHT_ANKLE]: ankle,
  })
}

// Feeds a list of frames to a detector (33 ms apart, like 30 fps) and counts the reps.
function run(det, frames, stepMs = 33) {
  let t = 1000 // starting time in ms
  let last // the detector's last answer
  let reps = 0
  for (const f of frames) {
    last = det.update(f, (t += stepMs)) // next frame, 33 ms later
    if (last.repCompleted) reps++ // a rep finished on this frame
  }
  return { reps, last }
}

const sweep = (from, to, n) => Array.from({ length: n }, (_, i) => from + ((to - from) * i) / (n - 1)) // n evenly spaced values from "from" to "to"
const cycle = (hi, lo) => [...sweep(hi, lo, 12), ...sweep(lo, hi, 12)] // one down-and-up movement (24 frames)

describe('rep counting', () => {
  it('counts five clean squats', () => {
    const angles = Array.from({ length: 5 }, () => cycle(175, 90)).flat() // five full squats 175° -> 90° -> 175°
    expect(run(createSquatDetector(), angles.map(squatFrame)).reps).toBe(5) // should count exactly 5
  })

  it('does not count shallow squats', () => {
    const angles = Array.from({ length: 4 }, () => cycle(175, 130)).flat() // only down to 130°, never past the 100° threshold
    expect(run(createSquatDetector(), angles.map(squatFrame)).reps).toBe(0) // should count none
  })

  it('flags knees caving in', () => {
    const f = squatFrame(120)
    f[LM.LEFT_KNEE].x = 0.48 // knees close together...
    f[LM.RIGHT_KNEE].x = 0.52
    f[LM.LEFT_ANKLE].x = 0.4 // ...ankles wide apart
    f[LM.RIGHT_ANKLE].x = 0.6
    const r = createSquatDetector().update(f, 2000)
    expect(r.formOk).toBe(false) // should be flagged as a fault
  })

  it('calibration lets a user with a bent-knee stance finish reps', () => {
    // This person only ever straightens to 150 degrees.
    const angles = Array.from({ length: 4 }, () => cycle(150, 90)).flat()
    expect(run(createSquatDetector(), angles.map(squatFrame)).reps).toBe(0) // without calibration: never reaches 160°, so 0 reps

    const det = createSquatDetector()
    const cal = calibrateRest(Array(30).fill(150), det.restValue, det.peakValue) // calibrate on their 150° standing position
    expect(cal.used).toBe(true)
    det.setRestValue(cal.restValue) // apply the personal threshold
    expect(run(det, angles.map(squatFrame)).reps).toBe(4) // now all 4 reps count
  })
})

describe('calibration guard rails', () => {
  it('ignores a reading that is nowhere near the start position', () => {
    const r = calibrateRest(Array(30).fill(95), 160, 100) // 95° is the bottom of a squat, not a start position
    expect(r.used).toBe(false)
    expect(r.restValue).toBe(160) // default kept
  })
  it('ignores too few samples', () => {
    expect(calibrateRest([170, 171], 160, 100).used).toBe(false) // only 2 readings: not enough
  })
  it('keeps the threshold close to the default', () => {
    const r = calibrateRest(Array(30).fill(215), 160, 100) // implausibly high
    expect(r.used).toBe(false)
    const ok = calibrateRest(Array(30).fill(178), 160, 100) // a plausible reading
    expect(ok.restValue).toBeGreaterThan(139) // result stays within the allowed band
    expect(ok.restValue).toBeLessThan(181)
  })
})

describe('hold detectors', () => {
  // A side-on plank body; hipDrop > 0 makes the hips sag, < 0 makes them pike up.
  const plankBody = (hipDrop = 0) =>
    lm({
      [LM.LEFT_SHOULDER]: { x: 0.8, y: 0.5 }, [LM.RIGHT_SHOULDER]: { x: 0.8, y: 0.5 },
      [LM.LEFT_HIP]: { x: 0.5, y: 0.6 + hipDrop }, [LM.RIGHT_HIP]: { x: 0.5, y: 0.6 + hipDrop },
      [LM.LEFT_ANKLE]: { x: 0.2, y: 0.7 }, [LM.RIGHT_ANKLE]: { x: 0.2, y: 0.7 },
      [LM.LEFT_KNEE]: { x: 0.35, y: 0.65 }, [LM.RIGHT_KNEE]: { x: 0.35, y: 0.65 },
    })

  it('times a straight plank and pauses when hips sag', () => {
    const det = createPlankDetector()
    let t = 0
    let r
    for (let i = 0; i < 30; i++) r = det.update(plankBody(), (t += 33)) // about 1 second of good plank
    expect(r.holding).toBe(true)
    const held = r.heldMs
    expect(held).toBeGreaterThan(900) // close to 1 second counted
    for (let i = 0; i < 30; i++) r = det.update(plankBody(0.12), (t += 33)) // now the hips sag
    expect(r.holding).toBe(false)
    expect(r.formMessage).toMatch(/sagging/) // correct message
    expect(r.heldMs).toBe(held) // timer paused, not reset
  })

  it('flags piked hips', () => {
    const r = createPlankDetector().update(plankBody(-0.12), 100) // hips raised
    expect(r.formMessage).toMatch(/too high/)
  })

  it('rejects a standing body as a plank', () => {
    const r = createPlankDetector().update(squatFrame(175), 100) // a standing person
    expect(r.holding).toBe(false)
  })

  it('does not let a stalled frame add a big jump of time', () => {
    const det = createPlankDetector()
    det.update(plankBody(), 0)
    expect(det.update(plankBody(), 5000).heldMs).toBeLessThanOrEqual(250) // a 5-second gap adds at most 250 ms
  })

  // A side-on wall-sit body with a chosen knee angle; lean moves the shoulders off the wall.
  const sit = (kneeDeg, lean = 0) => {
    const hip = { x: 0.4, y: 0.5 }
    const knee = { x: 0.6, y: 0.5 }
    const r = (kneeDeg * Math.PI) / 180
    // angle at knee between knee->hip (pointing left) and knee->ankle
    const ankle = { x: knee.x - 0.2 * Math.cos(r), y: knee.y + 0.2 * Math.sin(r) }
    return lm({
      [LM.LEFT_SHOULDER]: { x: 0.4 + lean, y: 0.25 }, [LM.RIGHT_SHOULDER]: { x: 0.4 + lean, y: 0.25 },
      [LM.LEFT_HIP]: hip, [LM.RIGHT_HIP]: hip,
      [LM.LEFT_KNEE]: knee, [LM.RIGHT_KNEE]: knee,
      [LM.LEFT_ANKLE]: ankle, [LM.RIGHT_ANKLE]: ankle,
    })
  }
  it('wall sit: counts only near 90 degrees with an upright back', () => {
    const det = createWallSitDetector()
    expect(det.update(sit(90), 100).holding).toBe(true) // 90°: correct
    expect(det.update(sit(150), 200).formMessage).toMatch(/lower/) // too high
    expect(det.update(sit(50), 300).formMessage).toMatch(/up a little/) // too low
    expect(det.update(sit(90, 0.2), 400).formMessage).toMatch(/back flat/) // leaning off the wall
  })
})

describe('equipment exercises', () => {
  // A front-facing body with the wrists raised by "wristRise" (0 = at shoulders, 1 = overhead).
  const press = (wristRise) =>
    lm({
      [LM.LEFT_SHOULDER]: { x: 0.4, y: 0.3 }, [LM.RIGHT_SHOULDER]: { x: 0.6, y: 0.3 },
      [LM.LEFT_HIP]: { x: 0.42, y: 0.6 }, [LM.RIGHT_HIP]: { x: 0.58, y: 0.6 },
      [LM.LEFT_WRIST]: { x: 0.35, y: 0.3 - wristRise * 0.3 }, [LM.RIGHT_WRIST]: { x: 0.65, y: 0.3 - wristRise * 0.3 },
      [LM.LEFT_ELBOW]: { x: 0.3, y: 0.35 }, [LM.RIGHT_ELBOW]: { x: 0.7, y: 0.35 },
      [LM.LEFT_KNEE]: { x: 0.42, y: 0.8 }, [LM.RIGHT_KNEE]: { x: 0.58, y: 0.8 },
      [LM.LEFT_ANKLE]: { x: 0.42, y: 0.95 }, [LM.RIGHT_ANKLE]: { x: 0.58, y: 0.95 },
    })
  it('counts shoulder presses from wrist height', () => {
    const rises = Array.from({ length: 4 }, () => [...sweep(0.1, 1.05, 14), ...sweep(1.05, 0.1, 14)]).flat() // four presses up and down
    expect(run(createShoulderPressDetector(), rises.map(press)).reps).toBe(4)
  })

  // A side-on arm with a chosen elbow angle.
  const row = (deg) => {
    const sh = { x: 0.5, y: 0.3 }
    const el = { x: 0.5, y: 0.45 }
    const r = (deg * Math.PI) / 180
    const wr = { x: el.x + 0.15 * Math.sin(r), y: el.y - 0.15 * Math.cos(r) } // wrist placed to make that elbow angle
    return lm({
      [LM.LEFT_SHOULDER]: sh, [LM.RIGHT_SHOULDER]: sh, [LM.LEFT_ELBOW]: el, [LM.RIGHT_ELBOW]: el,
      [LM.LEFT_WRIST]: wr, [LM.RIGHT_WRIST]: wr,
      [LM.LEFT_HIP]: { x: 0.5, y: 0.6 }, [LM.RIGHT_HIP]: { x: 0.5, y: 0.6 },
    })
  }
  it('counts band rows from elbow angle', () => {
    // angle at elbow between elbow->shoulder (up) and elbow->wrist
    const angles = Array.from({ length: 3 }, () => cycle(170, 70)).flat() // three rows
    expect(run(createStandingRowDetector(), angles.map(row)).reps).toBe(3)
  })
})

describe('in-session nudge', () => {
  it('trims the next set when form slipped', () => {
    expect(nudgeNextTarget(12, 12, 0.5)).toEqual({ target: 10, trimmed: true }) // 50% clean: 12 -> 10
  })
  it('never trims below 60% of the original', () => {
    expect(nudgeNextTarget(10, 6, 0.1).target).toBe(6) // already at the floor of 6
  })
  it('restores the original target after a clean set', () => {
    expect(nudgeNextTarget(12, 10, 0.95)).toEqual({ target: 12, trimmed: false }) // clean set: back to 12
  })
  it('builds one target per set, in seconds for holds', () => {
    expect(buildTargets({ sets: 3, reps: 12 }, 'reps')).toEqual([12, 12, 12])
    expect(buildTargets({ sets: 2, holdSeconds: 40 }, 'hold')).toEqual([40, 40])
  })
  it('clean rate', () => {
    expect(cleanRateFor(8, 2)).toBe(0.8) // 8 clean out of 10
    expect(cleanRateFor(0, 0)).toBeNull() // no reps: no rate
  })
})

describe('weekly adaptation', () => {
  // A one-day plan with a squat, a push-up and a plank.
  const plan = {
    weekNumber: 1,
    days: [{ dayIndex: 0, exercises: [
      { exerciseId: 'squat', sets: 3, reps: 12, holdSeconds: null },
      { exerciseId: 'pushup', sets: 3, reps: 10, holdSeconds: null },
      { exerciseId: 'plank', sets: 3, reps: null, holdSeconds: 30 },
    ] }],
  }
  const log = (entries) => ({ weekNumber: 1, entries }) // wraps entries as a week-1 log

  it('decides actions', () => {
    expect(decideAction(1, 0.9)).toBe('progress') // full completion, clean form
    expect(decideAction(1, null)).toBe('progress') // full completion, manual tick (no form data)
    expect(decideAction(1, 0.5)).toBe('hold_form') // full completion, poor form
    expect(decideAction(0.5, 0.95)).toBe('hold_completion') // half completed
  })

  it('progresses clean work, holds poor form, holds low completion', () => {
    const next = adaptPlan(plan, log({
      squat: { attempted: 1, completed: 1, cleanRate: 0.9 }, // should progress
      pushup: { attempted: 1, completed: 1, cleanRate: 0.5 }, // should hold for form
      plank: { attempted: 1, completed: 0, cleanRate: null }, // should hold for completion
    }))
    const [sq, pu, pl] = next.days[0].exercises
    expect(sq.sets).toBe(4) // 3 -> 4 sets
    expect(sq.reps).toBe(13) // 12 -> 13 reps
    expect(pu).toMatchObject({ sets: 3, reps: 10 }) // unchanged
    expect(pl).toMatchObject({ sets: 3, holdSeconds: 30 }) // unchanged
    expect(next.weekNumber).toBe(2)
    expect(next.adaptation.pushup.action).toBe('hold_form')
    expect(next.adaptation.plank.action).toBe('hold_completion')

    const s = summariseAdaptation(plan, next, (id) => id) // the banner groups
    expect(s).toEqual({ increased: ['squat'], held: ['plank'], heldForForm: ['pushup'], atCap: [] })
    expect(diffPlans(plan, next, (id) => id).find((r) => r.exerciseId === 'squat')).toMatchObject({ from: '3 × 12', to: '4 × 13', changed: true }) // the before/after row
  })

  it('honours the safety caps over many weeks and never reduces', () => {
    let p = plan
    for (let w = 0; w < 30; w++) { // 30 perfect weeks in a row
      const entries = Object.fromEntries(p.days[0].exercises.map((e) => [e.exerciseId, { attempted: 1, completed: 1, cleanRate: 1 }]))
      const before = p.days[0].exercises
      p = adaptPlan(p, log(entries))
      p.days[0].exercises.forEach((e, i) => {
        expect(e.sets).toBeGreaterThanOrEqual(before[i].sets) // never goes down
        expect(e.sets).toBeLessThanOrEqual(5) // set cap
        if (e.reps != null) expect(e.reps).toBeLessThanOrEqual(EXERCISES.find((x) => x.id === e.exerciseId).baseReps * 2) // reps cap
        if (e.holdSeconds != null) expect(e.holdSeconds).toBeLessThanOrEqual(90) // hold cap
      })
    }
    expect(p.adaptation.squat.action).toBe('at_cap') // eventually everything is at its cap
  })
})

describe('plan generation', () => {
  it('every goal / equipment / space combination yields a plan', () => {
    for (const goal of ['general_fitness', 'strength', 'mobility', 'weight_loss'])
      for (const equipment of ['none', 'dumbbells', 'resistance_band', 'full_gym'])
        for (const space of ['small', 'medium', 'large']) {
          expect(exercisesFor({ goal, equipment, space }).length).toBeGreaterThan(0) // at least one suitable exercise
          const p = generateInitialPlan({ goal, equipment, space, frequency: 4 })
          expect(p.days).toHaveLength(4) // four training days
          p.days.forEach((d) => expect(d.exercises.length).toBeGreaterThanOrEqual(1)) // every day has exercises
        }
  })
  it('only the world greatest stretch is manual', () => {
    expect(EXERCISES.filter((e) => !isCameraDetectable(e.id)).map((e) => e.id)).toEqual(['world_greatest_stretch'])
  })
})

describe('progress helpers', () => {
  it('series and stats', () => {
    const logs = [ // two weeks, given out of order on purpose
      { weekNumber: 2, entries: { a: { attempted: 2, completed: 2 } } },
      { weekNumber: 1, entries: { a: { attempted: 2, completed: 1 } } },
    ]
    expect(weeklyCompletion(logs)).toEqual([{ week: 1, rate: 0.5 }, { week: 2, rate: 1 }]) // sorted, with correct rates
    const plans = [
      { weekNumber: 1, days: [{ exercises: [{ exerciseId: 'squat', sets: 3, reps: 12 }] }] },
      { weekNumber: 2, days: [{ exercises: [{ exerciseId: 'squat', sets: 4, reps: 13 }] }] },
    ]
    expect(volumeSeries(plans, 'squat').map((x) => x.value)).toEqual([36, 52]) // 3×12 and 4×13
    const st = sessionStats([
      { kind: 'reps', repsCounted: 10, selfCount: 10, cleanRate: 1 }, // counter matched the user exactly
      { kind: 'reps', repsCounted: 8, selfCount: 10, cleanRate: 0.5 }, // counter was 2 short
    ])
    expect(st.counted).toBe(18)
    expect(st.cleanRate).toBeCloseTo(0.75) // average of 1 and 0.5
    expect(st.agreement).toBeCloseTo(0.9) // average of 1.0 and 0.8
  })
})
