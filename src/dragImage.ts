// Some browsers photograph everything on screen over a dragged card for the drag ghost,
// tags and glow included, so hand them a plain off-screen copy of the card instead.
export function setCardDragImage(event: DragEvent): void {
  const card = (event.currentTarget as HTMLElement).querySelector<HTMLElement>(".card")
  if (!event.dataTransfer || !card) return

  const ghost = card.cloneNode(true) as HTMLElement
  ghost.classList.remove("highlighted", "selected")
  ghost.style.cssText = "position: fixed; top: -1000px; left: -1000px;"
  document.body.append(ghost)
  event.dataTransfer.setDragImage(ghost, event.offsetX, event.offsetY)
  requestAnimationFrame(() => ghost.remove())
}
