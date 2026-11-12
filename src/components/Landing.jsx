// Landing: the welcome page shown before the app. It explains the app in sections
// (hero, how it works, features, exercise gallery, adaptation, privacy) and has
// "Start fitness now" buttons that open the app.
import { useEffect, useRef, useState } from 'react' // React tools
import { ExerciseFigure, POSES, lerpPose, limbPath, prefersReducedMotion, subscribe } from './figures' // stick figures and animation helpers
import { TwoPhaseRepCounter } from '../lib/pose/detectors/common' // the real rep counter, used in the hero demo
import { EXERCISES } from '../data/exercises' // the exercise catalogue, for the gallery

// The whole landing page, section by section from top to bottom.
export default function Landing({ onStart, hasPlan, weekNumber }) {
  return (
    <div className="min-h-full overflow-x-hidden">
      <Nav onStart={onStart} />
      <Hero onStart={onStart} hasPlan={hasPlan} weekNumber={weekNumber} />
      <HowItWorks />
      <Features />
      <Gallery />
      <Adaptation />
      <Privacy />
      <FinalCta onStart={onStart} />
      <Footer />
    </div>
  )
}

/* ----------------------------------------------------------------- bits */

// The amber "Start fitness now" button with an arrow; big = larger version.
function StartButton({ onStart, big = false, children = 'Start fitness now' }) {
  return (
    <button
      onClick={onStart} // opens the app
      className={`group inline-flex items-center gap-2.5 whitespace-nowrap rounded-full bg-[var(--color-amber)] text-[var(--color-ink)] font-display font-semibold shadow-[0_8px_30px_-6px_rgba(232,163,61,0.55)] hover:brightness-110 active:scale-[0.98] transition ${big ? 'px-9 py-4 text-lg' : 'px-5 py-2.5 text-sm'}`}
    >
      {children}
      {/* arrow icon */}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-x-0.5" aria-hidden="true">
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </button>
  )
}

// The app logo (amber square with a stick figure) and the app name.
function Logo() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="h-8 w-8 rounded-xl bg-[var(--color-amber)] grid place-items-center" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="5" r="2" fill="var(--color-ink)" />
          <path d="M12 8v6M12 14l-4 6M12 14l4 6M6 10l6-2 6 2" />
        </svg>
      </span>
      <span className="font-display font-semibold tracking-tight hidden sm:inline">Adaptive Home Workout</span>
    </span>
  )
}

// Shared layout for each page section: small label, big title, optional intro, then the content.
function Section({ id, eyebrow, title, intro, children, className = '' }) {
  return (
    <section id={id} className={`px-6 py-20 sm:py-24 ${className}`}>
      <div className="max-w-5xl mx-auto">
        <p className="text-sm font-medium text-[var(--color-sage)] mb-3">{eyebrow}</p>
        <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight max-w-2xl leading-tight">{title}</h2>
        {intro && <p className="mt-4 text-[var(--color-muted)] max-w-2xl leading-relaxed">{intro}</p>}
        <div className="mt-12">{children}</div>
      </div>
    </section>
  )
}

// Top navigation bar: logo, links to the sections, and a Start button.
function Nav({ onStart }) {
  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-[var(--color-ink)]/75 border-b border-[var(--color-border)]/60">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <Logo />
        {/* section links (hidden on small screens) */}
        <nav className="hidden md:flex items-center gap-7 text-sm text-[var(--color-muted)]">
          <a href="#how" className="hover:text-[var(--color-cream)]">How it works</a>
          <a href="#features" className="hover:text-[var(--color-cream)]">Features</a>
          <a href="#exercises" className="hover:text-[var(--color-cream)]">Exercises</a>
          <a href="#privacy" className="hover:text-[var(--color-cream)]">Privacy</a>
        </nav>
        <StartButton onStart={onStart} />
      </div>
    </header>
  )
}

/* ----------------------------------------------------------------- hero */

// The first section: headline, short description, Start button, and the live squat demo.
function Hero({ onStart, hasPlan, weekNumber }) {
  return (
    <section className="relative px-6 pt-14 pb-20 sm:pt-20 sm:pb-28">
      {/* two soft coloured glows in the background */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-24 h-[28rem] w-[28rem] rounded-full bg-[var(--color-amber)] opacity-[0.10] blur-3xl" />
        <div className="absolute top-40 -right-24 h-[26rem] w-[26rem] rounded-full bg-[var(--color-sage)] opacity-[0.12] blur-3xl" />
      </div>
      <div className="relative max-w-5xl mx-auto grid lg:grid-cols-[1.05fr_1fr] gap-14 items-center">
        {/* left column: text */}
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-1.5 text-xs text-[var(--color-muted)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-sage)]" /> Home workouts that watch your form
          </p>
          <h1 className="font-display text-4xl sm:text-6xl font-semibold tracking-tight leading-[1.05] mt-6">
            Train at home.<br />
            <span className="text-[var(--color-amber)]">Your camera counts</span> the reps.
          </h1>
          <p className="mt-6 text-lg text-[var(--color-muted)] leading-relaxed max-w-xl">
            Tell the app what space and equipment you have. It builds your week, watches each exercise
            through your webcam or phone, counts only the clean reps, and raises the load once you have earned it.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
            <StartButton onStart={onStart} big />
            <a href="#how" className="text-sm text-[var(--color-muted)] hover:text-[var(--color-cream)] underline underline-offset-4 decoration-[var(--color-border)]">
              See how it works
            </a>
          </div>
          {/* "Welcome back" line for returning users */}
          {hasPlan && (
            <p className="mt-4 text-sm text-[var(--color-sage)]">Welcome back. Your week {weekNumber} plan is ready.</p>
          )}
          {/* three short promises with ticks */}
          <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--color-muted)]">
            {['No account or sign-up', 'Video never leaves your device', 'Runs in your browser'].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Tick /> {t}
              </li>
            ))}
          </ul>
        </div>
        {/* right column: the animated demo */}
        <HeroDemo />
      </div>
    </section>
  )
}

// Small green tick icon.
function Tick() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-sage)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12 5 5L20 7" />
    </svg>
  )
}

// A live demonstration of the app's own counting logic: an animated figure
// squats, the knee angle is measured from the drawn joints every frame, and
// the same TwoPhaseRepCounter used by the camera screen counts the reps.
function HeroDemo() {
  const [frame, setFrame] = useState({ pose: null, angle: 180, reps: 0, phase: 'high', hist: [] }) // what is drawn this frame
  const counter = useRef(new TwoPhaseRepCounter({ enterHighThreshold: 160, enterLowThreshold: 100, minDwellMs: 150 })) // same thresholds as the squat detector
  const hist = useRef([]) // the last 80 knee angles, for the little graph
  const last = useRef(0) // time of the last update

  useEffect(() => {
    const { a, b } = POSES.squat // standing and squatting poses
    // Works out one animation frame: the pose, its knee angle, and the counter's result.
    const compute = (t, now) => {
      const pose = lerpPose(a, b, t) // the pose part-way through the squat
      const [H, K, A] = pose.limbs[1].p // hip, knee and ankle points of the leg
      const v1 = [H[0] - K[0], H[1] - K[1]] // vector knee -> hip
      const v2 = [A[0] - K[0], A[1] - K[1]] // vector knee -> ankle
      const cos = (v1[0] * v2[0] + v1[1] * v2[1]) / (Math.hypot(...v1) * Math.hypot(...v2)) // cosine of the knee angle
      const angle = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI // knee angle in degrees
      const r = counter.current.update(angle, now) // feed the real rep counter
      hist.current = [...hist.current.slice(-79), angle] // keep the last 80 angles
      return { pose, angle, reps: r.reps, phase: r.phase, hist: hist.current }
    }
    if (prefersReducedMotion()) { // no animation wanted: show one still frame
      setFrame(compute(0.8, 1000))
      return undefined
    }
    return subscribe((now) => { // run on the shared animation clock
      if (now - last.current < 33) return // update about 30 times a second
      last.current = now
      const t = 0.5 - 0.5 * Math.cos((now / 3400) * 2 * Math.PI) // smooth down-and-up every 3.4 seconds
      setFrame(compute(t, now))
    })
  }, [])

  const pose = frame.pose ?? lerpPose(POSES.squat.a, POSES.squat.b, 0) // the pose to draw (standing at first)
  const [H, K, A] = pose.limbs[1].p // hip, knee, ankle (for the angle wedge)
  const plot = frame.hist.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i / 79) * 100} ${40 - ((v - 70) / 120) * 36}`).join(' ') // the knee-angle graph line
  const yFor = (v) => 40 - ((v - 70) / 120) * 36 // vertical position of an angle on that graph

  return (
    <div className="relative mx-auto w-full max-w-md">
      {/* phone-like frame */}
      <div className="relative rounded-[2rem] border border-[var(--color-border)] bg-gradient-to-b from-[var(--color-surface-raised)] to-[var(--color-surface)] p-3 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]">
        <div className="relative aspect-[4/5] rounded-[1.5rem] overflow-hidden bg-[#0b1013]">
          {/* faint grid background */}
          <div aria-hidden="true" className="absolute inset-0 opacity-30"
            style={{ backgroundImage: 'linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
          {/* the squatting figure with a green skeleton and the knee angle */}
          <svg viewBox="-6 6 132 108" className="absolute inset-0 h-full w-full" role="img" aria-label="Animated squat with pose tracking overlay">
            <line x1="0" y1="105" x2="120" y2="105" stroke="var(--color-border)" strokeWidth="1.5" />
            <g fill="none" stroke="#4ade80" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
              {pose.limbs.map((l, i) => <path key={i} d={limbPath(l)} />)}
            </g>
            <circle cx={pose.head[0]} cy={pose.head[1]} r="7.5" fill="none" stroke="#4ade80" strokeWidth="3.2" />
            <g fill="#f3efe6">
              {pose.limbs.flatMap((l, i) => l.p.map((pt, j) => <circle key={`${i}${j}`} cx={pt[0]} cy={pt[1]} r="2.3" />))}
            </g>
            {/* amber wedge showing the knee angle being measured */}
            <polygon points={`${K[0]},${K[1]} ${K[0] + (H[0] - K[0]) * 0.4},${K[1] + (H[1] - K[1]) * 0.4} ${K[0] + (A[0] - K[0]) * 0.4},${K[1] + (A[1] - K[1]) * 0.4}`}
              fill="var(--color-amber)" fillOpacity="0.35" stroke="var(--color-amber)" strokeWidth="1" />
            <text x={K[0] + 8} y={K[1] - 6} fill="var(--color-amber)" fontSize="6.5" fontWeight="600" fontFamily="Space Grotesk, sans-serif">{Math.round(frame.angle)}°</text>
          </svg>

          {/* camera corner brackets */}
          {['top-3 left-3 border-t-2 border-l-2 rounded-tl-xl', 'top-3 right-3 border-t-2 border-r-2 rounded-tr-xl', 'bottom-3 left-3 border-b-2 border-l-2 rounded-bl-xl', 'bottom-3 right-3 border-b-2 border-r-2 rounded-br-xl'].map((c) => (
            <span key={c} aria-hidden="true" className={`absolute h-6 w-6 border-[var(--color-cream)]/60 ${c}`} />
          ))}

          {/* rep counter and "Form good" badge */}
          <div className="absolute top-5 left-5 rounded-full bg-black/60 backdrop-blur px-3 py-1.5 font-display text-sm font-semibold">
            <span className="text-[var(--color-muted)] text-xs mr-1.5">REPS</span>{frame.reps}
          </div>
          <div className="absolute top-5 right-5 rounded-full bg-[#4ade80]/90 text-[var(--color-ink)] px-3 py-1.5 text-xs font-semibold">Form good</div>

          {/* knee-angle graph with the two thresholds (160° and 100°) as dashed lines */}
          <div className="absolute inset-x-5 bottom-5 rounded-xl bg-black/60 backdrop-blur px-3 pt-2 pb-1.5">
            <div className="flex justify-between text-[10px] text-[var(--color-muted)] mb-0.5">
              <span>knee angle</span><span>phase: {frame.phase}</span>
            </div>
            <svg viewBox="0 0 100 44" className="w-full h-10" preserveAspectRatio="none" aria-hidden="true">
              <line x1="0" x2="100" y1={yFor(160)} y2={yFor(160)} stroke="var(--color-sage)" strokeDasharray="2 2" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
              <line x1="0" x2="100" y1={yFor(100)} y2={yFor(100)} stroke="var(--color-amber)" strokeDasharray="2 2" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
              <path d={plot} fill="none" stroke="var(--color-cream)" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
            </svg>
          </div>
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-[var(--color-muted)]">
        This is the real counting logic running on a demo figure. Nothing is recorded.
      </p>
    </div>
  )
}

/* ----------------------------------------------------------- how it works */

// The four steps shown in the "How it works" section.
const STEPS = [
  { n: '1', title: 'Describe your setup', body: 'Pick a goal, the equipment you own, how much space you have and how many days you can train.', icon: 'sliders' },
  { n: '2', title: 'Get this week’s plan', body: 'A varied week is built from twelve exercises that fit your room and your kit.', icon: 'calendar' },
  { n: '3', title: 'Train in front of the camera', body: 'Pose tracking counts your reps and times your holds. A rep done with poor form is not counted.', icon: 'camera' },
  { n: '4', title: 'Finish the week, plan adapts', body: 'Finish most of it with clean form and the next week gets harder. Otherwise it holds. It never cuts.', icon: 'trend' },
]

// Small line icons, chosen by name (drawn as SVG paths).
function Icon({ name, className = 'h-6 w-6' }) {
  const common = { className, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } // shared SVG settings
  const paths = { // the shapes of each icon
    sliders: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>,
    calendar: <><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M8 3v4M16 3v4M4 10h16" /></>,
    camera: <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
    trend: <><path d="M4 18 10 12l4 4 6-8" /><path d="M15 8h5v5" /></>,
    eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
    shield: <><path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z" /><path d="m9 12 2 2 4-4" /></>,
    timer: <><circle cx="12" cy="13" r="7.5" /><path d="M12 9v4l2.5 2M9 3h6" /></>,
    target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.8" fill="currentColor" /></>,
    chart: <><path d="M5 20V10M12 20V4M19 20v-7" /></>,
    voice: <><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></>,
    lock: <><rect x="5" y="11" width="14" height="9" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
    layers: <><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></>,
  }
  return <svg {...common}>{paths[name]}</svg>
}

// "How it works" section: four numbered cards.
function HowItWorks() {
  return (
    <Section id="how" eyebrow="How it works" title="From a few questions to a plan that adjusts itself." className="bg-[var(--color-surface)]/50 border-y border-[var(--color-border)]/50">
      <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {STEPS.map((s) => (
          <li key={s.n} className="relative rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
            <span className="absolute top-5 right-5 font-display text-5xl font-semibold text-[var(--color-surface-raised)]" aria-hidden="true">{s.n}</span>
            <span className="h-11 w-11 rounded-xl bg-[var(--color-surface-raised)] text-[var(--color-amber)] grid place-items-center"><Icon name={s.icon} /></span>
            <h3 className="font-display font-semibold text-lg mt-5">{s.title}</h3>
            <p className="text-sm text-[var(--color-muted)] mt-2 leading-relaxed">{s.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  )
}

/* ---------------------------------------------------------------- features */

// The eight feature cards.
const FEATURES = [
  { icon: 'eye', title: 'Rep counting by pose tracking', body: 'A joint-angle state machine turns 33 body landmarks into rep counts for eleven exercises.' },
  { icon: 'target', title: 'Live form checks', body: 'Knees caving, hips sagging, leaning back: the skeleton turns red and the rep is not counted.' },
  { icon: 'timer', title: 'Holds timed by posture', body: 'Plank and wall sit only add seconds while your body is in the right position.' },
  { icon: 'sliders', title: 'Calibrates to your body', body: 'A two-second check of your start position tunes the counter so your own range of motion counts.' },
  { icon: 'layers', title: 'Sets, rests and nudges', body: 'Proper set structure with rest timers. If form slips, the next set is trimmed so you stay clean.' },
  { icon: 'trend', title: 'Adaptation with a form gate', body: 'Volume rises only when you finish the work and the camera saw clean form. Never reduced.' },
  { icon: 'chart', title: 'Progress you can see', body: 'Weekly completion, volume per exercise and a plain-language reason for every plan change.' },
  { icon: 'voice', title: 'Voice cues', body: 'Hear rep counts and form corrections so you can keep your eyes off the screen.' },
]

// "What is inside" section: a grid of the feature cards.
function Features() {
  return (
    <Section id="features" eyebrow="What is inside" title="More than a rep counter." intro="Everything below runs in the page you are looking at. No download, no account.">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-[var(--color-border)] rounded-2xl overflow-hidden border border-[var(--color-border)]">
        {FEATURES.map((f) => (
          <div key={f.title} className="bg-[var(--color-ink)] p-6 hover:bg-[var(--color-surface)] transition-colors">
            <span className="text-[var(--color-amber)]"><Icon name={f.icon} /></span>
            <h3 className="font-display font-semibold mt-4">{f.title}</h3>
            <p className="text-sm text-[var(--color-muted)] mt-2 leading-relaxed">{f.body}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}

/* ----------------------------------------------------------------- gallery */

// Label under each exercise: manual tick, camera timed, or camera counted.
function badgeFor(ex) {
  if (ex.manual) return { text: 'You check it off', cls: 'text-[var(--color-muted)] border-[var(--color-border)]' } // world's greatest stretch
  if (ex.kind === 'hold') return { text: 'Camera timed', cls: 'text-[var(--color-sage)] border-[var(--color-sage)]/40' } // plank, wall sit
  return { text: 'Camera counted', cls: 'text-[var(--color-amber)] border-[var(--color-amber)]/40' } // everything else
}

// Exercise library section: one card per exercise with its animated figure.
function Gallery() {
  return (
    <Section id="exercises" eyebrow="The exercise library" title="Twelve exercises. Eleven are watched by the camera." className="bg-[var(--color-surface)]/50 border-y border-[var(--color-border)]/50"
      intro="Bodyweight, band and dumbbell moves. The plan only picks the ones that suit your equipment, space and goal.">
      <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {EXERCISES.map((ex) => {
          const b = badgeFor(ex) // this exercise's label
          return (
            <li key={ex.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-ink)] overflow-hidden">
              <div className="bg-gradient-to-b from-[var(--color-surface-raised)] to-[var(--color-surface)] px-3 pt-4">
                <ExerciseFigure id={ex.id} className="w-full h-32 sm:h-36" />
              </div>
              <div className="p-4">
                <h3 className="font-display font-semibold text-sm leading-snug">{ex.name}</h3>
                <p className={`inline-block mt-2.5 text-[11px] border rounded-full px-2.5 py-0.5 ${b.cls}`}>{b.text}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </Section>
  )
}

/* -------------------------------------------------------------- adaptation */

// "The adaptive part" section: the three weekly outcomes and an example chart.
function Adaptation() {
  const weeks = [10, 10, 11, 12, 12, 13, 14, 14] // illustrative squat volume for 8 weeks (an example, not real data)
  const held = new Set([1, 4, 7]) // weeks (counting from 0) where volume was held
  const max = 16 // top of the chart scale
  return (
    <Section id="adapt" eyebrow="The adaptive part" title="Progress that has to be earned, and is never taken away."
      intro="At the end of each week the plan looks at what you finished and how cleanly the camera saw it. Each exercise then goes one of three ways.">
      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-6 items-stretch">
        {/* left: the three rules */}
        <div className="grid gap-3">
          <Rule tone="amber" head="Progress" rule="Finished 80% or more, and form was clean 75% of the time" result="About 10% more, at least one extra rep, second or set" />
          <Rule tone="sage" head="Hold: low completion" rule="Finished less than 80%" result="Same volume next week. Consolidate first" />
          <Rule tone="sage" head="Hold: form first" rule="Finished enough, but form was clean under 75%" result="Same volume. Fix technique before adding more" />
          <p className="text-xs text-[var(--color-muted)] leading-relaxed px-1">
            Safety caps apply: at most 5 sets, twice your starting reps and 90 second holds.
          </p>
        </div>
        {/* right: example bar chart (amber = progressed, green = held) */}
        <figure className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <figcaption className="text-sm font-medium">Example: squat volume over eight weeks</figcaption>
          <svg viewBox="0 0 240 130" className="w-full mt-4" role="img" aria-label="Bar chart: volume rises in most weeks and stays flat in weeks 2, 5 and 8">
            {weeks.map((v, i) => {
              const h = (v / max) * 100 // bar height
              const isHeld = held.has(i) // held week?
              return (
                <g key={i}>
                  <rect x={10 + i * 28} y={110 - h} width="20" height={h} rx="4" fill={isHeld ? 'var(--color-sage)' : 'var(--color-amber)'} opacity={isHeld ? 0.75 : 1} />
                  <text x={20 + i * 28} y="124" textAnchor="middle" fontSize="8" fill="var(--color-muted)">W{i + 1}</text>
                </g>
              )
            })}
          </svg>
          <p className="text-xs text-[var(--color-muted)] mt-3 flex gap-4">
            <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[var(--color-amber)]" /> progressed</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[var(--color-sage)]" /> held</span>
          </p>
        </figure>
      </div>
    </Section>
  )
}

// One rule card: "If ... Then ...".
function Rule({ tone, head, rule, result }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 flex gap-4">
      <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${tone === 'amber' ? 'bg-[var(--color-amber)]' : 'bg-[var(--color-sage)]'}`} />
      <div>
        <p className="font-display font-semibold">{head}</p>
        <p className="text-sm text-[var(--color-muted)] mt-1">If: {rule}</p>
        <p className="text-sm mt-1">Then: {result}</p>
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------- privacy */

// "Privacy by design" section: what is kept and what is thrown away.
function Privacy() {
  const nodes = [ // the four stages of the data flow
    { label: 'Your camera', sub: 'live frames', kept: false },
    { label: 'Pose model', sub: 'runs in this tab', kept: false },
    { label: 'Counts and scores', sub: 'numbers only', kept: true },
    { label: 'This browser', sub: 'local storage', kept: true },
  ]
  return (
    <Section id="privacy" eyebrow="Privacy by design" title="Your camera feed never leaves your device.">
      <div className="grid lg:grid-cols-[1fr_1.1fr] gap-10 items-center">
        {/* left: four privacy statements with ticks */}
        <ul className="space-y-4 text-[var(--color-muted)] leading-relaxed">
          {['The pose model runs inside the page. Frames are analysed and thrown away.', 'No video, image or landmark is saved. Only rep counts, hold times and form scores are stored.', 'There is no account, no server and no tracking. Clearing the site data erases everything.', 'You can export your own data as a file whenever you like.'].map((t) => (
            <li key={t} className="flex gap-3"><span className="mt-1 shrink-0"><Tick /></span>{t}</li>
          ))}
        </ul>
        {/* right: four boxes, dashed = discarded, green = kept */}
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <ol className="grid grid-cols-2 gap-3">
            {nodes.map((n, i) => (
              <li key={n.label} className={`rounded-xl border p-4 ${n.kept ? 'border-[var(--color-sage)]/50 bg-[var(--color-sage)]/10' : 'border-dashed border-[var(--color-border)]'}`}>
                <p className="text-[11px] text-[var(--color-muted)]">{i + 1}. {n.kept ? 'Kept' : 'Discarded'}</p>
                <p className="font-display font-semibold mt-1 text-sm">{n.label}</p>
                <p className="text-xs text-[var(--color-muted)] mt-0.5">{n.sub}</p>
              </li>
            ))}
          </ol>
          <p className="text-xs text-[var(--color-muted)] mt-4 flex items-center gap-2"><Icon name="lock" className="h-4 w-4" /> The only thing downloaded is the pose model itself, once.</p>
        </div>
      </div>
    </Section>
  )
}

/* ---------------------------------------------------------- cta and footer */

// Final "Ready for your first week?" box with a big Start button.
function FinalCta({ onStart }) {
  return (
    <section className="px-6 pb-24">
      <div className="max-w-5xl mx-auto relative overflow-hidden rounded-[2rem] border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-surface-raised)] to-[var(--color-surface)] px-8 py-14 sm:px-14 text-center">
        <div aria-hidden="true" className="absolute -top-20 left-1/2 -translate-x-1/2 h-60 w-96 rounded-full bg-[var(--color-amber)] opacity-[0.12] blur-3xl" />
        <h2 className="relative font-display text-3xl sm:text-4xl font-semibold tracking-tight">Ready for your first week?</h2>
        <p className="relative mt-4 text-[var(--color-muted)] max-w-md mx-auto">Four questions, then your plan. You will need a webcam or phone camera for the counted exercises.</p>
        <div className="relative mt-8"><StartButton onStart={onStart} big /></div>
      </div>
    </section>
  )
}

// Footer: safety disclaimer and project credit.
function Footer() {
  return (
    <footer className="px-6 pb-12 text-center text-xs text-[var(--color-muted)] leading-relaxed">
      <p className="max-w-xl mx-auto">
        This app gives general exercise guidance and is not medical advice. Stop if you feel pain, dizziness or
        discomfort, and talk to a doctor before starting if you have a health condition. Best in Chrome or Edge,
        with an internet connection the first time the camera is used.
      </p>
      <p className="mt-3">Built as a BSc final year project: Adaptive Home Workout Planning with Camera-Based Exercise Verification.</p>
    </footer>
  )
}
