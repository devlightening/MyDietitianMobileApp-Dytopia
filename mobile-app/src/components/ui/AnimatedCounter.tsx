import React, { useEffect, useRef, useState } from 'react';
import { Text, type TextStyle } from 'react-native';

interface Props {
  value: number;
  duration?: number;
  style?: TextStyle | TextStyle[];
  suffix?: string;
  prefix?: string;
  decimals?: number;
}

export default function AnimatedCounter({ value, duration = 500, style, suffix = '', prefix = '', decimals = 0 }: Props) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    if (from === to) return;

    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (to - from) * eased;
      setDisplay(parseFloat(current.toFixed(decimals)));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevRef.current = to;
        setDisplay(to);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [value, duration, decimals]);

  const formatted = decimals > 0 ? display.toFixed(decimals) : Math.round(display).toString();

  return <Text style={style}>{prefix}{formatted}{suffix}</Text>;
}
