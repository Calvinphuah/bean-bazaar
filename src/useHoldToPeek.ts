import { ref } from "vue"
import type { BeanKey } from "./types"

// How long a finger rests on a card before its payout shows.
export const HOLD_MS = 400
// A finger moving this far is a drag or a scroll, not a hold.
export const HOLD_SLOP = 8
// The tap that follows lifting a held card arrives just after the finger leaves.
const CLICK_GRACE_MS = 400

// A finger can't hover, so resting it on a card stands in for the mouse's preview.
// Moving cancels the hold, so dragging a card to plant it still works.
export function useHoldToPeek() {
  const held = ref<BeanKey | null>(null)
  let pressing = false

  function onPointerDown(event: PointerEvent): void {
    if (event.pointerType === "mouse") return
    const bean = (event.target as Element).closest<HTMLElement>("[data-bean]")?.dataset.bean
    if (!bean) return
    const startX = event.clientX
    const startY = event.clientY
    pressing = true
    const timer = setTimeout(() => { held.value = bean }, HOLD_MS)

    function onMove(move: PointerEvent): void {
      if (move.pointerId !== event.pointerId) return
      if (Math.hypot(move.clientX - startX, move.clientY - startY) >= HOLD_SLOP) end(false)
    }

    function onUp(up: PointerEvent): void {
      if (up.pointerId === event.pointerId) end(true)
    }

    function onCancel(cancel: PointerEvent): void {
      if (cancel.pointerId === event.pointerId) end(false)
    }

    function end(lifted: boolean): void {
      clearTimeout(timer)
      pressing = false
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onCancel)
      // Lifting after a peek must not also pick or plant the card.
      if (lifted && held.value) swallowNextClick()
      held.value = null
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onCancel)
  }

  // A long press opens the phone's own menu over the card; the peek replaces it.
  // Right-click with a mouse still works.
  function onContextMenu(event: Event): void {
    if (pressing) event.preventDefault()
  }

  return { held, onPointerDown, onContextMenu }
}

function swallowNextClick(): void {
  function stop(click: Event): void {
    click.preventDefault()
    click.stopPropagation()
    window.removeEventListener("click", stop, true)
  }
  window.addEventListener("click", stop, true)
  // Not every lift is followed by a click, so a later real tap must still get through.
  setTimeout(() => window.removeEventListener("click", stop, true), CLICK_GRACE_MS)
}
