// All app data lives in the browser's localStorage. There is no backend.
// Camera frames never touch storage; only counts, form scores and
// settings do (see lib/pose/ for the camera pipeline itself).

// The names under which each kind of data is saved in localStorage.
const KEYS = {
  profile: 'workout.profile', // onboarding answers: goal, equipment, space, days
  plans: 'workout.plans', // array of plan objects, last = current week
  logs: 'workout.logs', // weekly completion logs
  completion: 'workout.completion', // { weekNumber, items } for the week in progress
  sessions: 'workout.sessions', // one small summary per camera session
  calibration: 'workout.calibration', // last measured start position per exercise
  prefs: 'workout.prefs', // { voice }
}

const MAX_SESSIONS = 400 // keep at most the 400 most recent session summaries

// Reads one item and turns the saved text back into data.
function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key) // saved text, or null if nothing saved yet
    return raw ? JSON.parse(raw) : fallback // convert text to data, or use the default
  } catch {
    return fallback // storage blocked or data damaged: use the default instead of crashing
  }
}

// Saves one item as text. Returns true if it worked.
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value)) // convert data to text and save it
    return true
  } catch {
    return false // storage full or blocked
  }
}

// The only object the rest of the app uses to load and save data.
export const storage = {
  getProfile: () => read(KEYS.profile, null), // load onboarding answers (null if not onboarded)
  saveProfile: (profile) => write(KEYS.profile, profile), // save onboarding answers

  getPlans: () => read(KEYS.plans, []), // load all weekly plans
  savePlans: (plans) => write(KEYS.plans, plans), // save all weekly plans

  getLogs: () => read(KEYS.logs, []), // load all weekly completion logs
  saveLogs: (logs) => write(KEYS.logs, logs), // save all weekly completion logs

  getLogForWeek: (weekNumber) => // load the log of one particular week
    read(KEYS.logs, []).find((l) => l.weekNumber === weekNumber) ?? null,

  saveLogForWeek: (weekNumber, entries) => { // save (or replace) the log of one week
    const logs = read(KEYS.logs, []) // existing logs
    const idx = logs.findIndex((l) => l.weekNumber === weekNumber) // is this week already saved?
    const next = { weekNumber, entries } // the new log for this week
    if (idx >= 0) logs[idx] = next // replace the old one
    else logs.push(next) // or add it
    return write(KEYS.logs, logs) // save the updated list
  },

  // Progress through the current week survives a page refresh.
  getCompletion: (weekNumber) => {
    const saved = read(KEYS.completion, null) // ticks saved for the week in progress
    return saved && saved.weekNumber === weekNumber ? saved.items : {} // only use them if they belong to this week
  },
  saveCompletion: (weekNumber, items) => write(KEYS.completion, { weekNumber, items }), // save this week's ticks

  getSessions: () => read(KEYS.sessions, []), // load all camera session summaries
  addSession: (session) => { // add one session summary
    const all = read(KEYS.sessions, []) // existing summaries
    all.push(session) // add the new one at the end
    return write(KEYS.sessions, all.slice(-MAX_SESSIONS)) // keep only the newest 400
  },

  getCalibration: (exerciseId) => read(KEYS.calibration, {})[exerciseId] ?? null, // last calibration of one exercise
  saveCalibration: (exerciseId, value) => { // remember a calibration for next time
    const all = read(KEYS.calibration, {}) // all saved calibrations
    all[exerciseId] = value // set this exercise's value
    return write(KEYS.calibration, all)
  },

  getPrefs: () => ({ voice: true, ...read(KEYS.prefs, {}) }), // settings, with voice on by default
  savePrefs: (prefs) => write(KEYS.prefs, prefs), // save settings

  exportAll: () => ({ // everything in one object for the "Download my data" button
    exportedAt: new Date().toISOString(), // when the export was made
    profile: read(KEYS.profile, null),
    plans: read(KEYS.plans, []),
    logs: read(KEYS.logs, []),
    sessions: read(KEYS.sessions, []),
    calibration: read(KEYS.calibration, {}),
  }),

  reset: () => { // "Start over": delete all saved data (settings are kept)
    for (const k of [KEYS.profile, KEYS.plans, KEYS.logs, KEYS.completion, KEYS.sessions, KEYS.calibration]) {
      try {
        localStorage.removeItem(k) // remove one item
      } catch {
        /* ignore */
      }
    }
  },
}
