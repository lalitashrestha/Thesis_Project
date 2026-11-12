// Optional spoken cues (rep numbers, form faults, set changes) through the
// browser's built-in speech synthesis. Nothing is sent anywhere.
const lastSpoken = {} // remembers the last thing said for each kind of cue

// Says a short text out loud. "key" groups cues: 'rep', 'fault', 'set'...
export function speak(text, key = 'default') {
  try {
    const synth = window.speechSynthesis // the browser's text-to-speech engine
    if (!synth) return // browser has no speech support: stay silent
    const now = Date.now() // current time in milliseconds
    const gap = key === 'fault' ? 5000 : 0 // repeat the same form warning at most every 5 seconds
    if (lastSpoken[key] && now - lastSpoken[key].at < gap && lastSpoken[key].text === text) return // same warning said too recently: skip it
    lastSpoken[key] = { at: now, text } // remember what was said and when
    if (key === 'rep') synth.cancel() // a new rep number interrupts the previous one, so counts stay in time
    const u = new SpeechSynthesisUtterance(text) // the sentence to speak
    u.rate = 1.05 // slightly faster than normal speech
    synth.speak(u) // speak it
  } catch {
    /* speech is optional */
  }
}

// Stops anything currently being spoken (used when voice is switched off or the session ends).
export function stopSpeaking() {
  try {
    window.speechSynthesis?.cancel() // stop speech if the browser supports it
  } catch {
    /* ignore */
  }
}
