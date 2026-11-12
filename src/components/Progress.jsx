// Progress: the Progress tab. Shows summary tiles, a completion chart, a volume chart,
// the reasons for each plan change, and the "Download my data" button.
import { useMemo, useState } from 'react' // React tools: cache calculations, remember values
import { exerciseById } from '../data/exercises' // exercise catalogue lookup
import { storage } from '../lib/storage' // saved logs and sessions
import { diffPlans } from '../lib/planGenerator' // before/after comparison of two weekly plans
import { exercisesInPlans, sessionStats, volumeSeries, weeklyCompletion } from '../lib/progress' // chart and tile calculations

// Plain-English reason shown for each weekly decision.
const ACTION_TEXT = {
  progress: 'Went up: completed and clean',
  hold_form: 'Held: form needs work',
  hold_completion: 'Held: under 80% completed',
  at_cap: 'At the safety cap',
}

export default function Progress({ plans }) {
  // Read straight from storage on each render: it is a small local read, and
  // the Progress screen is only mounted after any new data has been saved.
  const logs = storage.getLogs() // weekly completion logs
  const sessions = storage.getSessions() // camera session summaries
  const stats = sessionStats(sessions) // numbers for the tiles
  const completion = weeklyCompletion(logs) // points for the completion chart
  const ids = useMemo(() => exercisesInPlans(plans), [plans]) // every exercise that has appeared in a plan
  const [picked, setPicked] = useState(null) // exercise chosen for the volume chart
  const exerciseId = picked && ids.includes(picked) ? picked : ids[0] // default to the first exercise
  const series = useMemo(() => (exerciseId ? volumeSeries(plans, exerciseId) : []), [plans, exerciseId]) // points for the volume chart

  // Before/after rows for the last four week-to-week changes (newest first).
  const changes = useMemo(() => {
    const out = []
    for (let i = plans.length - 1; i > 0 && out.length < 4; i--) { // walk back from the newest week
      const rows = diffPlans(plans[i - 1], plans[i], (id) => exerciseById(id)?.name ?? id) // compare a week with the one before
      out.push({ from: plans[i - 1].weekNumber, to: plans[i].weekNumber, rows })
    }
    return out
  }, [plans])

  // "Download my data": saves all stored data as a JSON file on the user's computer.
  function download() {
    const blob = new Blob([JSON.stringify(storage.exportAll(), null, 2)], { type: 'application/json' }) // the data as a file in memory
    const url = URL.createObjectURL(blob) // a temporary link to that file
    const a = document.createElement('a') // an invisible link element
    a.href = url
    a.download = `workout-data-${new Date().toISOString().slice(0, 10)}.json` // file name with today's date
    document.body.appendChild(a)
    a.click() // start the download
    a.remove() // tidy up the link
    setTimeout(() => URL.revokeObjectURL(url), 1000) // free the temporary link after a second
  }

  const empty = logs.length === 0 && sessions.length === 0 // nothing recorded yet

  return (
    <div className="max-w-md mx-auto px-6 pt-6 pb-16">
      <h1 className="font-display text-2xl font-semibold">Progress</h1>
      <p className="text-sm text-[var(--color-muted)] mt-1">Everything here is calculated on this device.</p>

      {/* four summary tiles */}
      <dl className="grid grid-cols-2 gap-3 mt-6">
        <Tile label="Weeks finished" value={logs.length} />
        <Tile label="Camera sessions" value={stats.sessions} />
        <Tile label="Reps counted" value={stats.counted} hint={stats.holdSeconds ? `+ ${stats.holdSeconds}s held` : undefined} />
        <Tile label="Clean form" value={stats.cleanRate == null ? '-' : `${Math.round(stats.cleanRate * 100)}%`} />
      </dl>
      {/* how closely the counter matched the counts the user typed in (only if they did) */}
      {stats.agreement != null && (
        <p className="text-xs text-[var(--color-muted)] mt-3 leading-relaxed">
          Counter agreement with your own counts: <span className="text-[var(--color-cream)] font-medium">{Math.round(stats.agreement * 100)}%</span> over {stats.checkedSessions} session{stats.checkedSessions === 1 ? '' : 's'}.
        </p>
      )}

      {/* chart 1: completion rate for each finished week */}
      <Card title="Completion by week" note="Share of planned exercises you finished.">
        {completion.length === 0 ? (
          <Empty text="Finish your first week to see this chart." />
        ) : (
          <BarChart data={completion.map((c) => ({ x: `W${c.week}`, y: c.rate }))} />
        )}
      </Card>

      {/* chart 2: prescribed volume of one chosen exercise over the weeks */}
      <Card title="Volume over the weeks" note="Prescribed sets × reps (or seconds) per session.">
        {/* exercise picker buttons */}
        {ids.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 mb-3">
            {ids.map((id) => (
              <button
                key={id}
                onClick={() => setPicked(id)} // show this exercise in the chart
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs border ${id === exerciseId ? 'bg-[var(--color-amber)] border-[var(--color-amber)] text-[var(--color-ink)] font-medium' : 'border-[var(--color-border)] text-[var(--color-muted)]'}`}
              >
                {exerciseById(id)?.name ?? id}
              </button>
            ))}
          </div>
        )}
        {series.length < 2 ? <Empty text="Needs at least two weeks of plans." /> : <LineChart data={series} />}
      </Card>

      {/* list explaining why each exercise changed or held, week by week */}
      <Card title="Why did my plan change?" note="The reason for each exercise, week by week.">
        {changes.length === 0 ? (
          <Empty text="Your first adaptation will be explained here." />
        ) : (
          <div className="space-y-5">
            {changes.map((c) => (
              <div key={c.to}>
                <p className="text-xs font-medium text-[var(--color-sage)] mb-2">Week {c.from} to week {c.to}</p>
                <ul className="space-y-2">
                  {c.rows.map((r) => (
                    <li key={r.exerciseId} className="text-sm flex justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block">{r.name}</span>
                        <span className="block text-xs text-[var(--color-muted)]">{ACTION_TEXT[r.action]}</span>
                      </span>
                      {/* "3 × 12 → 4 × 13" if it changed, otherwise just the prescription */}
                      <span className="shrink-0 text-right tabular-nums text-xs">
                        {r.changed ? (<><span className="text-[var(--color-muted)]">{r.from}</span> {'→'} <span className="text-[var(--color-amber)] font-medium">{r.to}</span></>) : <span className="text-[var(--color-muted)]">{r.to}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Download my data button */}
      <div className="mt-8 flex flex-col gap-3">
        <button onClick={download} className="w-full px-6 py-3 rounded-full border border-[var(--color-border)] text-sm hover:bg-[var(--color-surface)]">
          Download my data (JSON)
        </button>
        {empty && <p className="text-xs text-[var(--color-muted)] text-center">Nothing to show yet. Train, then come back.</p>}
      </div>
    </div>
  )
}

// One summary tile: big value, label underneath, optional small hint.
function Tile({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3.5">
      <dd className="font-display text-2xl font-semibold">{value}</dd>
      <dt className="text-xs text-[var(--color-muted)] mt-0.5">{label}</dt>
      {hint && <p className="text-[11px] text-[var(--color-sage)] mt-0.5">{hint}</p>}
    </div>
  )
}

// A titled box that holds one chart or list.
function Card({ title, note, children }) {
  return (
    <section className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <h2 className="font-display font-semibold">{title}</h2>
      <p className="text-xs text-[var(--color-muted)] mt-0.5 mb-4">{note}</p>
      {children}
    </section>
  )
}

// Placeholder message when there is no data yet.
function Empty({ text }) {
  return <p className="text-sm text-[var(--color-muted)] py-4">{text}</p>
}

// Bar chart of weekly completion, drawn by hand as SVG (no chart library).
function BarChart({ data }) {
  const W = 300 // drawing width
  const H = 130 // drawing height of the bars area
  const bw = Math.min(28, (W - 20) / data.length - 8) // bar width, narrower when there are many weeks
  return (
    <svg viewBox={`0 -12 ${W} ${H + 34}`} className="w-full" role="img" aria-label="Weekly completion rate">
      {/* dashed guide lines at 0%, 50% and 100% */}
      {[0, 0.5, 1].map((g) => (
        <g key={g}>
          <line x1="0" x2={W} y1={H - g * H} y2={H - g * H} stroke="var(--color-border)" strokeDasharray="3 3" strokeWidth="0.8" />
          <text x="0" y={H - g * H - 3} fontSize="8" fill="var(--color-muted)">{g * 100}%</text>
        </g>
      ))}
      {/* one bar per week: amber if 80% or more was completed, green otherwise */}
      {data.map((d, i) => {
        const x = 30 + i * ((W - 40) / data.length) + 4 // left edge of this bar
        const h = Math.max(2, d.y * H) // bar height (at least 2 so 0% is still visible)
        return (
          <g key={d.x}>
            <rect x={x} y={H - h} width={bw} height={h} rx="4" fill={d.y >= 0.8 ? 'var(--color-amber)' : 'var(--color-sage)'} />
            <text x={x + bw / 2} y={H - h - 4} textAnchor="middle" fontSize="8" fill="var(--color-cream)">{Math.round(d.y * 100)}</text>
            <text x={x + bw / 2} y={H + 14} textAnchor="middle" fontSize="8" fill="var(--color-muted)">{d.x}</text>
          </g>
        )
      })}
    </svg>
  )
}

// Line chart of prescribed volume per week, drawn by hand as SVG.
function LineChart({ data }) {
  const W = 300 // drawing width
  const H = 120 // drawing height
  const max = Math.max(...data.map((d) => d.value)) // highest value
  const min = Math.min(...data.map((d) => d.value)) // lowest value
  const span = Math.max(1, max - min) // range of values (at least 1, to avoid dividing by zero)
  const px = (i) => 16 + (i / (data.length - 1)) * (W - 32) // x position of point i
  const py = (v) => 14 + (1 - (v - min) / span) * (H - 36) // y position of value v (higher value = higher on screen)
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${px(i)} ${py(d.value)}`).join(' ') // SVG line through all points
  return (
    <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full" role="img" aria-label="Prescribed volume per week">
      <path d={path} fill="none" stroke="var(--color-amber)" strokeWidth="2" strokeLinejoin="round" />
      {/* a dot per week, with labels (every other label when there are many weeks) */}
      {data.map((d, i) => (
        <g key={d.week}>
          <circle cx={px(i)} cy={py(d.value)} r="3.5" fill="var(--color-amber)" />
          {(data.length <= 8 || i % 2 === 0 || i === data.length - 1) && (
            <>
              <text x={px(i)} y={py(d.value) - 8} textAnchor="middle" fontSize="8" fill="var(--color-cream)">{d.label}</text>
              <text x={px(i)} y={H + 12} textAnchor="middle" fontSize="8" fill="var(--color-muted)">W{d.week}</text>
            </>
          )}
        </g>
      ))}
    </svg>
  )
}
