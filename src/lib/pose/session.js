// Pure helpers for a camera session: set targets, the in-session nudge,
// and the clean-form score. Kept out of the React component so they can
// be unit-tested without a camera.

// Makes the list of targets for each set, e.g. 3 sets of 12 reps -> [12, 12, 12].
export function buildTargets(entry, kind) {
  const per = kind === 'hold' ? entry.holdSeconds ?? 30 : entry.reps ?? 10 // seconds for holds, reps otherwise (with defaults)
  return Array.from({ length: entry.sets ?? 1 }, () => per) // one target per set
}

/**
 * After a set, decide whether to trim the next set's target. If less than
 * 70% of the set was done cleanly, the next target drops by ~20% (never
 * below 60% of the original), so the user can keep form instead of grinding
 * out bad reps.
 */
export function nudgeNextTarget(originalTarget, lastTarget, cleanRate) {
  if (cleanRate == null || cleanRate >= 0.7) return { target: originalTarget, trimmed: false } // form was fine (or not measured): go back to the original target
  const floor = Math.max(1, Math.ceil(originalTarget * 0.6)) // never go below 60% of the original (and never below 1)
  const trimmed = Math.max(floor, Math.round(lastTarget * 0.8)) // cut the last target by about 20%
  return { target: Math.min(lastTarget, trimmed), trimmed: trimmed < lastTarget } // the new target, and whether it was actually reduced
}

// Share of repetitions that were counted (clean) out of all completed, e.g. 4 counted + 1 rejected = 0.8.
export function cleanRateFor(counted, rejected) {
  const total = counted + rejected // all repetitions the detector completed
  return total === 0 ? null : counted / total // null if there were none
}
