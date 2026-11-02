import { onBeforeUnmount, ref, watch } from "vue"

// How long each step of the count stays before the next one.
const STEP_MS = 90

// A number that counts up or down to its target one step at a time, so coins
// visibly tick into a plate. `hop` flips on for each step up, for a small bounce.
export function useRollingNumber(target: () => number) {
  const shown = ref(target())
  const hop = ref(0)
  let timer: ReturnType<typeof setInterval> | null = null

  function stop(): void {
    if (timer) clearInterval(timer)
    timer = null
  }

  watch(target, (next) => {
    stop()
    // Nothing to roll when motion is reduced: show the new total straight away.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      shown.value = next
      return
    }
    timer = setInterval(() => {
      if (shown.value === next) return stop()
      const up = shown.value < next
      shown.value += up ? 1 : -1
      if (up) hop.value += 1
    }, STEP_MS)
  })

  onBeforeUnmount(stop)

  return { shown, hop }
}
