type Listener = () => void;

const listeners = new Set<Listener>();

export function emitGamificationChanged() {
  listeners.forEach((listener) => listener());
}

export function subscribeToGamificationChanges(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
