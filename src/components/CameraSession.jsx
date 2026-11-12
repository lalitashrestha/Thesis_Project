/* oxlint-disable react/refs -- session state is a mutable ref on purpose: the pose loop runs ~30x/s and must not close over stale React state; the component forces a re-render each frame. */
// CameraSession: the webcam screen for one exercise. It shows the camera with the
// skeleton drawn on top, counts reps (or times holds), flags form faults, runs the
// rest timer between sets, and at the end shows a summary and saves the counts.
import { useEffect, useReducer, useRef, useState } from 'react' // React tools
import { startPoseLoop, POSE_CONNECTIONS } from '../lib/pose/poseEngine' // runs MediaPipe on every video frame
import { drawSkeleton } from '../lib/pose/drawSkeleton' // draws the body points and bones
import { createDetectorFor } from '../lib/pose/detectorRegistry' // the counter / timer for this exercise
import { isBodyFramed } from '../lib/pose/landmarks' // is the whole body in view?
import { CALIBRATION_MS, calibrateRest } from '../lib/pose/calibration' // start-position calibration
import { buildTargets, cleanRateFor, nudgeNextTarget } from '../lib/pose/session' // set targets, clean-form rate, in-session nudge
import { storage } from '../lib/storage' // saving preferences and calibration
import { speak, stopSpeaking } from '../lib/voice' // spoken cues

const COLOR_CALIBRATING = '#facc15' // yellow skeleton: body not fully in frame yet
const COLOR_GOOD_FORM = '#4ade80' // green skeleton: good form
const COLOR_BAD_FORM = '#ef4444' // red skeleton: a form fault is detected

// One exercise, from "how to" to summary:
//   howto -> calibrate (rep exercises) -> active -> rest -> active ... -> summary
// All camera data (frames, landmarks) is processed in this component and
// discarded. Only counts and scores leave it, through onFinish.
export default function CameraSession({ exercise, entry, onFinish, onCancel }) {
  const kind = exercise.kind === 'hold' ? 'hold' : 'reps' // timed hold or repetition exercise
  const unit = kind === 'hold' ? 's' : '' // "s" after numbers for holds
  const videoRef = useRef(null) // the <video> element showing the webcam
  const canvasRef = useRef(null) // the <canvas> the skeleton is drawn on
  const stopLoopRef = useRef(null) // function that stops the pose loop
  const streamRef = useRef(null) // the webcam stream (to switch the camera off later)
  const frameRef = useRef(null) // always points to the latest onFrame function
  const apiRef = useRef(null) // always points to the latest startSet function (used by the rest timer)
  const wakeRef = useRef(null) // keeps the screen from going to sleep during the session
  const [det] = useState(() => createDetectorFor(exercise.id)) // this exercise's detector, created once
  const [, force] = useReducer((n) => n + 1, 0) // calling force() redraws the screen
  const [status, setStatus] = useState('starting') // starting | running | error
  const [errorMessage, setErrorMessage] = useState('') // text shown if the camera or model fails
  const [voice, setVoice] = useState(() => storage.getPrefs().voice) // spoken cues on or off
  const [selfCount, setSelfCount] = useState('') // the count the user types in on the summary screen
  const voiceRef = useRef(voice) // voice setting readable from inside the pose loop
  const rejectedTimer = useRef(null) // timer that hides the "rep not counted" message

  const originalTarget = kind === 'hold' ? entry.holdSeconds ?? 30 : entry.reps ?? 10 // this week's target per set
  const S = useRef(null) // all the session's changing values, kept in one object
  if (S.current === null) { // create that object only once
    S.current = {
      stage: 'howto', // current step: howto, calibrate, active, rest or summary
      targets: buildTargets(entry, kind), // target for each set, e.g. [12, 12, 12]
      setNo: 0, // which set is in progress (0 = first)
      repsInSet: 0, // clean reps counted in this set
      rejectedInSet: 0, // reps rejected for form in this set
      heldMs: 0, // time held in position in this set (holds)
      elapsedMs: 0, // total time since the hold first started (holds)
      holdStarted: false, // has the user got into position yet?
      results: [], // one result object per finished set
      totalRejected: 0, // rejected reps in the whole session
      wasLow: false, // currently at the bottom of a rep?
      faultDuringRep: false, // was a form fault seen at the bottom of this rep?
      phase: 'high', // counter phase shown on screen
      metric: null, // current angle / distance shown on screen
      personVisible: false, // is anybody detected?
      framed: false, // is the whole body in frame?
      fault: null, // current form-fault message
      rejectedFlash: false, // show "That rep wasn't counted" for a moment
      nudge: null, // message when the next set's target is trimmed
      restLeft: 0, // seconds left on the rest timer
      calStart: null, // when calibration readings started
      calSamples: [], // calibration readings collected
      calProgress: 0, // calibration progress 0 to 1 (for the little bar)
      calibration: null, // calibration result
      calHint: null, // calibration hint, e.g. "Hold still"
    }
  }
  const s = S.current // short name used below

  // --- actions ---------------------------------------------------------
  // Speaks a cue only if voice is switched on.
  function say(text, key) {
    if (voiceRef.current) speak(text, key)
  }

  // Starts a new set: clears the counter and the per-set values.
  function startSet() {
    det?.reset() // reset the detector's rep count / timer
    Object.assign(s, {
      stage: 'active', // counting is now running
      repsInSet: 0,
      rejectedInSet: 0,
      heldMs: 0,
      elapsedMs: 0,
      holdStarted: false,
      wasLow: false,
      faultDuringRep: false,
      nudge: s.nudge, // keep showing the trim message, if any
    })
    say(`Set ${s.setNo + 1}. Go.`, 'set') // e.g. "Set 2. Go."
    force() // redraw
  }

  // Ends the current set: records its result, then goes to rest or to the summary.
  function finishSet() {
    if (s.stage !== 'active') return // only an active set can be finished
    const target = s.targets[s.setNo] // this set's target
    const counted = kind === 'hold' ? Math.round(s.heldMs / 1000) : s.repsInSet // seconds held, or clean reps
    const clean = // clean-form rate of this set
      kind === 'hold'
        ? s.elapsedMs > 0
          ? Math.min(1, s.heldMs / s.elapsedMs) // holds: share of time spent in position
          : null
        : cleanRateFor(s.repsInSet, s.rejectedInSet) // reps: counted / (counted + rejected)
    s.results.push({ // save this set's result
      target,
      counted,
      rejected: s.rejectedInSet,
      cleanRate: clean,
      trimmed: target !== originalTarget, // was this set's target reduced?
    })
    if (navigator.vibrate) navigator.vibrate(200) // short vibration on phones
    if (s.setNo + 1 < s.targets.length) { // more sets to go
      const nudge = nudgeNextTarget(originalTarget, target, clean) // trim the next set if form was poor
      s.targets[s.setNo + 1] = nudge.target // set the next set's target
      s.nudge = nudge.trimmed // message explaining the trim, or nothing
        ? `Form slipped on that set, so the next one is trimmed to ${nudge.target}${unit}. Keep it clean.`
        : null
      s.setNo += 1 // move to the next set
      s.stage = 'rest' // show the rest screen
      s.restLeft = exercise.restSeconds ?? 40 // start the rest countdown
      say(nudge.trimmed ? 'Set done. Next set is a little shorter.' : 'Set done. Rest.', 'set')
    } else { // that was the last set
      s.stage = 'summary' // show the summary
      say('Exercise complete. Nice work.', 'set')
    }
    force() // redraw
  }

  // "Finish exercise" button: stop early and go to the summary.
  function finishEarly() {
    // Record the partial set if anything happened in it.
    if (s.stage === 'active' && (s.repsInSet > 0 || s.heldMs > 0)) {
      const counted = kind === 'hold' ? Math.round(s.heldMs / 1000) : s.repsInSet
      s.partial = { target: s.targets[s.setNo], counted, rejected: s.rejectedInSet } // kept separately: it is not a complete set
    }
    s.stage = 'summary'
    force()
  }

  // After the "how to" card: holds start straight away, rep exercises calibrate first.
  function beginAfterHowTo() {
    if (kind === 'hold') {
      startSet() // holds need no calibration
    } else {
      s.stage = 'calibrate' // ask the user to hold the start position
      s.calStart = null
      s.calSamples = []
      force()
    }
  }

  // "Skip calibration": use the last saved calibration, or the default threshold.
  function skipCalibration() {
    const saved = storage.getCalibration(exercise.id) // calibration from a previous session
    if (saved?.restValue != null) {
      det.setRestValue(saved.restValue) // reuse it
      s.calibration = { used: true, restValue: saved.restValue, measured: saved.measured, fromSaved: true }
    } else {
      s.calibration = { used: false, restValue: det.restValue, measured: null, reason: 'skipped' } // keep the default
    }
    startSet()
  }

  // Collects readings while the user holds the start position for two seconds.
  function collectCalibration(lm, now) {
    const m = det.readMetric(lm) // this frame's angle / distance
    if (m == null) return // no reading this frame
    if (s.calStart == null) s.calStart = now // first reading: start the clock
    s.calSamples.push(m) // store the reading
    s.calProgress = Math.min(1, (now - s.calStart) / CALIBRATION_MS) // fill the progress bar
    if (now - s.calStart < CALIBRATION_MS) return // keep collecting until two seconds have passed

    const range = Math.abs(det.restValue - det.peakValue) // size of the full movement
    const spread = Math.max(...s.calSamples) - Math.min(...s.calSamples) // how much the readings varied
    if (spread > 0.3 * range) { // the user moved too much: start again
      s.calStart = null
      s.calSamples = []
      s.calProgress = 0
      s.calHint = 'Hold still in the starting position.'
      return
    }
    const res = calibrateRest(s.calSamples, det.restValue, det.peakValue) // work out the personal start threshold
    if (res.used) {
      det.setRestValue(res.restValue) // apply it to the detector
      storage.saveCalibration(exercise.id, { restValue: res.restValue, measured: res.measured, at: Date.now() }) // remember it for next time
    }
    s.calibration = res
    startSet() // begin the first set
  }

  // Handles one video frame while a set is active. Returns the current form fault, if any.
  function processActive(lm, now) {
    const r = det.update(lm, now) // feed the frame to the detector
    if (!r.ok) return null // no usable reading this frame
    s.metric = r.metric // show the current reading
    const fault = r.formOk === false ? r.formMessage : null // the fault message, if a fault was found

    if (kind === 'hold') { // timed hold
      if (r.holding) s.holdStarted = true // the user has got into position
      if (s.holdStarted) s.elapsedMs += r.dtMs ?? 0 // count total time from then on
      s.heldMs = r.heldMs // time actually held in position
      s.phase = r.holding ? 'holding' : 'paused'
      if (fault) say(fault, 'fault') // speak the fault
      if (s.heldMs >= s.targets[s.setNo] * 1000) finishSet() // target time reached: set done
      return fault
    }

    // repetition exercise
    s.phase = r.phase
    if (r.phase === 'low') { // at the bottom of the movement
      if (!s.wasLow) s.faultDuringRep = false // just arrived at the bottom: forget the previous rep's fault
      s.wasLow = true
      if (r.formOk === false) s.faultDuringRep = true // a fault at the bottom will reject this rep
    } else {
      s.wasLow = false
    }
    if (fault) say(fault, 'fault') // speak the fault

    if (r.repCompleted) { // the counter just finished a full down-and-up cycle
      if (!s.faultDuringRep) { // no fault at the bottom: count it
        s.repsInSet += 1
        say(String(s.repsInSet), 'rep') // speak the number
        if (s.repsInSet >= s.targets[s.setNo]) finishSet() // target reached: set done
      } else { // fault at the bottom: reject it
        s.rejectedInSet += 1
        s.totalRejected += 1
        s.rejectedFlash = true // show "That rep wasn't counted"
        clearTimeout(rejectedTimer.current)
        rejectedTimer.current = setTimeout(() => { // hide the message after 1.8 seconds
          s.rejectedFlash = false
          force()
        }, 1800)
      }
    }
    return fault
  }

  // Called for every video frame by the pose loop.
  function onFrame(landmarks) {
    const hasLm = !!landmarks // was a person detected?
    const isFramed = hasLm && isBodyFramed(landmarks) // is the whole body in view?
    s.personVisible = hasLm
    s.framed = isFramed
    let fault = null
    const now = performance.now() // current time in milliseconds

    if (isFramed && det) { // only count or calibrate when the body is properly in frame
      if (s.stage === 'calibrate') collectCalibration(landmarks, now)
      else if (s.stage === 'active') fault = processActive(landmarks, now)
    } else if (s.stage === 'calibrate') { // body left the frame during calibration: start it again
      s.calStart = null
      s.calSamples = []
      s.calProgress = 0
    }
    s.fault = fault

    // draw the skeleton on top of the video
    const canvas = canvasRef.current
    const video = videoRef.current
    if (canvas && video && video.videoWidth) {
      canvas.width = video.videoWidth // match the canvas to the video size
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!hasLm) ctx.clearRect(0, 0, canvas.width, canvas.height) // nobody: clear the drawing
      else {
        const color = !isFramed ? COLOR_CALIBRATING : fault ? COLOR_BAD_FORM : COLOR_GOOD_FORM // yellow / red / green
        drawSkeleton(ctx, landmarks, POSE_CONNECTIONS, canvas.width, canvas.height, color)
      }
    }
    force() // redraw the screen
  }

  // "Save and back to plan": totals up the session and hands the numbers to App.
  function save() {
    const results = [...s.results] // the finished sets
    if (s.partial) results.push({ ...s.partial, cleanRate: cleanRateFor(s.partial.counted, s.partial.rejected), partial: true }) // add an unfinished set, if any
    const completeSets = s.results.length // only finished sets count as complete
    const counted = results.reduce((n, r) => n + (kind === 'hold' ? 0 : r.counted), 0) // total clean reps
    const heldSeconds = results.reduce((n, r) => n + (kind === 'hold' ? r.counted : 0), 0) // total seconds held
    const rejected = results.reduce((n, r) => n + (r.rejected ?? 0), 0) // total rejected reps
    const rates = results.filter((r) => r.cleanRate != null)
    const cleanRate = rates.length ? rates.reduce((n, r) => n + r.cleanRate, 0) / rates.length : null // average clean-form rate over sets
    const parsed = parseInt(selfCount, 10) // the user's own count, as a number
    onFinish({ // only numbers leave this screen: no video, no landmarks
      exerciseId: exercise.id,
      kind,
      setsPlanned: s.targets.length,
      setsCompleted: completeSets,
      repsCounted: counted,
      repsRejected: rejected,
      heldSeconds,
      cleanRate,
      trimmed: s.results.some((r) => r.trimmed), // was any set trimmed?
      calibration: s.calibration
        ? { used: !!s.calibration.used, restValue: s.calibration.restValue, measured: s.calibration.measured ?? null }
        : null,
      selfCount: Number.isFinite(parsed) && parsed > 0 ? parsed : null, // keep only a valid positive number
    })
  }

  // keep the frame/timer callbacks pointing at the latest closures
  useEffect(() => {
    frameRef.current = onFrame
    apiRef.current = { startSet }
  })
  // keep the voice setting in sync, and stop speaking when voice is switched off
  useEffect(() => {
    voiceRef.current = voice
    if (!voice) stopSpeaking()
  }, [voice])

  // rest countdown
  useEffect(() => {
    if (s.stage !== 'rest') return undefined // only runs during rest
    const id = setInterval(() => { // every second...
      s.restLeft -= 1 // ...take one second off
      if (s.restLeft <= 0) { // rest is over
        clearInterval(id)
        apiRef.current.startSet() // start the next set automatically
      } else force()
    }, 1000)
    return () => clearInterval(id) // stop the timer when leaving the rest stage
  }, [s.stage, s])

  // camera + pose loop
  useEffect(() => {
    let cancelled = false // set to true if the screen closes while starting
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) { // browser cannot use a camera
        setStatus('error')
        setErrorMessage('This browser does not support camera access. Try Chrome or Edge.')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ // ask permission and switch the webcam on
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, // front camera, 720p if possible
          audio: false, // no microphone
        })
        if (cancelled) { // the screen closed meanwhile: switch the camera off again
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        videoRef.current.srcObject = stream // show the webcam in the <video> element
        await videoRef.current.play()
        try {
          wakeRef.current = await navigator.wakeLock?.request('screen') // keep the screen awake (if supported)
        } catch {
          /* optional */
        }

        const stop = await startPoseLoop( // load MediaPipe and start processing frames
          videoRef.current,
          ({ landmarks }) => frameRef.current?.(landmarks), // each frame goes to onFrame
          () => { // the model failed to load
            setStatus('error')
            setErrorMessage(
              'Could not load the pose detection model. It downloads once, so check your internet connection and try again.'
            )
          }
        )
        if (stop) {
          stopLoopRef.current = stop // remember how to stop the loop
          if (!cancelled) setStatus('running')
        }
      } catch (err) { // explain the most common camera problems
        if (cancelled) return
        setStatus('error')
        if (err.name === 'NotAllowedError') { // user or browser blocked the camera
          setErrorMessage(
            'Camera access was blocked. Click the camera icon in the address bar, allow access, and try again.'
          )
        } else if (err.name === 'NotFoundError') { // no webcam
          setErrorMessage('No camera was found on this device.')
        } else if (location.protocol === 'http:' && location.hostname !== 'localhost') { // camera needs a secure page
          setErrorMessage('Camera access needs HTTPS or localhost.')
        } else {
          setErrorMessage('Could not access the camera.')
        }
      }
    }
    start()
    return () => { // clean-up when the screen closes
      cancelled = true
      stopLoopRef.current?.() // stop the pose loop
      streamRef.current?.getTracks().forEach((t) => t.stop()) // switch the camera off
      wakeRef.current?.release?.().catch?.(() => {}) // let the screen sleep again
      clearTimeout(rejectedTimer.current)
      stopSpeaking()
    }
  }, [exercise.id])

  // Stops the pose loop and switches the webcam off.
  function stopCamera() {
    stopLoopRef.current?.()
    streamRef.current?.getTracks().forEach((t) => t.stop())
  }

  // ✕ button: leave without saving.
  function handleCancel() {
    stopCamera()
    onCancel()
  }

  // Save button on the summary screen.
  function handleSave() {
    stopCamera()
    save()
  }

  // Speaker button: switch spoken cues on or off and remember the choice.
  function toggleVoice() {
    const next = !voice
    setVoice(next)
    storage.savePrefs({ ...storage.getPrefs(), voice: next })
  }

  // --- derived display values -----------------------------------------
  const target = s.targets[s.setNo] // this set's target
  const progressValue = kind === 'hold' ? Math.floor(s.heldMs / 1000) : s.repsInSet // seconds held, or reps counted
  const progressPct = Math.min(100, (progressValue / target) * 100) // for the progress bar
  const inCamera = s.stage === 'calibrate' || s.stage === 'active' // the camera view is in use

  // Pick the message to show at the bottom of the camera view (most important first).
  let banner = null
  if (status === 'running' && inCamera) {
    if (s.rejectedFlash) banner = { tone: 'red', text: "That rep wasn't counted. Check your form and try again." }
    else if (!s.personVisible) banner = { tone: 'neutral', text: "Step into the camera's view" }
    else if (!s.framed) banner = { tone: 'yellow', text: 'Fit your whole body in frame. Checking your position…' }
    else if (s.fault) banner = { tone: 'red', text: s.fault }
    else if (s.stage === 'calibrate' && s.calHint) banner = { tone: 'yellow', text: s.calHint }
  }
  const bannerClass = // colour of that message
    banner?.tone === 'red'
      ? 'bg-red-500/90 text-white font-medium'
      : banner?.tone === 'yellow'
        ? 'bg-amber-400/90 text-[var(--color-ink)] font-medium'
        : 'bg-[var(--color-surface)]/90 text-[var(--color-cream)]'

  // Totals shown on the summary screen.
  const totalCounted = s.results.reduce((n, r) => n + r.counted, 0) + (s.partial?.counted ?? 0)
  const totalRejected = s.results.reduce((n, r) => n + r.rejected, 0) + (s.partial?.rejected ?? 0)
  const clean = cleanRateFor(totalCounted, totalRejected)

  return (
    <div className="min-h-full flex flex-col bg-[var(--color-ink)]">
      {/* camera area */}
      <div className="relative flex-1 bg-black min-h-[55vh]">
        {/* the webcam picture and the skeleton drawing on top, both mirrored like a selfie camera */}
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover -scale-x-100" playsInline muted />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full -scale-x-100" />

        {/* "Starting camera…" while the webcam and model load */}
        {status === 'starting' && (
          <div className="absolute inset-0 flex items-center justify-center text-[var(--color-cream)] text-sm px-6 text-center">
            Starting camera…
          </div>
        )}
        {/* error message if the camera or model failed */}
        {status === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center px-8">
            <p className="text-sm text-center text-[var(--color-cream)] max-w-xs leading-relaxed">{errorMessage}</p>
          </div>
        )}

        {/* message pill at the bottom of the camera view */}
        {banner && (
          <div className="absolute inset-x-0 bottom-6 flex justify-center px-6 pointer-events-none">
            <div className={`text-sm px-4 py-2 rounded-full text-center ${bannerClass}`}>{banner.text}</div>
          </div>
        )}

        {/* calibration card with its progress bar */}
        {s.stage === 'calibrate' && status === 'running' && (
          <div className="absolute inset-x-0 top-16 flex justify-center px-6 pointer-events-none">
            <div className="bg-[var(--color-surface)]/90 text-sm px-4 py-2 rounded-2xl text-center max-w-xs">
              <span className="text-[var(--color-amber)] font-medium">Calibrating.</span> Hold the starting
              position for two seconds.
              <div className="h-1 rounded-full bg-[var(--color-surface-raised)] mt-2 overflow-hidden">
                <div className="h-full bg-[var(--color-amber)]" style={{ width: `${s.calProgress * 100}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* "next set trimmed" message, shown at the start of a trimmed set */}
        {s.stage === 'active' && s.nudge && s.repsInSet === 0 && s.heldMs === 0 && (
          <div className="absolute inset-x-0 top-16 flex justify-center px-6 pointer-events-none">
            <div className="bg-[var(--color-sage)]/95 text-[var(--color-ink)] text-sm font-medium px-4 py-2 rounded-2xl text-center max-w-xs">
              {s.nudge}
            </div>
          </div>
        )}

        {/* top row: ✕ (cancel), ? (how to), speaker (voice), and the set / count display */}
        <div className="absolute top-4 left-4 right-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <RoundButton onClick={handleCancel} label="Cancel">{'✕'}</RoundButton>
            {exercise.howTo && (
              <RoundButton onClick={() => { s.prevStage = s.stage; s.stage = 'howto'; force() }} label="How to do this exercise">?</RoundButton>
            )}
            <RoundButton onClick={toggleVoice} label={voice ? 'Turn voice off' : 'Turn voice on'}>
              <SpeakerIcon on={voice} />
            </RoundButton>
          </div>
          <div className="shrink-0 rounded-full px-4 py-1.5 text-center font-display font-semibold bg-[var(--color-surface)]/85 text-[var(--color-cream)]">
            <span className="text-xs opacity-75 mr-2">Set {Math.min(s.setNo + 1, s.targets.length)}/{s.targets.length}</span>
            <span className="text-lg">{progressValue}</span>
            <span className="text-sm opacity-75">/{target}{unit}</span>
          </div>
        </div>

        {/* "how to" card: shown first, and again when the ? button is pressed */}
        {s.stage === 'howto' && exercise.howTo && status !== 'error' && (
          <div className="absolute inset-0 z-10 bg-black/85 flex items-center justify-center px-6">
            <div className="bg-[var(--color-surface)] rounded-2xl p-5 w-full max-w-xs">
              <p className="font-display text-lg font-semibold mb-1">{exercise.name}</p>
              <p className="text-xs text-[var(--color-muted)] mb-3">How to do it correctly:</p>
              <ol className="list-decimal list-inside space-y-2 text-sm leading-snug">
                {exercise.howTo.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
              {exercise.cameraTip && (
                <p className="text-xs text-[var(--color-sage)] mt-4 leading-relaxed">Camera: {exercise.cameraTip}</p>
              )}
              {/* go back to the set if it was opened mid-session, otherwise begin */}
              <button
                onClick={() => {
                  if (s.prevStage) { s.stage = s.prevStage; s.prevStage = null; force() } else beginAfterHowTo()
                }}
                className="w-full mt-5 font-display font-semibold px-4 py-2.5 rounded-full bg-[var(--color-amber)] text-[var(--color-ink)]"
              >
                {s.prevStage ? 'Back to the set' : "Got it, let's go"}
              </button>
            </div>
          </div>
        )}

        {/* rest screen between sets: big countdown, next target, and "Start now" */}
        {s.stage === 'rest' && (
          <div className="absolute inset-0 z-10 bg-black/80 flex flex-col items-center justify-center px-6 text-center">
            <p className="text-sm text-[var(--color-muted)]">Rest</p>
            <p className="font-display text-7xl font-semibold text-[var(--color-amber)] tabular-nums">{s.restLeft}</p>
            <p className="mt-2 text-sm">
              Next: set {s.setNo + 1} of {s.targets.length}, {s.targets[s.setNo]}
              {kind === 'hold' ? ' seconds' : ' reps'}
            </p>
            {s.nudge && <p className="mt-3 text-sm text-[var(--color-sage)] max-w-xs leading-relaxed">{s.nudge}</p>}
            <button
              onClick={() => startSet()} // skip the rest of the rest
              className="mt-6 font-display font-semibold px-6 py-3 rounded-full bg-[var(--color-amber)] text-[var(--color-ink)]"
            >
              Start now
            </button>
          </div>
        )}

        {/* summary screen: totals, the optional self-count box, and the Save button */}
        {s.stage === 'summary' && (
          <div className="absolute inset-0 z-10 bg-black/85 flex items-center justify-center px-6">
            <div className="bg-[var(--color-surface)] rounded-2xl p-5 w-full max-w-xs">
              <p className="font-display text-lg font-semibold">{exercise.name}</p>
              <p className="text-xs text-[var(--color-muted)] mb-4">
                {s.results.length === s.targets.length ? 'All sets complete' : `${s.results.length} of ${s.targets.length} sets complete`}
              </p>
              {/* three totals: counted (or seconds held), not counted, clean form */}
              <dl className="grid grid-cols-3 gap-2 text-center mb-4">
                <Stat label={kind === 'hold' ? 'Seconds held' : 'Reps counted'} value={kind === 'hold' ? s.results.reduce((n, r) => n + r.counted, 0) + (s.partial?.counted ?? 0) : totalCounted} />
                <Stat label={kind === 'hold' ? 'Breaks' : 'Not counted'} value={kind === 'hold' ? '-' : totalRejected} />
                <Stat label="Clean form" value={clean == null ? '-' : `${Math.round(clean * 100)}%`} />
              </dl>
              {/* optional box where the user types how many reps they really did */}
              {kind === 'reps' && (
                <label className="block text-xs text-[var(--color-muted)] mb-4">
                  How many did you actually do? (optional, helps check the counter)
                  <input
                    type="number"
                    inputMode="numeric" // number keyboard on phones
                    min="0"
                    value={selfCount}
                    onChange={(e) => setSelfCount(e.target.value)} // remember what was typed
                    className="mt-1.5 w-full rounded-lg bg-[var(--color-ink)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-cream)]"
                  />
                </label>
              )}
              {/* saving here is what stores the session; leaving any other way discards it */}
              <button
                onClick={handleSave}
                className="w-full font-display font-semibold px-4 py-2.5 rounded-full bg-[var(--color-amber)] text-[var(--color-ink)]"
              >
                Save and back to plan
              </button>
            </div>
          </div>
        )}
      </div>

      {/* area under the camera: exercise name, big count, debug readings, progress bar, bottom button */}
      <div className="px-6 py-5">
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-sm text-[var(--color-muted)]">{exercise.name}</p>
            <p className="font-display text-4xl font-semibold" style={{ color: progressPct >= 100 ? COLOR_GOOD_FORM : undefined }}>
              {progressValue}
              <span className="text-lg text-[var(--color-muted)] font-normal"> / {target}{unit}</span>
            </p>
          </div>
          {/* small readout of the counter phase, the live signal and the calibrated start value */}
          <p className="text-xs text-[var(--color-muted)] text-right leading-relaxed shrink-0">
            {s.stage === 'calibrate' ? 'calibrating' : `phase: ${s.phase}`}
            {s.metric != null && (<><br />signal: {s.metric}</>)}
            {s.calibration?.used && (<><br />start: {s.calibration.restValue}</>)}
          </p>
        </div>
        {/* progress bar for the current set */}
        <div className="h-1.5 rounded-full bg-[var(--color-surface-raised)] overflow-hidden">
          <div className="h-full rounded-full bg-[var(--color-amber)] transition-[width] duration-150" style={{ width: `${progressPct}%` }} />
        </div>

        {/* bottom button: "Skip calibration" while calibrating, otherwise "Finish exercise" */}
        {s.stage === 'calibrate' ? (
          <button onClick={skipCalibration} className="w-full mt-4 text-sm text-[var(--color-muted)] underline underline-offset-2 py-2">
            Skip calibration
          </button>
        ) : (
          <button
            onClick={finishEarly}
            disabled={s.stage === 'summary' || s.stage === 'howto'} // not available before starting or after finishing
            className="w-full mt-4 font-display font-semibold px-6 py-3.5 rounded-full border border-[var(--color-amber)] text-[var(--color-amber)] disabled:opacity-40"
          >
            Finish exercise
          </button>
        )}
      </div>
    </div>
  )
}

// Small round button used in the top row of the camera screen.
function RoundButton({ onClick, label, children }) {
  return (
    <button
      onClick={onClick}
      aria-label={label} // name read out by screen readers
      className="h-9 w-9 shrink-0 rounded-full bg-[var(--color-surface)]/80 flex items-center justify-center text-[var(--color-cream)] font-display font-semibold"
    >
      {children}
    </button>
  )
}

// One number box on the summary screen.
function Stat({ label, value }) {
  return (
    <div className="rounded-xl bg-[var(--color-ink)] py-2.5 px-1">
      <dd className="font-display text-xl font-semibold">{value}</dd>
      <dt className="text-[10px] text-[var(--color-muted)] leading-tight mt-0.5">{label}</dt>
    </div>
  )
}

// Speaker icon: with sound waves when voice is on, with a cross when it is off.
function SpeakerIcon({ on }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H3v6h3l5 4V5z" />
      {on ? <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /> : <path d="m16 9 5 6m0-6-5 6" />}
    </svg>
  )
}
