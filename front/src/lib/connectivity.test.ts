import { describe, expect, it } from 'vitest'

import { createConnectivity } from './connectivity'

/** Navigateur simulé : état du réseau et évènements « online » / « offline ». */
function fakeWindow(onLine = true) {
  const target = new EventTarget()
  return {
    navigator: { onLine },
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    go(online: boolean) {
      this.navigator.onLine = online
      target.dispatchEvent(new Event(online ? 'online' : 'offline'))
    },
  }
}

function watch(connectivity: ReturnType<typeof createConnectivity>) {
  let changes = 0
  const stop = connectivity.subscribe(() => (changes += 1))
  return { changes: () => changes, stop }
}

describe('createConnectivity', () => {
  it('suit les évènements du navigateur', () => {
    const browser = fakeWindow()
    const connectivity = createConnectivity(browser)
    const { changes } = watch(connectivity)
    expect(connectivity.getSnapshot()).toBe(false)
    browser.go(false)
    expect(connectivity.getSnapshot()).toBe(true)
    browser.go(true)
    expect(connectivity.getSnapshot()).toBe(false)
    expect(changes()).toBe(2)
  })

  it('hors ligne dès le départ si le navigateur le dit', () => {
    const connectivity = createConnectivity(fakeWindow(false))
    watch(connectivity)
    expect(connectivity.getSnapshot()).toBe(true)
  })

  it('un échec réseau met hors ligne, la réponse suivante remet en ligne', () => {
    const connectivity = createConnectivity(fakeWindow())
    const { changes } = watch(connectivity)
    connectivity.reportFailure()
    expect(connectivity.getSnapshot()).toBe(true)
    connectivity.reportSuccess()
    expect(connectivity.getSnapshot()).toBe(false)
    // Une réponse sans échec noté ne prévient personne.
    connectivity.reportSuccess()
    expect(changes()).toBe(2)
  })

  it('le retour du réseau efface un échec noté', () => {
    const browser = fakeWindow()
    const connectivity = createConnectivity(browser)
    watch(connectivity)
    connectivity.reportFailure()
    browser.go(true)
    expect(connectivity.getSnapshot()).toBe(false)
  })

  it('n’écoute plus le navigateur sans abonné', () => {
    const browser = fakeWindow()
    const connectivity = createConnectivity(browser)
    const { changes, stop } = watch(connectivity)
    stop()
    browser.go(false)
    expect(changes()).toBe(0)
  })
})
