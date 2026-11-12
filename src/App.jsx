// App.jsx: the top-level component. It holds the app's main data (profile, plans,
// this week's ticks), decides which screen to show, and handles the big actions:
// finishing onboarding, ticking an exercise, finishing a camera session and finishing the week.
import { useEffect, useState } from 'react' // React tools for state and start-up code
import Landing from './components/Landing' // the welcome page
import Onboarding from './components/Onboarding' // the four setup questions
import PlanView, { dayExerciseKey } from './components/PlanView' // the weekly plan screen, and a helper that makes "day:exercise" keys
import Progress from './components/Progress' // the progress charts screen
import CameraSession from './components/CameraSession' // the webcam exercise screen
import TopNav from './components/TopNav' // the top bar with tabs
import { generateInitialPlan, adaptPlan, summariseAdaptation } from './lib/planGenerator' // planning logic
import { storage } from './lib/storage' // saving and loading data in the browser
import { exerciseById } from './data/exercises' // exercise catalogue lookup

const exerciseName = (id) => exerciseById(id)?.name ?? id // readable name of an exercise, or its id if unknown

export default function App() {
  const [screen, setScreen] = useState('landing') // landing | app
  const [view, setView] = useState('plan') // plan | progress
  const [profile, setProfile] = useState(undefined) // undefined = loading, null = none saved yet
  const [plan, setPlan] = useState(null) // the current week's plan
  const [plans, setPlans] = useState([]) // every week's plan so far (for the progress charts)
  // completion: { "dayIndex:exerciseId": { done, verifiedByCamera?, repsDetected?, ... } }
  const [completion, setCompletion] = useState({})
  const [adaptationSummary, setAdaptationSummary] = useState(null) // "what changed" banner after finishing a week
  const [session, setSession] = useState(null) // { dayIndex, entry } while the camera screen is open
  const [editing, setEditing] = useState(false) // true while the user is changing their setup answers
  const [error, setError] = useState(null) // error message to show during onboarding

  // Load any saved profile, plans and the week in progress.
  useEffect(() => {
    const savedProfile = storage.getProfile() // onboarding answers, if any
    const saved = storage.getPlans() // all saved weekly plans
    const current = saved[saved.length - 1] ?? null // the last plan is the current week
    setProfile(savedProfile)
    setPlans(saved)
    if (savedProfile && current) { // returning user
      setPlan(current) // show their current week
      setCompletion(storage.getCompletion(current.weekNumber)) // restore this week's ticks
    }
  }, []) // [] = run once, when the app first opens

  // Changes this week's ticks and saves them straight away.
  function updateCompletion(updater) {
    setCompletion((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater // work out the new ticks
      if (plan) storage.saveCompletion(plan.weekNumber, next) // save so a refresh does not lose them
      return next
    })
  }

  // Called when the user finishes the four onboarding questions.
  function handleOnboardingComplete(newProfile) {
    try {
      const fresh = generateInitialPlan(newProfile) // build a new week-1 plan from the answers
      storage.saveProfile(newProfile) // save the answers
      setProfile(newProfile)
      setError(null) // clear any old error
      if (editing && plan) {
        // Editing the setup keeps the week number and history, but rebuilds the exercises.
        const rebuilt = { ...fresh, weekNumber: plan.weekNumber } // new exercises, same week number
        const all = storage.getPlans()
        all[all.length - 1] = rebuilt // replace the current week's plan
        storage.savePlans(all)
        storage.saveCompletion(rebuilt.weekNumber, {}) // clear this week's ticks
        setPlans(all)
        setPlan(rebuilt)
        setCompletion({})
        setEditing(false) // leave editing mode
      } else { // brand-new user
        storage.savePlans([fresh]) // the plan history starts with week 1
        setPlans([fresh])
        setPlan(fresh)
        setCompletion({})
        storage.saveCompletion(1, {})
      }
      setView('plan') // show the plan tab
    } catch (e) {
      setError(e.message) // e.g. no exercise matches the answers
    }
  }

  // Manual route: the user ticks (or unticks) an exercise by hand.
  function handleToggleComplete(dayIndex, exerciseId) {
    updateCompletion((prev) => {
      const key = dayExerciseKey(dayIndex, exerciseId) // e.g. "0:squat"
      const wasDone = !!prev[key]?.done // was it already ticked?
      return { ...prev, [key]: { done: !wasDone } } // flip it; a manual tick stores only "done"
    })
  }

  // Camera route: called when a camera session is saved on its summary screen.
  function handleCameraFinish(result) {
    const { dayIndex } = session // which day the session belonged to
    const key = dayExerciseKey(dayIndex, result.exerciseId)
    const done = result.setsCompleted >= result.setsPlanned // done only if every planned set was finished
    updateCompletion((prev) => ({
      ...prev,
      [key]: {
        done,
        verifiedByCamera: true, // marks this as camera-checked
        repsDetected: result.repsCounted, // repetitions the camera counted
        heldSeconds: result.heldSeconds || undefined, // seconds held (plank, wall sit)
        setsCompleted: result.setsCompleted,
        cleanRate: result.cleanRate, // share of clean repetitions, used by the weekly rule
      },
    }))
    // Numbers only: no frames, no landmarks, ever.
    storage.addSession({
      at: new Date().toISOString(), // when the session happened
      week: plan.weekNumber,
      ...result, // the counts from the camera screen
    })
    setSession(null) // close the camera screen
  }

  // Called by the "Finish week" button: builds the week's log and next week's plan.
  function handleFinishWeek() {
    // Collapse completion state into the per-exercise log that the
    // adaptation engine reads: how often it was completed, and (where the
    // camera checked it) how clean the form was.
    const entries = {} // exerciseId -> totals for the week
    for (const day of plan.days) { // every training day
      for (const entry of day.exercises) { // every exercise on that day
        const state = completion[dayExerciseKey(day.dayIndex, entry.exerciseId)] // its tick / camera result
        const b = entries[entry.exerciseId] ?? { attempted: 0, completed: 0, verified: 0, cleanSum: 0, cleanN: 0 } // running totals for this exercise
        b.attempted += 1 // it was planned once more
        if (state?.done) b.completed += 1 // and completed (by camera or tick)
        if (state?.verifiedByCamera) b.verified += 1 // and checked by the camera
        if (state?.cleanRate != null) { // camera form score available
          b.cleanSum += state.cleanRate
          b.cleanN += 1
        }
        entries[entry.exerciseId] = b
      }
    }
    for (const b of Object.values(entries)) { // finish each exercise's totals
      b.cleanRate = b.cleanN ? b.cleanSum / b.cleanN : null // average clean-form rate, or null if never camera-checked
      delete b.cleanSum // helper totals are no longer needed
      delete b.cleanN
    }
    storage.saveLogForWeek(plan.weekNumber, entries) // save the week's log

    const nextPlan = adaptPlan(plan, { weekNumber: plan.weekNumber, entries }) // apply the weekly rule
    const all = [...storage.getPlans(), nextPlan] // add next week to the history
    storage.savePlans(all)
    storage.saveCompletion(nextPlan.weekNumber, {}) // next week starts with no ticks
    setPlans(all)
    setAdaptationSummary(summariseAdaptation(plan, nextPlan, exerciseName)) // prepare the "what changed" banner
    setPlan(nextPlan) // show next week
    setCompletion({})
    window.scrollTo?.({ top: 0 }) // scroll to the top so the banner is visible
  }

  // "Start over": wipe saved data and return to onboarding.
  function handleReset() {
    storage.reset()
    setProfile(null)
    setPlan(null)
    setPlans([])
    setCompletion({})
    setAdaptationSummary(null)
    setSession(null)
    setEditing(false)
  }

  if (profile === undefined) return null // brief flash while localStorage is read

  // 1. Landing page.
  if (screen === 'landing') {
    return (
      <Landing
        onStart={() => { setScreen('app'); window.scrollTo?.({ top: 0 }) }} // "Start fitness now" opens the app
        hasPlan={!!(profile && plan)} // returning users see "continue" wording
        weekNumber={plan?.weekNumber}
      />
    )
  }

  // 2. Onboarding: for new users, or when editing the setup.
  if (!profile || !plan || editing) {
    return (
      <Onboarding
        key={editing ? 'edit' : 'new'} // a new key resets the form when switching between new and edit
        onComplete={handleOnboardingComplete}
        initial={editing ? profile : null} // pre-fill the answers when editing
        onExit={editing ? () => setEditing(false) : () => setScreen('landing')} // where "Cancel" goes
        error={error}
      />
    )
  }

  // 3. Camera session, while one is open.
  if (session) {
    return (
      <CameraSession
        key={`${session.dayIndex}:${session.entry.exerciseId}`} // a fresh screen for each exercise
        exercise={exerciseById(session.entry.exerciseId)} // the exercise's details
        entry={session.entry} // its sets / reps / hold for this week
        onFinish={handleCameraFinish}
        onCancel={() => setSession(null)} // leaving without saving
      />
    )
  }

  // 4. Main app: top bar plus either the Plan or the Progress screen.
  return (
    <div className="min-h-full">
      <TopNav view={view} onChange={setView} onHome={() => setScreen('landing')} />
      {view === 'plan' ? (
        <PlanView
          plan={plan}
          completion={completion}
          onToggleComplete={handleToggleComplete} // manual tick
          onStartCamera={(dayIndex, entry) => setSession({ dayIndex, entry })} // Start button opens the camera screen
          onFinishWeek={handleFinishWeek}
          adaptationSummary={adaptationSummary}
          onDismissSummary={() => setAdaptationSummary(null)}
          onReset={handleReset}
          onEditSetup={() => setEditing(true)}
        />
      ) : (
        <Progress plans={plans} />
      )}
    </div>
  )
}
