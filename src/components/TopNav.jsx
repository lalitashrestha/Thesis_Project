// TopNav: the bar at the top of the app with the Home button and the Plan / Progress tabs.
// view = the tab currently shown, onChange = switch tab, onHome = go back to the landing page.
export default function TopNav({ view, onChange, onHome }) {
  const tabs = [ // the two tabs
    { id: 'plan', label: 'Plan' },
    { id: 'progress', label: 'Progress' },
  ]
  return (
    <div className="sticky top-0 z-20 bg-[var(--color-ink)]/90 backdrop-blur border-b border-[var(--color-border)]/60">
      <div className="max-w-md mx-auto px-6 h-14 flex items-center justify-between">
        {/* Home button: the small amber logo plus the word "Home" */}
        <button onClick={onHome} className="flex items-center gap-2 text-sm font-display font-semibold" aria-label="Back to the home page">
          <span className="h-7 w-7 rounded-lg bg-[var(--color-amber)] grid place-items-center" aria-hidden="true">
            {/* stick-figure logo drawn as an SVG */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="5" r="2" fill="var(--color-ink)" />
              <path d="M12 8v6M12 14l-4 6M12 14l4 6M6 10l6-2 6 2" />
            </svg>
          </span>
          <span className="hidden min-[380px]:inline">Home</span>
        </button>
        {/* Plan / Progress tab switcher */}
        <div role="tablist" className="flex rounded-full border border-[var(--color-border)] p-0.5">
          {/* one button per tab; the active tab is highlighted in amber */}
          {tabs.map((t) => (
            <button
              key={t.id} // React needs a unique key for items in a list
              role="tab"
              aria-selected={view === t.id} // tells screen readers which tab is active
              onClick={() => onChange(t.id)} // switch to this tab
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                view === t.id ? 'bg-[var(--color-amber)] text-[var(--color-ink)]' : 'text-[var(--color-muted)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
