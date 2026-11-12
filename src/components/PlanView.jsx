// PlanView: the weekly plan screen. Shows the days, the exercises of the selected day,
// a Start button (camera) and a tick button (manual) for each exercise, and the
// "Finish week & adapt plan" button.
import { useMemo, useState } from 'react' // React tools: remember values, and cache calculations
import { exerciseById } from '../data/exercises' // exercise catalogue lookup
import { isCameraDetectable } from '../lib/pose/detectorRegistry' // does this exercise have a camera detector?
import { ExerciseFigure } from './figures' // small drawing of each exercise

const DAY_LABELS = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'] // names of the day tabs

// Makes the key used to store whether an exercise on a given day is done, e.g. "0:squat".
export function dayExerciseKey(dayIndex, exerciseId) {
  return `${dayIndex}:${exerciseId}`
}

export default function PlanView({
  plan, // this week's plan
  completion, // which exercises are done this week
  onToggleComplete, // manual tick
  onStartCamera, // Start button
  onFinishWeek, // Finish week button
  adaptationSummary, // "what changed" banner contents, after a week is finished
  onDismissSummary, // closes that banner
  onReset, // Start over
  onEditSetup, // Edit setup
}) {
  // Which day tab to open first: the first day that still has an unfinished exercise.
  const firstOpenDay = useMemo(() => {
    const i = plan.days.findIndex((d) =>
      d.exercises.some((e) => !completion[dayExerciseKey(d.dayIndex, e.exerciseId)]?.done) // any exercise not done?
    )
    return i === -1 ? 0 : i // all done: open Day 1
    // only on first mount for this week
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.weekNumber])
  const [activeDay, setActiveDay] = useState(firstOpenDay) // the day tab currently shown
  const [openId, setOpenId] = useState(null) // the exercise whose instructions are expanded
  const [confirmingReset, setConfirmingReset] = useState(false) // showing the "Erase everything?" question
  const [confirmingFinish, setConfirmingFinish] = useState(false) // showing the "Finish the week?" question
  const day = plan.days[activeDay] ?? plan.days[0] // the selected day

  // Count how many exercises are done this week, out of all planned.
  const weekProgress = useMemo(() => {
    const total = plan.days.reduce((n, d) => n + d.exercises.length, 0) // all planned exercises
    const done = plan.days.reduce( // all completed exercises (camera or tick)
      (n, d) => n + d.exercises.filter((e) => completion[dayExerciseKey(d.dayIndex, e.exerciseId)]?.done).length,
      0
    )
    return { done, total }
  }, [plan, completion]) // recalculate only when the plan or the ticks change
  const pct = weekProgress.total ? Math.round((weekProgress.done / weekProgress.total) * 100) : 0 // percentage for the progress bar

  return (
    <div className="max-w-md mx-auto px-6 pt-6 pb-16">
      {/* "Your new plan is ready" banner, shown right after finishing a week */}
      {adaptationSummary && <AdaptationBanner summary={adaptationSummary} onDismiss={onDismissSummary} />}

      {/* header: week number, title, Edit setup / Start over, and the week progress bar */}
      <header className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-[var(--color-sage)] font-medium">Week {plan.weekNumber}</p>
            <h1 className="font-display text-2xl font-semibold mt-1">Your plan</h1>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <button onClick={onEditSetup} className="text-xs text-[var(--color-muted)] underline underline-offset-2">Edit setup</button>
            <ResetControl
              confirming={confirmingReset}
              onRequestReset={() => setConfirmingReset(true)} // ask first
              onCancel={() => setConfirmingReset(false)}
              onConfirm={onReset} // erase everything
            />
          </div>
        </div>
        {/* progress bar: the amber part grows with the share of exercises done */}
        <div className="mt-4 h-1.5 rounded-full bg-[var(--color-surface-raised)] overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Week progress">
          <div className="h-full bg-[var(--color-amber)] rounded-full transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-sm text-[var(--color-muted)] mt-2">
          {weekProgress.done} of {weekProgress.total} exercises done this week
        </p>
      </header>

      {/* day tabs: Day 1, Day 2, ... with a tick when every exercise of that day is done */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-5 -mx-1 px-1">
        {plan.days.map((d, i) => {
          const dayDone = d.exercises.every((e) => completion[dayExerciseKey(d.dayIndex, e.exerciseId)]?.done) // whole day finished?
          return (
            <button
              key={d.dayIndex}
              onClick={() => setActiveDay(i)} // show this day
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                activeDay === i
                  ? 'bg-[var(--color-amber)] text-[var(--color-ink)] border-[var(--color-amber)]'
                  : 'border-[var(--color-border)] text-[var(--color-muted)]'
              }`}
            >
              {DAY_LABELS[d.dayIndex] ?? `Day ${d.dayIndex + 1}`}
              {dayDone && <span className="ml-1.5" aria-label="complete">{'✓'}</span>}
            </button>
          )
        })}
      </div>

      {/* the exercises of the selected day */}
      <ul className="flex flex-col gap-3">
        {day.exercises.map((entry) => {
          const ex = exerciseById(entry.exerciseId) // full exercise details
          const key = dayExerciseKey(day.dayIndex, entry.exerciseId) // e.g. "0:squat"
          const state = completion[key] // its tick / camera result, if any
          const done = !!state?.done // is it done?
          const detectable = isCameraDetectable(entry.exerciseId) // can the camera check it? (decides the Start button)
          const open = openId === key // are its instructions expanded?

          return (
            <li key={key} className="rounded-2xl border bg-[var(--color-surface)] overflow-hidden transition-colors" style={{ borderColor: done ? 'var(--color-amber)' : 'var(--color-border)' }}>
              <div className="flex items-center gap-3 p-3">
                {/* tapping the exercise name expands or collapses its instructions */}
                <button
                  onClick={() => setOpenId(open ? null : key)}
                  aria-expanded={open}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left"
                >
                  <span className="h-14 w-14 shrink-0 rounded-xl bg-[var(--color-surface-raised)] grid place-items-center">
                    <ExerciseFigure id={entry.exerciseId} className="h-11 w-11" stroke={7} showJoints={false} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium leading-snug">{ex.name}</span>
                    {/* this week's prescription, e.g. "3 sets × 12 reps" or "3 sets × 30s hold" */}
                    <span className="block text-sm text-[var(--color-muted)]">
                      {entry.holdSeconds ? `${entry.sets} sets × ${entry.holdSeconds}s hold` : `${entry.sets} sets × ${entry.reps} reps`}
                    </span>
                    {/* camera route: show what the camera counted and the clean-form rate */}
                    {state?.verifiedByCamera && (
                      <span className="block text-xs text-[var(--color-sage)] mt-0.5">
                        {state.heldSeconds ? `${state.heldSeconds}s held` : `${state.repsDetected} reps`} verified by camera
                        {state.cleanRate != null && `, ${Math.round(state.cleanRate * 100)}% clean`}
                      </span>
                    )}
                    {/* manual route: ticked by the user, no camera data */}
                    {state && !state.verifiedByCamera && done && (
                      <span className="block text-xs text-[var(--color-muted)] mt-0.5">Marked done by you</span>
                    )}
                  </span>
                </button>

                <div className="shrink-0 flex items-center gap-2">
                  {/* Start button (only for exercises with a camera detector); says "Redo" after a camera session */}
                  {detectable && (
                    <button
                      onClick={() => onStartCamera(day.dayIndex, entry)} // open the camera screen for this exercise
                      className={`px-3.5 py-2 rounded-full text-xs font-medium border transition-colors ${
                        done && state?.verifiedByCamera
                          ? 'bg-[var(--color-amber)] text-[var(--color-ink)] border-[var(--color-amber)]'
                          : 'border-[var(--color-amber)] text-[var(--color-amber)]'
                      }`}
                    >
                      {done && state?.verifiedByCamera ? 'Redo' : 'Start'}
                    </button>
                  )}
                  {/* round tick button: marks the exercise done (or not done) by hand */}
                  <button
                    onClick={() => onToggleComplete(day.dayIndex, entry.exerciseId)} // manual tick
                    aria-pressed={done}
                    aria-label={done ? `Mark ${ex.name} not done` : `Mark ${ex.name} done`}
                    className={`h-9 w-9 rounded-full border flex items-center justify-center transition-colors ${
                      done ? 'bg-[var(--color-amber)] border-[var(--color-amber)] text-[var(--color-ink)]' : 'border-[var(--color-border)] text-transparent hover:text-[var(--color-muted)]'
                    }`}
                  >
                    {'✓'}
                  </button>
                </div>
              </div>

              {/* expanded section: larger drawing, step-by-step instructions and the camera tip */}
              {open && (
                <div className="border-t border-[var(--color-border)] px-4 py-4 grid grid-cols-[96px_1fr] gap-4 items-start bg-[var(--color-ink)]/40">
                  <div className="rounded-xl bg-[var(--color-surface-raised)] p-1.5">
                    <ExerciseFigure id={entry.exerciseId} className="w-full" />
                  </div>
                  <div>
                    <ol className="list-decimal list-inside space-y-1 text-xs leading-snug text-[var(--color-cream)]/90">
                      {ex.howTo?.map((t, i) => <li key={i}>{t}</li>)}
                    </ol>
                    {ex.cameraTip && <p className="text-xs text-[var(--color-sage)] mt-3 leading-relaxed">Camera: {ex.cameraTip}</p>}
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {/* short help text explaining the two ways to complete an exercise */}
      <p className="text-xs text-[var(--color-muted)] mt-6 leading-relaxed">
        Tap <span className="text-[var(--color-amber)]">Start</span> to have your camera count the exercise, or tick it off
        yourself. Camera-verified work also feeds the form-quality check that decides next week's progression.
        Tap an exercise to see how it is done.
      </p>

      {/* Finish week: first asks for confirmation, then calls onFinishWeek, which runs the weekly adaptation rule */}
      {confirmingFinish ? (
        <div className="mt-8 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-sm">
            {weekProgress.done < weekProgress.total
              ? `${weekProgress.total - weekProgress.done} exercises are not done yet. Finish the week anyway?`
              : 'Finish this week and build week ' + (plan.weekNumber + 1) + '?'}
          </p>
          <div className="mt-3 flex gap-2">
            <button onClick={() => { setConfirmingFinish(false); onFinishWeek() }} className="flex-1 font-display font-semibold px-4 py-2.5 rounded-full bg-[var(--color-amber)] text-[var(--color-ink)]">Yes, adapt my plan</button>
            <button onClick={() => setConfirmingFinish(false)} className="px-4 py-2.5 rounded-full border border-[var(--color-border)] text-sm text-[var(--color-muted)]">Not yet</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setConfirmingFinish(true)} // show the confirmation question
          className="w-full mt-8 font-display font-semibold px-6 py-3.5 rounded-full border border-[var(--color-amber)] text-[var(--color-amber)] hover:bg-[var(--color-surface-raised)] transition-colors"
        >
          Finish week & adapt plan
        </button>
      )}
    </div>
  )
}

// "Start over" link; asks "Erase everything? Yes / No" before resetting.
function ResetControl({ confirming, onRequestReset, onCancel, onConfirm }) {
  if (confirming) { // the question is showing
    return (
      <div className="shrink-0 flex items-center gap-2 text-xs">
        <span className="text-[var(--color-muted)]">Erase everything?</span>
        <button onClick={onConfirm} className="text-[var(--color-amber)] font-medium">Yes</button>
        <button onClick={onCancel} className="text-[var(--color-muted)]">No</button>
      </div>
    )
  }
  return ( // normal state: just the link
    <button onClick={onRequestReset} className="shrink-0 text-xs text-[var(--color-muted)] underline underline-offset-2">
      Start over
    </button>
  )
}

// Banner explaining what changed in the new week's plan, grouped by reason.
function AdaptationBanner({ summary, onDismiss }) {
  const { increased, held, heldForForm, atCap } = summary // names grouped by decision (from summariseAdaptation)
  const lines = [] // one sentence per non-empty group
  if (increased.length) lines.push(<span key="i"><span className="text-[var(--color-amber)] font-medium">{increased.join(', ')}</span> went up for consistent, clean work.</span>)
  if (heldForForm.length) lines.push(<span key="f"><span className="text-[var(--color-sage)] font-medium">{heldForForm.join(', ')}</span> held steady: the camera saw form slipping, so technique comes first.</span>)
  if (held.length) lines.push(<span key="h">{held.join(', ')} held steady (completion was under 80%).</span>)
  if (atCap.length) lines.push(<span key="c">{atCap.join(', ')} reached the safety cap.</span>)

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3.5 mb-6">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm space-y-1.5 leading-relaxed">
          <p className="font-display font-semibold">Your new plan is ready</p>
          {lines.map((l, i) => <p key={i}>{l}</p>)}
        </div>
        {/* close (✕) button */}
        <button onClick={onDismiss} aria-label="Dismiss" className="shrink-0 text-[var(--color-muted)] text-sm leading-none py-1">{'✕'}</button>
      </div>
    </div>
  )
}
