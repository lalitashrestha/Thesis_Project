// planGenerator.js
// Builds the first weekly plan from the user's profile, and at the end of
// every week decides how each exercise changes (progress, hold, or at cap).

// Bring in two helpers from the exercise catalogue: one finds an exercise by
// its id, the other returns every exercise that suits a user's profile.
import { exerciseById, exercisesFor } from '../data/exercises'

// --- Plan shape -------------------------------------------------------
// A plan is: { weekNumber, days: [ { dayIndex, exercises: [ { exerciseId, sets, reps, holdSeconds } ] } ],
//              adaptation?: { [exerciseId]: { rate, cleanRate, action } } }
// Completion logs are: { weekNumber, entries: { [exerciseId]: { attempted, completed, cleanRate } } }
//
// All functions here are pure (no DOM, no storage, no camera) so they can
// be unit-tested in isolation and reused unchanged regardless of whether
// completion came from a manual toggle or camera-verified counts.

const MIN_EXERCISES_PER_DAY = 3 // every training day gets at least 3 exercises
const MAX_EXERCISES_PER_DAY = 5 // ...and at most 5

// Progression rules.
export const PROGRESS_THRESHOLD = 0.8 // completion needed to progress
export const CLEAN_THRESHOLD = 0.75 // camera-checked form quality needed to progress
export const MAX_SETS = 5 // safety cap: never prescribe more than 5 sets
export const MAX_HOLD_SECONDS = 90 // safety cap: never prescribe a hold longer than 90 s

// Creates week 1 of the plan from the onboarding answers
// (profile = { goal, equipment, space, frequency }).
export function generateInitialPlan(profile) {
  const pool = exercisesFor(profile) // all exercises that fit this user's goal, equipment and space
  if (pool.length === 0) { // nothing fits, so a plan cannot be made
    throw new Error('No exercises match this profile. Try a different equipment or space setting.')
  }

  const days = [] // will hold one entry per training day
  for (let dayIndex = 0; dayIndex < profile.frequency; dayIndex++) { // one loop per training day
    const rotated = rotate(pool, dayIndex) // start the list at a different exercise each day, so days differ
    const dayExercises = pickVaried(rotated, MIN_EXERCISES_PER_DAY, MAX_EXERCISES_PER_DAY).map( // choose 3-5 exercises from different muscle groups
      (ex) => ({ // turn each chosen exercise into a plan entry with its starting volume
        exerciseId: ex.id, // which exercise
        sets: ex.baseSets, // starting number of sets
        reps: ex.baseReps, // starting repetitions per set (null for holds)
        holdSeconds: ex.baseHoldSeconds ?? null, // starting hold time for plank / wall sit, otherwise null
      })
    )
    days.push({ dayIndex, exercises: dayExercises }) // add the finished day to the plan
  }

  return { weekNumber: 1, days } // the first plan is always week 1
}

/**
 * Decides what happens to one exercise next week.
 *  - 'progress': completed >= 80% of the time AND (if the camera checked
 *    it) form was clean >= 75% of the time.
 *  - 'hold_form': completed enough but form quality was low. Volume holds
 *    so the user fixes technique before doing more of it.
 *  - 'hold_completion': completed less than 80%. Volume holds. The plan
 *    never reduces, so a hard week is never punished.
 */
export function decideAction(rate, cleanRate) {
  if (rate < PROGRESS_THRESHOLD) return 'hold_completion' // test 1: less than 80% completed -> hold
  if (cleanRate != null && cleanRate < CLEAN_THRESHOLD) return 'hold_form' // test 2: camera saw under 75% clean reps -> hold (skipped for manual ticks, where cleanRate is null)
  return 'progress' // both tests passed -> increase volume
}

// Increases a number by 10%, but always by at least 1 (e.g. 3 -> 4, 12 -> 13, 30 -> 33).
function grow(value) {
  return Math.max(value + 1, Math.round(value * 1.1)) // the larger of "+1" and "+10%"
}

/** Applies one week of progression to a plan entry, honouring safety caps. */
export function progressEntry(entry) {
  const ex = exerciseById(entry.exerciseId) // look up the exercise to know its starting reps
  const maxReps = ex?.baseReps ? ex.baseReps * 2 : null // reps may grow to at most double the starting value
  const next = { ...entry } // copy the entry so the old plan is not changed
  next.sets = Math.max(entry.sets, Math.min(MAX_SETS, grow(entry.sets))) // grow sets, cap at 5, never go down
  if (entry.reps != null && maxReps != null) { // only for repetition exercises
    next.reps = Math.max(entry.reps, Math.min(maxReps, grow(entry.reps))) // grow reps, cap at double, never go down
  }
  if (entry.holdSeconds != null) { // only for timed holds
    next.holdSeconds = Math.max(entry.holdSeconds, Math.min(MAX_HOLD_SECONDS, grow(entry.holdSeconds))) // grow hold time, cap at 90 s, never go down
  }
  return next // the entry for next week
}

// True when two entries prescribe exactly the same volume.
function sameVolume(a, b) {
  return a.sets === b.sets && a.reps === b.reps && a.holdSeconds === b.holdSeconds // sets, reps and hold all equal
}

/**
 * Produces the following week's plan from the current plan and a log of
 * what was actually completed.
 */
export function adaptPlan(currentPlan, completionLog) {
  const adaptation = {} // records the decision for each exercise, so the app can explain it
  const nextDays = currentPlan.days.map((day) => ({ // build next week day by day
    dayIndex: day.dayIndex, // keep the same day number
    exercises: day.exercises.map((entry) => { // decide each exercise in that day
      const rate = completionRate(completionLog, entry.exerciseId) // share of planned instances completed (0 to 1)
      const cleanRate = completionLog?.entries?.[entry.exerciseId]?.cleanRate ?? null // camera form score, or null if never checked by camera
      let action = decideAction(rate, cleanRate) // progress, hold_form or hold_completion
      let next = entry // by default the exercise stays the same (hold)
      if (action === 'progress') { // the rule allows an increase
        next = progressEntry(entry) // apply +10% / +1 with caps
        if (sameVolume(entry, next)) action = 'at_cap' // nothing could grow because every cap is reached
      }
      adaptation[entry.exerciseId] = { rate, cleanRate, action } // remember why this decision was made
      return next // the entry for next week
    }),
  }))

  return { weekNumber: currentPlan.weekNumber + 1, days: nextDays, adaptation } // next week's plan plus the decisions
}

// Completed divided by attempted for one exercise in the week's log.
function completionRate(completionLog, exerciseId) {
  const entry = completionLog?.entries?.[exerciseId] // this exercise's line in the log
  if (!entry || entry.attempted === 0) return 0 // no record -> treat as 0% completed
  return entry.completed / entry.attempted // e.g. 2 of 3 days -> 0.67
}

// Moves the first n items of a list to the end (n wraps round the list length).
function rotate(arr, n) {
  const i = n % arr.length // where the rotated list should start
  return [...arr.slice(i), ...arr.slice(0, i)] // the tail first, then the head
}

/** Picks a small, muscle-group-varied subset of exercises for one day. */
function pickVaried(pool, min, max) {
  const seen = new Set() // muscle groups already used today
  const picked = [] // exercises chosen for today
  for (const ex of pool) { // walk through the candidate exercises in order
    if (picked.length >= max) break // already have the maximum, stop
    if (seen.has(ex.muscleGroup) && picked.length >= min) continue // skip a repeated muscle group once the minimum is reached
    picked.push(ex) // choose this exercise
    seen.add(ex.muscleGroup) // remember its muscle group
  }
  return picked.length >= min ? picked : pool.slice(0, Math.min(min, pool.length)) // fallback: if too few, just take the first few
}

/** "3 x 12" or "3 x 30s" */
export function formatPrescription(entry) {
  return entry.holdSeconds ? `${entry.sets} × ${entry.holdSeconds}s` : `${entry.sets} × ${entry.reps}` // holds show seconds, others show reps
}

/**
 * Plain-language summary of what changed between two consecutive plans,
 * grouped by the reason, for the banner shown after "Finish week".
 */
export function summariseAdaptation(oldPlan, newPlan, exerciseNameOf) {
  const groups = { increased: [], held: [], heldForForm: [], atCap: [] } // one list of names per outcome
  const seen = new Set() // an exercise can appear on several days; list it once
  for (const day of newPlan.days) { // go through every day of the new plan
    for (const entry of day.exercises) { // and every exercise in it
      if (seen.has(entry.exerciseId)) continue // already listed
      seen.add(entry.exerciseId) // mark as listed
      const name = exerciseNameOf(entry.exerciseId) // readable name, e.g. "Bodyweight Squat"
      const action = newPlan.adaptation?.[entry.exerciseId]?.action // the decision made for it
      if (action === 'progress') groups.increased.push(name) // went up
      else if (action === 'hold_form') groups.heldForForm.push(name) // held because form was poor
      else if (action === 'at_cap') groups.atCap.push(name) // could not grow further
      else groups.held.push(name) // held because completion was low
    }
  }
  return groups // used by the "what changed" banner
}

/** Before/after rows for every exercise whose prescription differs. */
export function diffPlans(oldPlan, newPlan, exerciseNameOf) {
  const before = new Map() // exerciseId -> its entry in the old plan
  for (const day of oldPlan.days) for (const e of day.exercises) if (!before.has(e.exerciseId)) before.set(e.exerciseId, e) // remember the first entry of each exercise
  const rows = [] // one row per exercise for the comparison table
  const seen = new Set() // list each exercise once
  for (const day of newPlan.days) { // go through the new plan
    for (const e of day.exercises) {
      if (seen.has(e.exerciseId)) continue // already added
      seen.add(e.exerciseId)
      const b = before.get(e.exerciseId) // the same exercise last week
      if (!b) continue // new exercise with nothing to compare
      rows.push({ // one before/after row
        exerciseId: e.exerciseId,
        name: exerciseNameOf(e.exerciseId), // readable name
        from: formatPrescription(b), // last week, e.g. "3 × 12"
        to: formatPrescription(e), // next week, e.g. "4 × 13"
        changed: !sameVolume(b, e), // true if the volume changed
        action: newPlan.adaptation?.[e.exerciseId]?.action ?? 'hold_completion', // the reason
      })
    }
  }
  return rows // shown in the plan view after a week is finished
}
