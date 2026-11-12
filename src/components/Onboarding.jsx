// Onboarding: the four setup questions (goal, equipment, space, training days),
// shown one at a time. When finished it hands the answers to App, which builds the plan.
import { useState } from 'react' // React tool for remembering values between renders

const STEPS = ['goal', 'equipment', 'space', 'frequency'] // the questions, in order

// Answer choices for "What are you training for?"
const GOAL_OPTIONS = [
  { value: 'general_fitness', label: 'General fitness', blurb: 'Stay active, feel better day to day' },
  { value: 'strength', label: 'Build strength', blurb: 'Progressively harder resistance work' },
  { value: 'weight_loss', label: 'Weight loss', blurb: 'Higher-rep, full-body sessions' },
  { value: 'mobility', label: 'Mobility', blurb: 'Loosen up and move more freely' },
]

// Answer choices for "What equipment do you have?"
const EQUIPMENT_OPTIONS = [
  { value: 'none', label: 'None', blurb: 'Bodyweight only' },
  { value: 'resistance_band', label: 'Resistance band', blurb: '' },
  { value: 'dumbbells', label: 'Dumbbells', blurb: '' },
  { value: 'full_gym', label: 'Full home gym', blurb: '' },
]

// Answer choices for "How much space can you train in?"
const SPACE_OPTIONS = [
  { value: 'small', label: 'Small', blurb: 'A yoga-mat-sized area' },
  { value: 'medium', label: 'Medium', blurb: 'Room to stretch out and lunge' },
  { value: 'large', label: 'Large', blurb: 'A garage, garden, or open room' },
]

// onComplete = called with the answers; initial = existing answers when editing;
// onExit = "Cancel" on the first step; error = message to show.
export default function Onboarding({ onComplete, initial = null, onExit = null, error = null }) {
  const [stepIndex, setStepIndex] = useState(0) // which question is showing (0 to 3)
  const [profile, setProfile] = useState( // the answers so far
    initial ?? { goal: null, equipment: null, space: null, frequency: 3 } // start empty, with 3 days as default
  )

  const step = STEPS[stepIndex] // name of the current question
  const canGoNext = // the Continue button only works once the current question is answered
    (step === 'goal' && profile.goal) ||
    (step === 'equipment' && profile.equipment) ||
    (step === 'space' && profile.space) ||
    step === 'frequency' // days always has a value

  // Continue button: next question, or finish on the last one.
  function next() {
    if (stepIndex === STEPS.length - 1) {
      onComplete(profile) // last question: hand the answers to App
    } else {
      setStepIndex((i) => i + 1) // go to the next question
    }
  }

  // Back button: previous question, or leave on the first one.
  function back() {
    if (stepIndex === 0 && onExit) onExit() // first question: cancel
    else setStepIndex((i) => Math.max(0, i - 1)) // otherwise go back one question
  }

  return (
    <div className="min-h-full flex flex-col px-6 py-10 max-w-md mx-auto">
      {/* progress bar showing which of the four questions is current */}
      <ProgressDots total={STEPS.length} current={stepIndex} />

      <div className="flex-1 flex flex-col justify-center">
        {/* question 1: goal */}
        {step === 'goal' && (
          <StepChoice
            title="What are you training for?"
            options={GOAL_OPTIONS}
            value={profile.goal}
            onChange={(v) => setProfile((p) => ({ ...p, goal: v }))} // save the chosen goal
          />
        )}

        {/* question 2: equipment */}
        {step === 'equipment' && (
          <StepChoice
            title="What equipment do you have?"
            options={EQUIPMENT_OPTIONS}
            value={profile.equipment}
            onChange={(v) => setProfile((p) => ({ ...p, equipment: v }))} // save the chosen equipment
          />
        )}

        {/* question 3: space */}
        {step === 'space' && (
          <StepChoice
            title="How much space can you train in?"
            options={SPACE_OPTIONS}
            value={profile.space}
            onChange={(v) => setProfile((p) => ({ ...p, space: v }))} // save the chosen space
          />
        )}

        {/* question 4: training days per week */}
        {step === 'frequency' && (
          <FrequencyStep
            value={profile.frequency}
            onChange={(v) => setProfile((p) => ({ ...p, frequency: v }))} // save the chosen number of days
          />
        )}
      </div>

      {/* error message, if building the plan failed */}
      {error && <p className="text-sm text-red-400 pt-4" role="alert">{error}</p>}
      {/* Back / Cancel and Continue / Build buttons */}
      <div className="flex items-center justify-between pt-8">
        <button
          onClick={back}
          disabled={stepIndex === 0 && !onExit} // nothing to go back to
          className="text-sm text-[var(--color-muted)] disabled:opacity-0 px-2 py-2"
        >
          {stepIndex === 0 && onExit ? 'Cancel' : 'Back'}
        </button>
        <button
          onClick={next}
          disabled={!canGoNext} // greyed out until the question is answered
          className="font-display font-semibold px-6 py-3 rounded-full bg-[var(--color-amber)] text-[var(--color-ink)] disabled:bg-[var(--color-surface-raised)] disabled:text-[var(--color-muted)] transition-colors"
        >
          {/* last step says "Build my plan" (or "Update my plan" when editing) */}
          {stepIndex === STEPS.length - 1 ? (initial ? 'Update my plan' : 'Build my plan') : 'Continue'}
        </button>
      </div>
    </div>
  )
}

// The four small bars at the top; filled bars show the questions reached so far.
function ProgressDots({ total, current }) {
  return (
    <div className="flex gap-1.5 mb-10" aria-hidden="true">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-colors ${
            i <= current ? 'bg-[var(--color-amber)]' : 'bg-[var(--color-surface-raised)]'
          }`}
        />
      ))}
    </div>
  )
}

// One multiple-choice question: a title and a list of option buttons.
function StepChoice({ title, options, value, onChange }) {
  return (
    <fieldset>
      <legend className="font-display text-2xl font-semibold mb-6 leading-snug">
        {title}
      </legend>
      <div className="flex flex-col gap-2.5">
        {options.map((opt) => {
          const selected = value === opt.value // is this the chosen option?
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)} // choose this option
              aria-pressed={selected}
              className={`text-left px-4 py-3.5 rounded-xl border transition-colors ${
                selected
                  ? 'border-[var(--color-amber)] bg-[var(--color-surface-raised)]'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-muted)]'
              }`}
            >
              <div className="font-medium">{opt.label}</div>
              {/* short description under the option, if it has one */}
              {opt.blurb && (
                <div className="text-sm text-[var(--color-muted)] mt-0.5">{opt.blurb}</div>
              )}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

// The "How many days a week?" question: round buttons for 2 to 6 days.
function FrequencyStep({ value, onChange }) {
  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-6 leading-snug">
        How many days a week?
      </h2>
      <div className="flex items-center justify-between gap-3">
        {[2, 3, 4, 5, 6].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)} // choose n days
            aria-pressed={value === n}
            className={`h-14 w-14 rounded-full font-display font-semibold text-lg transition-colors ${
              value === n
                ? 'bg-[var(--color-amber)] text-[var(--color-ink)]'
                : 'bg-[var(--color-surface)] border border-[var(--color-border)]'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="text-sm text-[var(--color-muted)] mt-4">
        You can change this later from the plan screen. The plan adjusts to what you actually complete.
      </p>
    </div>
  )
}
