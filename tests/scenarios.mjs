// Scenario tests of the real plan generator and weekly adaptation rule.
// Run with plain Node from the project root:  node tests/scenarios.mjs
// Results are reported in Chapter 5 (Table 5.3) and docs/appendices.md (Appendix E).
import { register } from 'node:module'

// src/ uses Vite-style extensionless imports, so resolve them to .js for Node.
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx) } catch (e) {
    if ((spec.startsWith('.') || spec.startsWith('/')) && !/\\.[cm]?js$/.test(spec)) return next(spec + '.js', ctx)
    throw e
  }
}`))

const { generateInitialPlan, adaptPlan } = await import('../src/lib/planGenerator.js')
const { GOALS, EQUIPMENT, SPACE, exercisesFor, exerciseById } = await import('../src/data/exercises.js')
const { isCameraDetectable } = await import('../src/lib/pose/detectorRegistry.js')

// 1. Plan generation over every onboarding profile
let profiles = 0
let valid = 0
const dayCounts = {}
const perGoal = {}
for (const goal of GOALS) for (const equipment of EQUIPMENT) for (const space of SPACE) for (let frequency = 2; frequency <= 6; frequency++) {
  profiles++
  const profile = { goal, equipment, space, frequency }
  const plan = generateInitialPlan(profile)
  const pool = new Set(exercisesFor(profile).map((e) => e.id))
  let ok = plan.days.length === frequency
  for (const day of plan.days) {
    const n = day.exercises.length
    dayCounts[n] = (dayCounts[n] || 0) + 1
    if (n < 3 || n > 5) ok = false
    if (day.exercises.some((e) => !pool.has(e.exerciseId))) ok = false
    if (new Set(day.exercises.map((e) => e.exerciseId)).size !== n) ok = false
  }
  const entries = plan.days.flatMap((d) => d.exercises)
  perGoal[goal] ??= { camera: 0, all: 0 }
  perGoal[goal].camera += entries.filter((e) => isCameraDetectable(e.exerciseId)).length
  perGoal[goal].all += entries.length
  if (ok) valid++
}
console.log(`Profiles: ${profiles}, valid plans: ${valid}`)
console.log('Days by number of exercises:', dayCounts)
for (const [goal, v] of Object.entries(perGoal)) console.log(`  ${goal}: ${(100 * v.camera / v.all).toFixed(0)}% of planned exercises camera-detectable`)

// 2. Eight weeks of adaptation under different usage patterns
const profile = { goal: 'general_fitness', equipment: 'none', space: 'medium', frequency: 3 }
const personas = {
  'A full completion, clean form (camera)': () => ({ done: 1, clean: 0.9 }),
  'B full completion, poor form (camera)': () => ({ done: 1, clean: 0.6 }),
  'C 70% completion (camera, clean)': () => ({ done: 0.7, clean: 0.9 }),
  'D full completion, manual ticks only': () => ({ done: 1, clean: null }),
  'E poor form weeks 1-2, then clean': (w) => ({ done: 1, clean: w <= 2 ? 0.6 : 0.85 }),
  'F missed week 3, otherwise full': (w) => ({ done: w === 3 ? 0.33 : 1, clean: 0.85 }),
}

function volume(plan) {
  let reps = 0
  let hold = 0
  for (const d of plan.days) for (const e of d.exercises) {
    if (e.holdSeconds) hold += e.sets * e.holdSeconds
    else reps += e.sets * (e.reps ?? 0)
  }
  return { reps, hold }
}

for (const [name, week] of Object.entries(personas)) {
  let plan = generateInitialPlan(profile)
  const series = [volume(plan)]
  const actions = {}
  let reductions = 0
  let capBreaches = 0
  for (let w = 1; w <= 8; w++) {
    const { done, clean } = week(w)
    const entries = {}
    for (const d of plan.days) for (const e of d.exercises) {
      const prev = entries[e.exerciseId] || { attempted: 0, completed: 0 }
      entries[e.exerciseId] = {
        attempted: prev.attempted + 3,
        completed: prev.completed + Math.round(3 * done),
        cleanRate: isCameraDetectable(e.exerciseId) ? clean : null,
      }
    }
    const next = adaptPlan(plan, { weekNumber: w, entries })
    for (const a of Object.values(next.adaptation)) actions[a.action] = (actions[a.action] || 0) + 1
    next.days.forEach((d, i) => d.exercises.forEach((e, j) => {
      const old = plan.days[i].exercises[j]
      if (e.sets < old.sets || (e.reps ?? 0) < (old.reps ?? 0) || (e.holdSeconds ?? 0) < (old.holdSeconds ?? 0)) reductions++
      const base = exerciseById(e.exerciseId)
      if (e.sets > 5 || (e.reps && e.reps > base.baseReps * 2) || (e.holdSeconds && e.holdSeconds > 90)) capBreaches++
    }))
    plan = next
    series.push(volume(plan))
  }
  console.log(`\n${name}`)
  console.log(`  reps/week:   ${series.map((s) => s.reps).join(' ')}`)
  console.log(`  hold s/week: ${series.map((s) => s.hold).join(' ')}`)
  console.log(`  decisions: ${JSON.stringify(actions)}  reductions: ${reductions}  cap breaches: ${capBreaches}`)
}
