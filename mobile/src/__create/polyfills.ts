import updatedFetch from './fetch';
// @ts-ignore
global.fetch = updatedFetch;

// Polyfill window event listeners for libraries that expect browser APIs
if (typeof window !== 'undefined') {
  const listeners: Map<string, Set<Function>> = new Map();

  if (typeof window.addEventListener !== 'function') {
    // @ts-ignore
    window.addEventListener = (event: string, listener: Function) => {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)?.add(listener);
    };
  }

  if (typeof window.removeEventListener !== 'function') {
    // @ts-ignore
    window.removeEventListener = (event: string, listener: Function) => {
      listeners.get(event)?.delete(listener);
    };
  }

  if (typeof window.dispatchEvent !== 'function') {
    // @ts-ignore
    window.dispatchEvent = (event: Event) => {
      const eventListeners = listeners.get(event.type);
      if (eventListeners) {
        eventListeners.forEach(listener => {
          try {
            listener(event);
          } catch (e) {
            console.warn('Event listener error:', e);
          }
        });
      }
      return true;
    };
  }
}
