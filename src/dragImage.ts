// A plain copy of the dragged card, without its tags and glow.
function cardGhost(source: HTMLElement): HTMLElement | null {
  const card = source.querySelector<HTMLElement>(".card")
  if (!card) return null

  const ghost = card.cloneNode(true) as HTMLElement
  ghost.classList.remove("highlighted", "selected")
  return ghost
}

// Some browsers photograph everything on screen over a dragged card for the drag ghost,
// tags and glow included, so hand them a plain off-screen copy of the card instead.
export function setCardDragImage(event: DragEvent): void {
  const ghost = cardGhost(event.currentTarget as HTMLElement)
  if (!event.dataTransfer || !ghost) return

  ghost.style.cssText = "position: fixed; top: -1000px; left: -1000px;"
  document.body.append(ghost)
  event.dataTransfer.setDragImage(ghost, event.offsetX, event.offsetY)
  requestAnimationFrame(() => ghost.remove())
}

// A finger moving this far is a drag, not a tap.
const TOUCH_DRAG_START = 8

// Phones never start the browser's drag and drop from a finger, so a touch drag is
// done by hand: a copy of the card follows the finger, and the field under it gets
// the same dragover, dragleave and drop events a mouse drag would give it.
export function startTouchDrag(event: PointerEvent, onStart: () => void, onEnd: () => void): void {
  if (event.pointerType === "mouse") return
  const source = event.currentTarget as HTMLElement
  const startX = event.clientX
  const startY = event.clientY
  let ghost: HTMLElement | null = null
  let offsetX = 0
  let offsetY = 0
  let over: Element | null = null

  function send(type: string, target: Element): void {
    target.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true }))
  }

  function onMove(move: PointerEvent): void {
    if (move.pointerId !== event.pointerId) return
    if (!ghost) {
      if (Math.hypot(move.clientX - startX, move.clientY - startY) < TOUCH_DRAG_START) return
      ghost = cardGhost(source)
      if (!ghost) return finish()
      const card = source.querySelector<HTMLElement>(".card")!
      const box = card.getBoundingClientRect()
      offsetX = startX - box.left
      offsetY = startY - box.top
      // The table is zoomed to fit, so the copy is sized to match what's on screen.
      const zoom = box.width / card.offsetWidth
      ghost.style.cssText = `position: fixed; left: 0; top: 0; margin: 0; zoom: ${zoom}; pointer-events: none; z-index: 1000; opacity: .9;`
      document.body.append(ghost)
      onStart()
    }
    ghost.style.translate = `${(move.clientX - offsetX) / Number(ghost.style.zoom)}px ${(move.clientY - offsetY) / Number(ghost.style.zoom)}px`
    const field = document.elementFromPoint(move.clientX, move.clientY)?.closest(".field") ?? null
    if (field !== over) {
      if (over) send("dragleave", over)
      over = field
    }
    if (over) send("dragover", over)
  }

  function finish(drop = false): void {
    window.removeEventListener("pointermove", onMove)
    window.removeEventListener("pointerup", onUp)
    window.removeEventListener("pointercancel", onCancel)
    if (!ghost) return
    ghost.remove()
    if (over) send(drop ? "drop" : "dragleave", over)
    onEnd()
  }

  function onUp(up: PointerEvent): void {
    if (up.pointerId === event.pointerId) finish(true)
  }

  function onCancel(cancel: PointerEvent): void {
    if (cancel.pointerId === event.pointerId) finish()
  }

  window.addEventListener("pointermove", onMove)
  window.addEventListener("pointerup", onUp)
  window.addEventListener("pointercancel", onCancel)
}
