// Pure helpers that turn stored plans, logs and sessions into the numbers
// and series the Progress screen draws.

/** Per-week completion rate (0-1) across all planned exercise instances. */
export function weeklyCompletion(logs) {
  return [...logs] // copy the list so the original is not reordered
    .sort((a, b) => a.weekNumber - b.weekNumber) // put the weeks in order: 1, 2, 3...
    .map((l) => { // turn each week's log into one point on the chart
      const vals = Object.values(l.entries ?? {}) // the per-exercise records of that week
      const attempted = vals.reduce((n, e) => n + e.attempted, 0) // total planned exercise instances
      const completed = vals.reduce((n, e) => n + e.completed, 0) // total completed instances
      return { week: l.weekNumber, rate: attempted ? completed / attempted : 0 } // completion rate, 0 if nothing was planned
    })
}

/** Prescribed volume of one exercise per week (reps or hold seconds, times sets). */
export function volumeSeries(plans, exerciseId) {
  const out = [] // one point per week
  for (const plan of plans) { // every stored weekly plan
    for (const day of plan.days) { // look through its days
      const e = day.exercises.find((x) => x.exerciseId === exerciseId) // this exercise on this day, if planned
      if (e) { // found it
        out.push({
          week: plan.weekNumber, // which week
          value: e.sets * (e.holdSeconds ?? e.reps ?? 0), // total volume: sets × reps, or sets × seconds
          label: e.holdSeconds ? `${e.sets}×${e.holdSeconds}s` : `${e.sets}×${e.reps}`, // text shown on the chart
        })
        break // one value per week is enough
      }
    }
  }
  return out // series for the "volume over the weeks" chart
}

// Lists every exercise that appears in any plan, without duplicates.
export function exercisesInPlans(plans) {
  const ids = [] // exercise ids found so far
  for (const plan of plans) for (const d of plan.days) for (const e of d.exercises) if (!ids.includes(e.exerciseId)) ids.push(e.exerciseId) // add each new id once
  return ids
}

// Summary numbers for the Progress screen, from the saved camera sessions.
export function sessionStats(sessions) {
  const camera = sessions.filter((s) => s.kind !== 'manual') // keep camera sessions only
  const counted = camera.reduce((n, s) => n + (s.repsCounted ?? 0), 0) // total repetitions counted by the camera
  const holdSeconds = camera.reduce((n, s) => n + (s.heldSeconds ?? 0), 0) // total seconds held (plank, wall sit)
  const withClean = camera.filter((s) => s.cleanRate != null) // sessions that have a form score
  const cleanRate = withClean.length // average clean-form rate, or null if none
    ? withClean.reduce((n, s) => n + s.cleanRate, 0) / withClean.length
    : null

  // Agreement between the counter and the user's own count, on sessions
  // where they typed one in. 1 means identical.
  const checked = camera.filter((s) => s.selfCount != null && s.selfCount > 0 && s.kind === 'reps') // rep sessions where the user typed their own count
  const agreement = checked.length // average agreement, or null if never typed
    ? checked.reduce((n, s) => n + Math.max(0, 1 - Math.abs(s.repsCounted - s.selfCount) / s.selfCount), 0) / // 1 minus the relative difference, never below 0
      checked.length
    : null

  return { sessions: camera.length, counted, holdSeconds, cleanRate, agreement, checkedSessions: checked.length } // everything the Progress screen shows
}
