import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  StatusBar,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../context/I18nContext';
import { radii, spacing } from '../theme/tokens';
import ProduceBubble from '../components/decor/ProduceBubble';

const JOURNEY_STEPS = [
  { icon: 'sparkles-outline', title: 'Planını kur', text: 'Hedeflerine göre günlük ritmini düzenle.' },
  { icon: 'restaurant-outline', title: 'Malzeme seç', text: 'Elindekilerle sana uygun tarifleri bul.' },
  { icon: 'analytics-outline', title: 'Takip et', text: 'Ölçüm ve uyum görünümüyle motivasyonunu koru.' },
] as const;

export default function WelcomeScreen() {
  const navigation = useNavigation();
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const riseAnim = useRef(new Animated.Value(26)).current;
  const orbAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(riseAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(orbAnim, { toValue: 1.04, duration: 2600, useNativeDriver: true }),
          Animated.timing(orbAnim, { toValue: 0.92, duration: 2600, useNativeDriver: true }),
        ]),
      ),
    ]).start();
  }, [fadeAnim, orbAnim, riseAnim]);

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      <Animated.View
        pointerEvents="none"
        style={[
          s.ambientPrimary,
          { backgroundColor: theme.primaryGlow, transform: [{ scale: orbAnim }] },
        ]}
      >
        <Ionicons name="nutrition-outline" size={34} color={`${theme.primary}44`} />
      </Animated.View>
      <ProduceBubble
        icon="fruit-pear"
        iconSize={34}
        iconColor={`${theme.primary}46`}
        style={[s.ambientSecondary, { backgroundColor: theme.emeraldGlow }]}
      />
      <ProduceBubble
        icon="leaf"
        iconSize={24}
        iconColor={`${theme.primary}38`}
        style={[s.ambientThird, { backgroundColor: `${theme.accentCyan}16` }]}
      />

      <SafeAreaView style={s.safe}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <Animated.View
            style={[
              s.content,
              { opacity: fadeAnim, transform: [{ translateY: riseAnim }] },
            ]}
          >
            <View style={s.heroTop}>
              <View style={[s.logoWrap, { backgroundColor: theme.surface, borderColor: theme.borderEmerald }]}>
                <View style={[s.logoGlow, { backgroundColor: theme.primaryLight }]} />
                <Ionicons name="leaf-outline" size={34} color={theme.primaryDark} />
              </View>

              <View style={[s.badge, { backgroundColor: theme.primaryLight, borderColor: theme.borderEmerald }]}>
                <Ionicons name="heart-outline" size={14} color={theme.emerald} />
                <Text style={[s.badgeText, { color: theme.emerald }]}>Yeni Nesil İyi Yaşam Deneyimi</Text>
              </View>
            </View>

            <Text style={[s.title, { color: theme.text }]}>
              Beslenme takibini daha sıcak, daha net ve daha motive edici hale getir.
            </Text>
            <Text style={[s.subtitle, { color: theme.textSub }]}>{t.welcome.tagline}</Text>

            <View style={[s.featureHero, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={s.featureHeroHeader}>
                <View>
                  <Text style={[s.featureHeroEyebrow, { color: theme.textMuted }]}>GÜNLÜK RUTİN</Text>
                  <Text style={[s.featureHeroTitle, { color: theme.text }]}>Plan, mutfak ve ilerleme tek akışta</Text>
                </View>
                <View style={[s.featureHeroIcon, { backgroundColor: theme.primaryLight }]}>
                  <Ionicons name="sparkles" size={18} color={theme.primary} />
                </View>
              </View>

              <View style={s.metricsRow}>
                {[
                  { value: '3', label: 'Adım' },
                  { value: '1', label: 'Tek merkez' },
                  { value: '24/7', label: 'Erişim' },
                ].map((item) => (
                  <View key={item.label} style={[s.metricCard, { backgroundColor: theme.surfaceElevated }]}>
                    <Text style={[s.metricValue, { color: theme.primaryDark }]}>{item.value}</Text>
                    <Text style={[s.metricLabel, { color: theme.textMuted }]}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={s.steps}>
              {JOURNEY_STEPS.map((step) => (
                <View key={step.title} style={[s.stepCard, { backgroundColor: theme.glass, borderColor: theme.glassBorder }]}>
                  <View style={[s.stepIcon, { backgroundColor: theme.primaryLight }]}>
                    <Ionicons name={step.icon} size={18} color={theme.primaryDark} />
                  </View>
                  <View style={s.stepBody}>
                    <Text style={[s.stepTitle, { color: theme.text }]}>{step.title}</Text>
                    <Text style={[s.stepText, { color: theme.textSub }]}>{step.text}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={s.actions}>
              <TouchableOpacity
                style={[s.primaryBtn, { backgroundColor: theme.primary, shadowColor: theme.primaryGlow }]}
                onPress={() => navigation.navigate('Register' as never)}
                activeOpacity={0.88}
              >
                <Text style={s.primaryBtnText}>{t.welcome.signUp}</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFF" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.secondaryBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => navigation.navigate('Login' as never)}
                activeOpacity={0.82}
              >
                <Text style={[s.secondaryBtnText, { color: theme.primaryDark }]}>{t.welcome.signIn}</Text>
              </TouchableOpacity>
            </View>

            <Text style={[s.legal, { color: theme.textMuted }]}>
              {t.welcome.termsPrefix}
              <Text style={[s.legalAccent, { color: theme.emerald }]}>{t.welcome.terms}</Text>
              {t.welcome.termsSuffix}
            </Text>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
  },

  ambientPrimary: {
    position: 'absolute',
    top: -60,
    right: -70,
    width: 260,
    height: 260,
    borderRadius: 130,
    opacity: 0.95,
  },
  ambientSecondary: {
    position: 'absolute',
    bottom: -90,
    left: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    opacity: 0.7,
  },
  ambientThird: {
    position: 'absolute',
    top: '40%',
    right: 26,
    width: 96,
    height: 96,
    borderRadius: 48,
    opacity: 0.8,
  },

  heroTop: { alignItems: 'flex-start', marginBottom: spacing.lg },
  logoWrap: {
    width: 88,
    height: 88,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.4,
    overflow: 'hidden',
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
  },
  logoGlow: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 28,
    opacity: 0.9,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  badgeText: { fontSize: 12, fontWeight: '800' },

  title: {
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 40,
    letterSpacing: -1.1,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 23,
    marginBottom: spacing.xl,
    maxWidth: 320,
  },

  featureHero: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    shadowColor: '#183324',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 26,
    elevation: 8,
  },
  featureHeroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  featureHeroEyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.1, marginBottom: 6 },
  featureHeroTitle: { fontSize: 20, fontWeight: '900', lineHeight: 26, maxWidth: 240 },
  featureHeroIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricsRow: { flexDirection: 'row', gap: spacing.sm },
  metricCard: {
    flex: 1,
    borderRadius: radii.lg,
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  metricValue: { fontSize: 20, fontWeight: '900', marginBottom: 4 },
  metricLabel: { fontSize: 11, fontWeight: '700' },

  steps: { gap: spacing.sm, marginBottom: spacing.xl },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.md,
  },
  stepIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBody: { flex: 1 },
  stepTitle: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  stepText: { fontSize: 13, lineHeight: 19 },

  actions: { gap: spacing.sm, marginBottom: spacing.lg },
  primaryBtn: {
    minHeight: 58,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 22,
    elevation: 10,
  },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  secondaryBtn: {
    minHeight: 54,
    borderRadius: radii.xl,
    borderWidth: 1.3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '800' },

  legal: {
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 18,
    paddingHorizontal: spacing.base,
  },
  legalAccent: { fontWeight: '800' },
});

