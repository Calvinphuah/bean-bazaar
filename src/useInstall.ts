import { ref } from "vue"

const HINT_KEY = "bean-bazaar-install-hint-closed"

// Chrome and Edge hand over their install offer as this event; it isn't in the DOM types yet.
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

// Saved at startup, because the browser fires it once, before the start screen may be up.
let installEvent: InstallPromptEvent | null = null
const canInstall = ref(false)
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault()
  installEvent = event as InstallPromptEvent
  canInstall.value = true
})
window.addEventListener("appinstalled", () => {
  installEvent = null
  canInstall.value = false
})

function installed(): boolean {
  const iosHomeScreen = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosHomeScreen || window.matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches
}

// iPhones and iPads only install from the Share menu; iPads can report themselves as a Mac.
function isIos(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
}

// localStorage can throw in private windows; then the hint just shows each visit.
function hintClosed(): boolean {
  try {
    return localStorage.getItem(HINT_KEY) === "yes"
  } catch {
    return false
  }
}

// Offers to put the game on the home screen: a button where the browser can install it,
// and a how-to on iPhone, where only the Share menu can.
export function useInstall() {
  const closed = ref(hintClosed())
  const iosHint = !installed() && isIos()

  async function install(): Promise<void> {
    if (!installEvent) return
    await installEvent.prompt()
    await installEvent.userChoice
    installEvent = null
    canInstall.value = false
  }

  function closeHint(): void {
    closed.value = true
    try {
      localStorage.setItem(HINT_KEY, "yes")
    } catch {
      // Nothing to do: the hint will show again next visit.
    }
  }

  return { canInstall, iosHint, closed, install, closeHint }
}
