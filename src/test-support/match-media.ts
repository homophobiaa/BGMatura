/**
 * A controllable `window.matchMedia` for component tests, which jsdom does not provide.
 * Every query reports `matches` from the map; `setMatches` changes one and fires `change`
 * on the lists that were handed out for it, as a browser does when a setting changes.
 */
export function installMatchMedia(initial: Record<string, boolean> = {}) {
  const matches = new Map(Object.entries(initial));
  const listeners = new Map<string, Set<(event: MediaQueryListEvent) => void>>();

  function listenersFor(query: string) {
    let set = listeners.get(query);
    if (!set) {
      set = new Set();
      listeners.set(query, set);
    }
    return set;
  }

  function matchMedia(query: string): MediaQueryList {
    return {
      media: query,
      get matches() { return matches.get(query) ?? false; },
      onchange: null,
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => { listenersFor(query).add(listener); },
      removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => { listenersFor(query).delete(listener); },
      addListener: (listener: (event: MediaQueryListEvent) => void) => { listenersFor(query).add(listener); },
      removeListener: (listener: (event: MediaQueryListEvent) => void) => { listenersFor(query).delete(listener); },
      dispatchEvent: () => true,
    } as MediaQueryList;
  }

  Object.defineProperty(window, "matchMedia", { value: matchMedia, configurable: true, writable: true });

  return {
    setMatches(query: string, value: boolean) {
      matches.set(query, value);
      for (const listener of listenersFor(query)) listener({ matches: value, media: query } as MediaQueryListEvent);
    },
    listenerCount: (query: string) => listenersFor(query).size,
    uninstall() {
      Reflect.deleteProperty(window, "matchMedia");
    },
  };
}
