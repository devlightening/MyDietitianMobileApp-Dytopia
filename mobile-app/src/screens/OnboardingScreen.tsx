import React, { useRef, useState } from 'react';
import {
  Dimensions,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, interpolate, Extrapolation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useTheme } from '../context/ThemeContext';
import { radii, spacing } from '../theme/tokens';

export const ONBOARDING_DONE_KEY = 'onboarding_completed_v1';

const { width: W } = Dimensions.get('window');

const SLIDES = [
  {
    icon: 'nutrition-outline' as const,
    accent: '#22c55e',
    title: 'Diyetisyenin Yanında',
    subtitle: 'Diyetisyeniniz günlük planınızı hazırlar. Sen sadece uygulamanı aç, bugün ne yiyeceğini gör.',
  },
  {
    icon: 'camera-outline' as const,
    accent: '#3b82f6',
    title: 'Fotoğrafla Tara',
    subtitle: 'Buzdolabının fotoğrafını çek. Uygulama malzemeleri tanır, sana uygun tarif önerir.',
  },
  {
    icon: 'trending-up-outline' as const,
    accent: '#f59e0b',
    title: 'İlerleni Takip Et',
    subtitle: 'Kilo, bel ve ölçümlerini gir. Haftalık grafiklerle değişimini izle, motivasyonunu koru.',
  },
  {
    icon: 'checkmark-circle-outline' as const,
    accent: '#8b5cf6',
    title: 'İlk Adımı Bugün At',
    subtitle: 'Her tamamlanan öğün bir rozet, her bardak su bir adım. Başarın küçük alışkanlıklardan doğar â€” bugün başla!',
  },
];

interface Props {
  onDone: () => void;
}

export default function OnboardingScreen({ onDone }: Props) {
  const { theme, isDark } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const progress = useSharedValue(0);

  function goTo(i: number) {
    scrollRef.current?.scrollTo({ x: i * W, animated: true });
    setIndex(i);
    progress.value = withSpring(i);
  }

  async function finish() {
    await SecureStore.setItemAsync(ONBOARDING_DONE_KEY, 'true');
    onDone();
  }

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        contentContainerStyle={{ width: W * SLIDES.length }}
      >
        {SLIDES.map((slide, i) => (
          <SlideView key={i} slide={slide} theme={theme} active={index === i} />
        ))}
      </ScrollView>

      {/* Dots */}
      <View style={s.dots}>
        {SLIDES.map((_, i) => (
          <Dot key={i} active={index === i} color={SLIDES[index].accent} />
        ))}
      </View>

      {/* Buttons */}
      <View style={s.footer}>
        {index < SLIDES.length - 1 ? (
          <>
            <TouchableOpacity style={[s.nextBtn, { backgroundColor: SLIDES[index].accent }]} onPress={() => goTo(index + 1)} activeOpacity={0.85}>
              <Text style={s.nextTxt}>Devam</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={s.skipBtn} onPress={() => void finish()} activeOpacity={0.7}>
              <Text style={[s.skipTxt, { color: theme.textMuted }]}>Atla</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={[s.nextBtn, { backgroundColor: SLIDES[index].accent }]} onPress={() => void finish()} activeOpacity={0.85}>
            <Text style={s.nextTxt}>Başlayalım</Text>
            <Ionicons name="checkmark" size={18} color="#FFF" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function SlideView({ slide, theme, active }: { slide: typeof SLIDES[0]; theme: any; active: boolean }) {
  const scale = useSharedValue(active ? 1 : 0.88);
  const opacity = useSharedValue(active ? 1 : 0.4);

  React.useEffect(() => {
    scale.value   = withSpring(active ? 1 : 0.88, { damping: 14 });
    opacity.value = withTiming(active ? 1 : 0.4, { duration: 300 });
  }, [active]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={[s.slide, { width: W }]}>
      <Animated.View style={[s.iconWrap, animStyle, { backgroundColor: `${slide.accent}18`, borderColor: `${slide.accent}30` }]}>
        <View style={[s.iconInner, { backgroundColor: `${slide.accent}28` }]}>
          <Ionicons name={slide.icon} size={52} color={slide.accent} />
        </View>
      </Animated.View>
      <Animated.View style={[animStyle, { alignItems: 'center' }]}>
        <Text style={[s.slideTitle, { color: theme.text }]}>{slide.title}</Text>
        <Text style={[s.slideSub, { color: theme.textMuted }]}>{slide.subtitle}</Text>
      </Animated.View>
    </View>
  );
}

function Dot({ active, color }: { active: boolean; color: string }) {
  return (
    <View
      style={[
        s.dot,
        {
          width: active ? 20 : 7,
          backgroundColor: active ? color : '#CBD5E1',
        },
      ]}
    />
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.xl },
  iconWrap: {
    width: 140, height: 140, borderRadius: 70, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  iconInner: {
    width: 110, height: 110, borderRadius: 55,
    alignItems: 'center', justifyContent: 'center',
  },
  slideTitle: { fontSize: 28, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5, marginBottom: spacing.sm },
  slideSub: { fontSize: 15, fontWeight: '600', textAlign: 'center', lineHeight: 24, maxWidth: 300 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingBottom: spacing.md },
  dot: { height: 7, borderRadius: 4 },
  footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl + 16, gap: spacing.sm },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    paddingVertical: 16, borderRadius: radii.xl,
  },
  nextTxt: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  skipBtn: { alignItems: 'center', paddingVertical: spacing.sm },
  skipTxt: { fontSize: 14, fontWeight: '700' },
});

