import { useCallback, useEffect, useRef } from 'react';
import { Accelerometer } from 'expo-sensors';

const SHAKE_THRESHOLD = 1.6;  // delta-G between two consecutive samples
const SHAKE_COOLDOWN  = 1800; // ms - minimum gap between two triggers
const UPDATE_INTERVAL = 80;   // ms per sample (~12 Hz)

export function useShakeDetector(onShake: () => void, enabled: boolean) {
  const lastAccel    = useRef({ x: 0, y: 0, z: 0 });
  const lastFiredAt  = useRef(0);
  const stableOnShake = useRef(onShake);

  // Keep ref in sync so subscription closure never captures a stale callback
  useEffect(() => { stableOnShake.current = onShake; }, [onShake]);

  useEffect(() => {
    if (!enabled) return;

    Accelerometer.setUpdateInterval(UPDATE_INTERVAL);

    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      const prev = lastAccel.current;
      const dx = x - prev.x;
      const dy = y - prev.y;
      const dz = z - prev.z;
      const delta = Math.sqrt(dx * dx + dy * dy + dz * dz);

      lastAccel.current = { x, y, z };

      if (delta > SHAKE_THRESHOLD) {
        const now = Date.now();
        if (now - lastFiredAt.current > SHAKE_COOLDOWN) {
          lastFiredAt.current = now;
          stableOnShake.current();
        }
      }
    });

    return () => subscription.remove();
  }, [enabled]);
}

