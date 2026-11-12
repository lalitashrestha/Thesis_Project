// figures.jsx: the small animated stick figures shown for each exercise.
import { useEffect, useRef } from 'react' // React tools: run code after drawing, and keep a reference to the SVG

// Stylised exercise figures drawn as inline SVG (no image files), animated
// between a start pose and a peak pose. Poses are hand-authored joint
// coordinates in a 120 x 120 box (ground at y = 105). Every limb has the
// same number of points in both poses so they can be interpolated.

const P = (...p) => ({ t: 'p', p }) // a limb drawn as straight lines through these points
const Q = (a, c, b) => ({ t: 'c', p: [a, c, b] }) // a limb drawn as one curve (used for the bending back in cat-cow)
const BAR = (...p) => ({ t: 'p', p, bar: true }) // a dumbbell bar (drawn thick and amber)
const BAND = (...p) => ({ t: 'p', p, band: true }) // a resistance band (drawn dashed and amber)

// For each exercise: period = animation length in ms, a = start pose, b = peak pose,
// extra = floor / wall lines or the band's anchor dot. Each pose = head position + limb points.
export const POSES = {
  squat: {
    period: 3000,
    a: { head: [60, 18], limbs: [P([60, 30], [60, 58]), P([60, 58], [60, 80], [60, 102], [69, 105]), P([60, 32], [60, 47], [60, 62])] },
    b: { head: [62, 43], limbs: [P([58, 55], [44, 78]), P([44, 78], [66, 80], [60, 102], [69, 105]), P([58, 57], [72, 57], [86, 55])] },
  },
  pushup: {
    period: 2600,
    extra: [{ line: [4, 105, 116, 105] }],
    a: { head: [101, 58], limbs: [P([90, 62], [62, 76]), P([62, 76], [38, 87], [14, 98], [10, 104]), P([90, 64], [91, 84], [92, 103])] },
    b: { head: [101, 84], limbs: [P([90, 86], [62, 92]), P([62, 92], [38, 95], [14, 98], [10, 104]), P([90, 88], [74, 95], [92, 103])] },
  },
  lunge: {
    period: 3000,
    a: { head: [60, 18], limbs: [P([60, 30], [60, 58]), P([60, 58], [60, 80], [60, 102], [69, 105]), P([60, 58], [60, 80], [60, 102], [51, 105]), P([60, 32], [60, 47], [60, 62])] },
    b: { head: [58, 36], limbs: [P([58, 48], [58, 76]), P([58, 76], [80, 78], [80, 102], [89, 105]), P([58, 76], [42, 96], [26, 102], [20, 105]), P([58, 50], [58, 64], [58, 78])] },
  },
  glute_bridge: {
    period: 2800,
    extra: [{ line: [4, 105, 116, 105] }],
    a: { head: [12, 98], limbs: [P([22, 100], [50, 100]), P([50, 100], [74, 80], [86, 102], [95, 104]), P([22, 100], [34, 102], [46, 103])] },
    b: { head: [12, 98], limbs: [P([22, 100], [50, 76]), P([50, 76], [76, 72], [86, 102], [95, 104]), P([22, 100], [34, 102], [46, 103])] },
  },
  plank: {
    period: 2600,
    extra: [{ line: [4, 105, 116, 105] }],
    a: { head: [98, 72], limbs: [P([88, 76], [64, 84]), P([64, 84], [40, 92], [14, 100], [10, 104]), P([88, 76], [88, 98], [106, 101])] },
    b: { head: [98, 71], limbs: [P([88, 75], [64, 82]), P([64, 82], [40, 91], [14, 100], [10, 104]), P([88, 75], [88, 98], [106, 101])] },
  },
  wall_sit: {
    period: 2600,
    extra: [{ line: [24, 6, 24, 105], wall: true }, { line: [4, 105, 116, 105] }],
    a: { head: [32, 27], limbs: [P([32, 40], [32, 72]), P([32, 72], [60, 72], [60, 102], [69, 105]), P([32, 42], [40, 58], [54, 70])] },
    b: { head: [32, 28], limbs: [P([32, 41], [32, 73]), P([32, 73], [60, 73], [60, 102], [69, 105]), P([32, 43], [40, 59], [54, 71])] },
  },
  jumping_jack: {
    period: 1500,
    a: { head: [60, 18], limbs: [P([52, 32], [68, 32]), P([60, 32], [60, 58]), P([60, 58], [57, 80], [55, 102], [49, 105]), P([60, 58], [63, 80], [65, 102], [71, 105]), P([52, 33], [50, 47], [48, 62]), P([68, 33], [70, 47], [72, 62])] },
    b: { head: [60, 14], limbs: [P([52, 28], [68, 28]), P([60, 28], [60, 54]), P([60, 54], [48, 78], [37, 100], [31, 104]), P([60, 54], [72, 78], [83, 100], [89, 104]), P([52, 29], [44, 20], [38, 6]), P([68, 29], [76, 20], [82, 6])] },
  },
  mountain_climber: {
    period: 1100,
    extra: [{ line: [4, 105, 116, 105] }],
    a: { head: [102, 56], limbs: [P([92, 62], [66, 76]), P([66, 76], [40, 87], [14, 98], [10, 104]), P([66, 76], [86, 83], [74, 99], [70, 104]), P([92, 64], [92, 84], [92, 103])] },
    b: { head: [102, 56], limbs: [P([92, 62], [66, 76]), P([66, 76], [86, 83], [74, 99], [70, 104]), P([66, 76], [40, 87], [14, 98], [10, 104]), P([92, 64], [92, 84], [92, 103])] },
  },
  standing_row: {
    period: 2400,
    extra: [{ dot: [112, 36] }, { line: [4, 105, 116, 105] }],
    a: { head: [60, 18], limbs: [P([60, 30], [60, 58]), P([60, 58], [60, 80], [60, 102], [69, 105]), P([60, 34], [78, 36], [96, 36]), BAND([96, 36], [112, 36])] },
    b: { head: [60, 18], limbs: [P([60, 30], [60, 58]), P([60, 58], [60, 80], [60, 102], [69, 105]), P([60, 34], [48, 46], [66, 42]), BAND([66, 42], [112, 36])] },
  },
  dumbbell_shoulder_press: {
    period: 2600,
    a: { head: [60, 18], limbs: [P([50, 32], [70, 32]), P([60, 32], [60, 60]), P([60, 60], [56, 82], [54, 102], [48, 105]), P([60, 60], [64, 82], [66, 102], [72, 105]), P([50, 33], [40, 45], [44, 27]), P([70, 33], [80, 45], [76, 27]), BAR([38, 27], [50, 27]), BAR([70, 27], [82, 27])] },
    b: { head: [60, 18], limbs: [P([50, 32], [70, 32]), P([60, 32], [60, 60]), P([60, 60], [56, 82], [54, 102], [48, 105]), P([60, 60], [64, 82], [66, 102], [72, 105]), P([50, 33], [44, 17], [48, 3]), P([70, 33], [76, 17], [72, 3]), BAR([42, 3], [54, 3]), BAR([66, 3], [78, 3])] },
  },
  cat_cow_stretch: {
    period: 3400,
    extra: [{ line: [4, 105, 116, 105] }],
    a: { head: [98, 60], limbs: [Q([84, 72], [64, 90], [44, 72]), P([44, 72], [44, 100], [22, 103]), P([84, 72], [84, 88], [84, 104])] },
    b: { head: [94, 82], limbs: [Q([84, 72], [64, 46], [44, 72]), P([44, 72], [44, 100], [22, 103]), P([84, 72], [84, 88], [84, 104])] },
  },
  world_greatest_stretch: {
    period: 3400,
    extra: [{ line: [4, 105, 116, 105] }],
    a: { head: [58, 36], limbs: [P([58, 48], [58, 76]), P([58, 76], [80, 78], [80, 102], [89, 105]), P([58, 76], [42, 96], [26, 102], [20, 105]), P([58, 50], [70, 66], [78, 100])] },
    b: { head: [58, 36], limbs: [P([58, 48], [58, 76]), P([58, 76], [80, 78], [80, 102], [89, 105]), P([58, 76], [42, 96], [26, 102], [20, 105]), P([58, 50], [64, 34], [66, 16])] },
  },
}

export const lerp = (a, b, t) => a + (b - a) * t // a value part-way between a and b (t = 0 gives a, t = 1 gives b)
const lerpPt = (p, q, t) => [lerp(p[0], q[0], t), lerp(p[1], q[1], t)] // the same for an (x, y) point

// A pose part-way between pose a and pose b (used to animate smoothly).
export function lerpPose(a, b, t) {
  return {
    head: lerpPt(a.head, b.head, t), // head position in between
    limbs: a.limbs.map((l, i) => ({ ...l, p: l.p.map((pt, j) => lerpPt(pt, b.limbs[i].p[j], t)) })), // every limb point in between
  }
}

const f = (n) => Math.round(n * 10) / 10 // round to 1 decimal to keep the SVG text short
// Turns one limb into SVG path text ("M x y L x y ..." for lines, "M ... Q ..." for a curve).
export function limbPath(l) {
  const [a, ...rest] = l.p // first point, then the others
  return l.t === 'c'
    ? `M${f(a[0])} ${f(a[1])} Q${f(rest[0][0])} ${f(rest[0][1])} ${f(rest[1][0])} ${f(rest[1][1])}` // curved limb
    : `M${f(a[0])} ${f(a[1])}` + rest.map((q) => ` L${f(q[0])} ${f(q[1])}`).join('') // straight segments
}

// --- one shared animation clock ------------------------------------------
// All figures on a page share one animation loop instead of each running its own.
const subs = new Set() // functions to call on every animation frame
let raf = 0 // id of the scheduled frame (0 = loop not running)
function loop(now) {
  subs.forEach((fn) => fn(now)) // update every figure
  raf = subs.size ? requestAnimationFrame(loop) : 0 // keep going while any figure is listening
}
// Adds a function to the shared loop; returns a function that removes it again.
export function subscribe(fn) {
  subs.add(fn)
  if (!raf) raf = requestAnimationFrame(loop) // start the loop if it is not running
  return () => subs.delete(fn)
}

// True if the user's computer asks for reduced motion (then figures stay still).
export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// --- the component ----------------------------------------------------------
// Draws one exercise figure. id = exercise id, stroke = line thickness, showJoints = draw joint dots.
export function ExerciseFigure({ id, className = '', stroke = 5.5, showJoints = true }) {
  const pose = POSES[id] // the two poses of this exercise
  const svgRef = useRef(null) // the drawn <svg> element

  // Animate the figure (only while it is visible on screen).
  useEffect(() => {
    const svg = svgRef.current
    if (!svg || !pose || prefersReducedMotion()) return undefined // nothing to animate
    let visible = true
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting }) // track whether the figure is on screen
    io.observe(svg)
    const phase = Math.random() * pose.period // start each figure at a random point so they don't move in sync
    const off = subscribe((now) => {
      if (!visible) return // off screen: skip the work
      const t = 0.5 - 0.5 * Math.cos(((now + phase) / pose.period) * 2 * Math.PI) // smooth back-and-forth between 0 and 1
      apply(svg, lerpPose(pose.a, pose.b, t)) // move the drawing to that in-between pose
    })
    return () => { off(); io.disconnect() } // stop when the figure is removed
  }, [id, pose])

  if (!pose) return null // unknown exercise: draw nothing
  const start = lerpPose(pose.a, pose.b, prefersReducedMotion() ? 0.7 : 0.15) // first pose drawn (a still pose for reduced motion)
  return (
    <svg ref={svgRef} viewBox="0 0 120 110" className={className} role="img" aria-label={`${id.replace(/_/g, ' ')} illustration`}>
      {/* floor / wall lines, and the band's anchor dot */}
      {(pose.extra ?? []).map((e, i) =>
        e.line ? (
          <line key={i} x1={e.line[0]} y1={e.line[1]} x2={e.line[2]} y2={e.line[3]}
            stroke={e.wall ? 'var(--color-border)' : 'var(--color-border)'} strokeWidth={e.wall ? 4 : 1.5} strokeLinecap="round" />
        ) : (
          <circle key={i} cx={e.dot[0]} cy={e.dot[1]} r="3" fill="var(--color-amber)" />
        )
      )}
      {/* the limbs (cream), dumbbell bars (thick amber) and bands (dashed amber) */}
      <g data-limbs fill="none" strokeLinecap="round" strokeLinejoin="round">
        {start.limbs.map((l, i) => (
          <path key={i} d={limbPath(l)} data-i={i}
            stroke={l.bar ? 'var(--color-amber)' : l.band ? 'var(--color-amber)' : 'var(--color-cream)'}
            strokeWidth={l.bar ? stroke + 2 : l.band ? 1.8 : stroke}
            strokeDasharray={l.band ? '3 3' : undefined} />
        ))}
      </g>
      {/* the head */}
      <circle data-head cx={start.head[0]} cy={start.head[1]} r="7.5" fill="var(--color-cream)" />
      {/* small green dots on the joints (not on bars or bands) */}
      {showJoints && (
        <g data-joints fill="var(--color-sage)">
          {start.limbs.flatMap((l, i) =>
            l.band || l.bar ? [] : l.p.map((pt, j) => <circle key={`${i}-${j}`} data-j={`${i}-${j}`} cx={pt[0]} cy={pt[1]} r="2.2" />)
          )}
        </g>
      )}
    </svg>
  )
}

// Moves the already-drawn SVG shapes to a new pose (faster than redrawing through React).
function apply(svg, pose) {
  const head = svg.querySelector('[data-head]') // move the head
  head.setAttribute('cx', pose.head[0])
  head.setAttribute('cy', pose.head[1])
  svg.querySelectorAll('path[data-i]').forEach((el) => { // reshape every limb
    el.setAttribute('d', limbPath(pose.limbs[+el.dataset.i]))
  })
  svg.querySelectorAll('circle[data-j]').forEach((el) => { // move every joint dot
    const [i, j] = el.dataset.j.split('-').map(Number) // which limb and which point
    const pt = pose.limbs[i].p[j]
    el.setAttribute('cx', pt[0])
    el.setAttribute('cy', pt[1])
  })
}
