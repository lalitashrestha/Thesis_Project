// Exercise library.
//
// Each exercise is tagged with the equipment it needs, the space it needs,
// the muscle group(s) it targets, and the goals it's useful for. The plan
// generator (see lib/planGenerator.js) filters this list against a user's
// onboarding profile to build a weekly plan.
//
// Camera support (see lib/pose/detectorRegistry.js):
//  - `kind: 'reps'` (default): a joint-angle or landmark-distance signal
//    drives a two-phase rep counter.
//  - `kind: 'hold'`: an isometric position. The camera times how long the
//    body stays in a correct position.
// Equipment-based moves (band row, dumbbell press) are tracked through the
// user's joints, not the equipment, so they are camera-verified too.
// `cameraTip` is shown on the camera screen because detection accuracy is
// sensitive to camera placement.

// The four goals a user can choose during onboarding.
export const GOALS = ['general_fitness', 'strength', 'mobility', 'weight_loss']

// The four equipment options a user can choose during onboarding.
export const EQUIPMENT = ['none', 'dumbbells', 'resistance_band', 'full_gym']

// The three space options a user can choose during onboarding.
export const SPACE = ['small', 'medium', 'large']

// The catalogue of all 12 exercises. The fields are explained on the first one (squat).
export const EXERCISES = [
  // 1. Bodyweight squat: repetition exercise, counted from the knee angle.
  {
    id: 'squat', // short internal name used everywhere in the code
    name: 'Bodyweight Squat', // name shown to the user
    equipment: ['none', 'dumbbells', 'resistance_band', 'full_gym'], // equipment setups it suits
    space: ['small', 'medium', 'large'], // room sizes it suits
    muscleGroup: 'legs', // used to vary the muscle groups within a day
    goals: ['general_fitness', 'strength', 'weight_loss'], // goals it is included for
    baseSets: 3, // starting number of sets in week 1
    baseReps: 12, // starting repetitions per set (null for timed holds)
    restSeconds: 40, // rest timer between sets
    cameraTip: 'Stand side-on to the camera, far enough back that your hips, knees and ankles are all in frame.', // where to put the camera
    howTo: [ // step-by-step instructions shown before the session
      'Stand with feet shoulder-width apart, toes slightly out.',
      'Bend your knees and push your hips back, like sitting into a chair.',
      'Lower until your thighs are about parallel to the floor, keeping your chest up.',
      'Push through your heels to stand back up to the start.',
    ],
  },
  // 2. Push-up: repetition exercise, counted from the elbow angle.
  {
    id: 'pushup',
    name: 'Push-Up',
    equipment: ['none', 'dumbbells', 'full_gym'],
    space: ['small', 'medium', 'large'],
    muscleGroup: 'chest',
    goals: ['general_fitness', 'strength'],
    baseSets: 3,
    baseReps: 10,
    restSeconds: 45,
    cameraTip: 'Place the camera at floor level, side-on, so your shoulder, elbow and wrist stay visible through the movement.',
    howTo: [
      'Start in a plank with hands under your shoulders, body in a straight line.',
      'Bend your elbows to lower your chest toward the floor.',
      "Keep your core tight so your hips don't sag or lift.",
      'Push back up until your arms are straight.',
    ],
  },
  // 3. Forward lunge: repetition exercise, counted from the front knee angle.
  {
    id: 'lunge',
    name: 'Forward Lunge',
    equipment: ['none', 'dumbbells'],
    space: ['medium', 'large'], // needs room to step forward
    muscleGroup: 'legs',
    goals: ['general_fitness', 'strength', 'weight_loss'],
    baseSets: 3,
    baseReps: 10,
    restSeconds: 40,
    cameraTip: 'Stand side-on to the camera with space in front of and behind you to step into the lunge.',
    howTo: [
      'Stand tall, then step one foot forward.',
      'Bend both knees to lower your back knee toward the floor.',
      'Keep your front knee over your ankle, torso upright.',
      'Push through your front foot to step back to standing.',
    ],
  },
  // 4. Glute bridge: repetition exercise, counted from the shoulder-hip-knee angle.
  {
    id: 'glute_bridge',
    name: 'Glute Bridge',
    equipment: ['none', 'resistance_band'],
    space: ['small', 'medium', 'large'],
    muscleGroup: 'glutes',
    goals: ['general_fitness', 'strength', 'mobility'],
    baseSets: 3,
    baseReps: 15,
    restSeconds: 30,
    cameraTip: 'Lie side-on to the camera so your shoulder, hip and knee are all visible from the side.',
    howTo: [
      'Lie on your back, knees bent, feet flat on the floor.',
      'Squeeze your glutes and lift your hips toward the ceiling.',
      "Keep your knees in line with your hips - don't let them fall inward.",
      'Lower back down with control.',
    ],
  },
  // 5. Plank: timed hold, the camera times how long the body stays straight.
  {
    id: 'plank',
    name: 'Plank Hold',
    kind: 'hold', // timed instead of counted
    equipment: ['none'],
    space: ['small', 'medium', 'large'],
    muscleGroup: 'core',
    goals: ['general_fitness', 'strength', 'mobility'],
    baseSets: 3,
    baseReps: null, // holds have no repetitions
    baseHoldSeconds: 30, // starting hold time per set
    restSeconds: 30,
    cameraTip: 'Place the camera at floor level, side-on, so your head, hips and heels are all in view.',
    howTo: [
      'Rest on your forearms and toes, elbows under your shoulders.',
      'Make a straight line from head to heels.',
      'Brace your core and squeeze your glutes. Keep breathing.',
      'The timer only runs while your body is in a straight line.',
    ],
  },
  // 6. Wall sit: timed hold, the camera times how long the knees stay near a right angle.
  {
    id: 'wall_sit',
    name: 'Wall Sit',
    kind: 'hold', // timed instead of counted
    equipment: ['none'],
    space: ['small', 'medium', 'large'],
    muscleGroup: 'legs',
    goals: ['general_fitness', 'strength', 'weight_loss'],
    baseSets: 3,
    baseReps: null,
    baseHoldSeconds: 25,
    restSeconds: 30,
    cameraTip: 'Stand side-on to the camera with a clear wall behind you, so your shoulder, hip, knee and ankle are visible.',
    howTo: [
      'Lean your back flat against a wall, feet about 60 cm out from it.',
      'Slide down until your knees make a right angle.',
      'Keep your back pressed to the wall and your knees over your ankles.',
      'The timer only runs while your thighs are parallel to the floor.',
    ],
  },
  // 7. Jumping jack: repetition exercise, counted from how wide the feet are.
  {
    id: 'jumping_jack',
    name: 'Jumping Jack',
    equipment: ['none'],
    space: ['medium', 'large'],
    muscleGroup: 'full_body',
    goals: ['general_fitness', 'weight_loss'],
    baseSets: 3,
    baseReps: 20,
    restSeconds: 30,
    cameraTip: 'Stand facing the camera with space either side to jump your feet out.',
    howTo: [
      'Start standing with feet together, arms by your sides.',
      'Jump your feet out wide while raising your arms overhead.',
      'Jump back to the start position, arms back down.',
      'Keep a steady rhythm.',
    ],
  },
  // 8. Mountain climber: repetition exercise, counted from knee-to-hip distance.
  {
    id: 'mountain_climber',
    name: 'Mountain Climber',
    equipment: ['none'],
    space: ['small', 'medium', 'large'],
    muscleGroup: 'core',
    goals: ['general_fitness', 'weight_loss'],
    baseSets: 3,
    baseReps: 20,
    restSeconds: 40,
    cameraTip: 'Set the camera side-on and low to the ground so your hips and knees stay in frame through the plank.',
    howTo: [
      'Start in a plank with hands under your shoulders.',
      "Keep your hips level - don't let them rise up.",
      'Drive one knee toward your chest, then switch legs quickly.',
      'Keep alternating at a steady pace.',
    ],
  },
  // 9. Band row: repetition exercise with a resistance band, counted from the elbow angle.
  {
    id: 'standing_row',
    name: 'Standing Resistance Band Row',
    equipment: ['resistance_band'], // only offered to users with a band
    space: ['small', 'medium', 'large'],
    muscleGroup: 'back',
    goals: ['general_fitness', 'strength'],
    baseSets: 3,
    baseReps: 12,
    restSeconds: 40,
    cameraTip: 'Stand side-on to the camera with the band anchored in front of you, so your shoulder, elbow and wrist are visible.',
    howTo: [
      'Anchor the band at chest height and hold the ends with arms extended.',
      'Pull your elbows back past your ribs, squeezing your shoulder blades together.',
      'Stay tall. Do not lean back to pull.',
      'Return slowly until your arms are straight again.',
    ],
  },
  // 10. Dumbbell shoulder press: repetition exercise, counted from wrist height.
  {
    id: 'dumbbell_shoulder_press',
    name: 'Dumbbell Shoulder Press',
    equipment: ['dumbbells', 'full_gym'], // only offered to users with weights
    space: ['small', 'medium', 'large'],
    muscleGroup: 'shoulders',
    goals: ['strength'],
    baseSets: 3,
    baseReps: 10,
    restSeconds: 45,
    cameraTip: 'Face the camera from about two metres away so both shoulders, both hands and your hips are in frame.',
    howTo: [
      'Stand tall with a dumbbell at each shoulder, palms facing forward.',
      'Press both dumbbells straight overhead until your arms are almost straight.',
      'Keep your ribs down. Do not arch your back.',
      'Lower back to shoulder height with control.',
    ],
  },
  // 11. Cat-cow stretch: mobility exercise, counted from the back angle.
  {
    id: 'cat_cow_stretch',
    name: 'Cat-Cow Stretch',
    equipment: ['none'],
    space: ['small', 'medium', 'large'],
    muscleGroup: 'spine',
    goals: ['mobility'],
    baseSets: 2,
    baseReps: 10,
    restSeconds: 20,
    cameraTip: 'Position the camera directly to your side, low to the ground - this one is hard to read from a front-facing camera.',
    howTo: [
      'Start on your hands and knees, hands under shoulders, knees under hips.',
      'Cow: drop your belly, lift your chest and tailbone.',
      'Cat: round your spine up, tuck your chin and tailbone.',
      'Move slowly between the two positions.',
    ],
  },
  // 12. World's greatest stretch: the only exercise with no camera detector, completed by manual tick.
  {
    id: 'world_greatest_stretch',
    name: "World's Greatest Stretch",
    manual: true, // slow multi-joint rotation, checked off by the user
    equipment: ['none'],
    space: ['medium', 'large'],
    muscleGroup: 'full_body',
    goals: ['mobility'],
    baseSets: 2,
    baseReps: 6,
    restSeconds: 20,
    howTo: [
      'Step into a long lunge with both hands on the floor inside your front foot.',
      'Rotate your chest toward the front knee and reach that arm to the ceiling.',
      'Return the hand to the floor, then straighten the front leg to stretch the hamstring.',
      'Switch sides. One repetition is both sides.',
    ],
  },
]

// Finds one exercise by its id, e.g. exerciseById('squat').
export function exerciseById(id) {
  return EXERCISES.find((e) => e.id === id) // first exercise whose id matches
}

// Bodyweight exercises (equipment: 'none') suit everyone, so they stay in
// the pool whatever equipment the user owns.
export function exercisesFor(profile) {
  return EXERCISES.filter( // keep only the exercises that pass all three checks
    (ex) =>
      (ex.equipment.includes(profile.equipment) || ex.equipment.includes('none')) && // 1. user has the equipment, or none is needed
      ex.space.includes(profile.space) && // 2. fits the user's space
      ex.goals.includes(profile.goal) // 3. matches the user's goal
  )
}
