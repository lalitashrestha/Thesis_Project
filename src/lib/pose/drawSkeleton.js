/**
 * Draws the detected pose landmarks and connecting bones onto a canvas
 * sized to match the video. Landmarks below the visibility threshold are
 * skipped rather than drawn faintly, so a shaky low-confidence reading
 * doesn't look like a confirmed detection.
 */
export function drawSkeleton(ctx, landmarks, connections, width, height, color = '#e8a33d') {
  ctx.clearRect(0, 0, width, height) // wipe the previous frame's drawing
  if (!landmarks) return // nobody detected: leave the canvas empty

  ctx.strokeStyle = color // colour of the bone lines (amber by default; red for a form fault)
  ctx.lineWidth = 3 // line thickness in pixels
  ctx.fillStyle = color // colour of the joint dots

  connections.forEach(({ start, end }) => { // each bone joins two body points
    const a = landmarks[start] // first point of the bone
    const b = landmarks[end] // second point of the bone
    if (!a || !b) return // a point is missing: skip this bone
    if ((a.visibility ?? 1) < 0.4 || (b.visibility ?? 1) < 0.4) return // a point is not visible enough: skip
    ctx.beginPath() // start a new line
    ctx.moveTo(a.x * width, a.y * height) // positions are 0-1, so multiply by the canvas size
    ctx.lineTo(b.x * width, b.y * height)
    ctx.stroke() // draw the line
  })

  landmarks.forEach((p) => { // draw a dot on every visible joint
    if ((p.visibility ?? 1) < 0.4) return // skip points that are not visible enough
    ctx.beginPath()
    ctx.arc(p.x * width, p.y * height, 4, 0, 2 * Math.PI) // a circle of radius 4 pixels
    ctx.fill() // fill it in
  })
}
