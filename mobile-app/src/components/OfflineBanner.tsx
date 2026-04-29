import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, StyleSheet, Text } from 'react-native';

async function checkOnline(): Promise<boolean> {
  try {
    const res = await fetch('https://clients3.google.com/generate_204', {
      method: 'HEAD',
      cache: 'no-store',
    });
    return res.status === 204;
  } catch {
    return false;
  }
}

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const slideAnim = useRef(new Animated.Value(-48)).current;

  const update = useCallback(async () => {
    const online = await checkOnline();
    const offline = !online;
    setIsOffline(offline);
    Animated.timing(slideAnim, {
      toValue: offline ? 0 : -48,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [slideAnim]);

  useEffect(() => {
    void update();
    const interval = setInterval(() => { void update(); }, 10000);
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') void update();
    });
    return () => { clearInterval(interval); sub.remove(); };
  }, [update]);

  if (!isOffline) return null;

  return (
    <Animated.View style={[s.banner, { transform: [{ translateY: slideAnim }] }]}>
      <Text style={s.txt}>İnternet bağlantısı yok</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: '#FF4757',
    paddingVertical: 10,
    alignItems: 'center',
  },
  txt: { color: '#fff', fontWeight: '700', fontSize: 13 },
});

