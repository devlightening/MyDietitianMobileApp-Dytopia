/**
 * AURA CLINICAL OS — Free Home Screen
 * Yeni tasarım: dinamik selamlama, adım rehberi, özellik önizleme, kimlik kartı
 */
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  StatusBar,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../context/I18nContext';
import { radii, spacing } from '../theme/tokens';
import { Routes } from '../navigation/routes';
import ProduceBubble from '../components/decor/ProduceBubble';
import { useFadeRise, useScaleSettle, useStaggerItem } from '../hooks/useAuraMotion';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): { emoji: string; line1: string; line2: string } {
  const h = new Date().getHours();
  if (h < 6)  return { emoji: '🌙', line1: 'İyi geceler,',        line2: 'Sağlıklı yarınlar seni bekliyor.' };
  if (h < 12) return { emoji: '☀️', line1: 'Günaydın!',           line2: 'Enerjik bir güne hoş geldin.' };
  if (h < 14) return { emoji: '🌿', line1: 'İyi öğleler!',        line2: 'Öğle molası, sağlıklı bir seçim.' };
  if (h < 18) return { emoji: '🍃', line1: 'İyi öğleden sonralar!', line2: 'Akşamı birlikte planlayalım.' };
  return       { emoji: '🌆', line1: 'İyi akşamlar!',             line2: 'Günü güzel bitiriyorsun.' };
}

// ── Feature preview data ──────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: 'calendar-outline' as const,
    accent: '#47B972',
    title: 'Günlük Plan',
    desc: 'Diyetisyenin sana özel öğün planı hazırlar.',
  },
  {
    icon: 'restaurant-outline' as const,
    accent: '#57B8C7',
    title: 'Tarif Motoru',
    desc: 'Elindeki malzemeyle yüzlerce tarif önerisi.',
  },
  {
    icon: 'analytics-outline' as const,
    accent: '#E3C45D',
    title: 'İlerleme Takibi',
    desc: 'Ölçümlerini, streaklerini ve başarılarını gör.',
  },
  {
    icon: 'chatbubbles-outline' as const,
    accent: '#E57E6B',
    title: 'Mesajlaşma',
    desc: 'Diyetisyeninle anlık iletişimde kal.',
  },
] as const;

// ── Steps data ────────────────────────────────────────────────────────────────

const STEPS = [
  { num: '1', label: 'Hesabını oluşturdun', done: true },
  { num: '2', label: 'Diyetisyenden kod al', done: false },
  { num: '3', label: 'Premium planını başlat', done: false },
] as const;

// ── Sub-components ────────────────────────────────────────────────────────────

function FeatureCard({
  icon, accent, title, desc, index, theme,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  accent: string;
  title: string;
  desc: string;
  index: number;
  theme: import('../theme/tokens').Theme;
}) {
  const anim = useStaggerItem(index, 120, 60);
  return (
    <Animated.View style={[s.featureCard, { backgroundColor: theme.surface, borderColor: theme.border }, anim]}>
      <View style={[s.featureIconWrap, { backgroundColor: `${accent}16` }]}>
        <Ionicons name={icon} size={22} color={accent} />
      </View>
      <Text style={[s.featureCardTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[s.featureCardDesc, { color: theme.textMuted }]} numberOfLines={2}>{desc}</Text>
      <View style={[s.featureLock, { backgroundColor: theme.surfaceElevated }]}>
        <Ionicons name="lock-closed-outline" size={11} color={theme.textMuted} />
        <Text style={[s.featureLockText, { color: theme.textMuted }]}>Premium</Text>
      </View>
    </Animated.View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function FreeHomeScreen() {
  const { user, logout, resetAppData } = useAuth();
  const navigation = useNavigation();
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();

  const greeting = getGreeting();

  // Animations
  const headerAnim  = useFadeRise(0, 20);
  const heroAnim    = useScaleSettle(60, 0.96);
  const stepsAnim   = useFadeRise(140, 14);
  const featuresAnim = useFadeRise(200, 14);
  const idAnim      = useFadeRise(260, 14);

  async function copyUserId() {
    if (!user?.publicUserId) return;
    await Clipboard.setStringAsync(user.publicUserId);
    Alert.alert(t.common.copied, `${t.dashboard.userId}:\n${user.publicUserId}`);
  }

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />

      {/* Background glows */}
      <ProduceBubble
        icon="leaf"
        iconSize={40}
        iconColor={`${theme.primary}38`}
        style={[s.glowA, { backgroundColor: theme.primaryGlow }]}
      />
      <ProduceBubble
        icon="fruit-pear"
        iconSize={36}
        iconColor={`${theme.emerald}32`}
        style={[s.glowB, { backgroundColor: theme.emeraldGlow }]}
      />
      <ProduceBubble
        icon="corn"
        iconSize={28}
        iconColor={`${theme.primary}28`}
        style={[s.glowC, { backgroundColor: theme.primaryGlow }]}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >
        {/* ── Header ── */}
        <Animated.View style={[s.header, headerAnim]}>
          <View style={s.headerLeft}>
            <View style={[s.freePill, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <View style={[s.freePillDot, { backgroundColor: theme.emerald }]} />
              <Text style={[s.freePillText, { color: theme.textMuted }]}>ÜCRETSİZ</Text>
            </View>
            <Text style={[s.greetingEmoji]}>{greeting.emoji}</Text>
            <Text style={[s.greetingLine1, { color: theme.text }]}>{greeting.line1}</Text>
            <Text style={[s.greetingLine2, { color: theme.textSub }]}>{greeting.line2}</Text>
          </View>

          <View style={s.headerRight}>
            {__DEV__ && resetAppData && (
              <TouchableOpacity
                style={[s.iconBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => Alert.alert('Reset (DEV)', 'Devam?', [
                  { text: 'İptal', style: 'cancel' },
                  { text: 'Reset', style: 'destructive', onPress: () => resetAppData?.() },
                ])}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh-outline" size={16} color={theme.error} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[s.iconBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={logout}
              activeOpacity={0.8}
            >
              <Ionicons name="log-out-outline" size={18} color={theme.error} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ── Hero CTA card ── */}
        <Animated.View style={heroAnim}>
          <View style={[s.heroCard, { backgroundColor: theme.primary }]}>
            {/* Decorative blob inside card */}
            <View style={s.heroBlobWrap} pointerEvents="none">
              <View style={[s.heroBlob, { backgroundColor: 'rgba(255,255,255,0.10)' }]} />
              <View style={[s.heroBlobSm, { backgroundColor: 'rgba(255,255,255,0.07)' }]} />
            </View>

            <View style={s.heroContent}>
              <View style={[s.heroIconBox, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
                <Ionicons name="sparkles-outline" size={24} color="#fff" />
              </View>
              <Text style={s.heroCardTitle}>Premium planını{'\n'}şimdi başlat.</Text>
              <Text style={s.heroCardSub}>
                Diyetisyeninden aldığın kodu girerek kişisel planına hemen erişebilirsin.
              </Text>
              <TouchableOpacity
                style={s.heroBtn}
                onPress={() => navigation.getParent()?.navigate(Routes.Modal.ActivatePremium as never)}
                activeOpacity={0.88}
              >
                <Text style={[s.heroBtnText, { color: theme.primary }]}>Kodu Gir</Text>
                <View style={[s.heroBtnArrow, { backgroundColor: `${theme.primary}18` }]}>
                  <Ionicons name="arrow-forward" size={16} color={theme.primary} />
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        {/* ── Onboarding stepper ── */}
        <Animated.View style={stepsAnim}>
          <Text style={[s.sectionLabel, { color: theme.textMuted }]}>ADIMLAR</Text>
          <View style={[s.stepsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {STEPS.map((step, i) => (
              <View key={step.num} style={[s.stepRow, i < STEPS.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.borderLight }]}>
                <View style={[
                  s.stepCircle,
                  step.done
                    ? { backgroundColor: theme.primary, borderColor: theme.primary }
                    : { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
                ]}>
                  {step.done
                    ? <Ionicons name="checkmark" size={13} color="#fff" />
                    : <Text style={[s.stepNum, { color: theme.textMuted }]}>{step.num}</Text>
                  }
                </View>
                <View style={s.stepConnector}>
                  {i < STEPS.length - 1 && (
                    <View style={[s.stepLine, { backgroundColor: theme.borderLight }]} />
                  )}
                </View>
                <Text style={[
                  s.stepLabel,
                  { color: step.done ? theme.emerald : theme.text },
                  step.done && { textDecorationLine: 'line-through', color: theme.textMuted },
                ]}>
                  {step.label}
                </Text>
                {step.done && (
                  <View style={[s.stepDoneBadge, { backgroundColor: `${theme.emerald}14` }]}>
                    <Text style={[s.stepDoneText, { color: theme.emerald }]}>✓ Tamam</Text>
                  </View>
                )}
                {!step.done && i === 1 && (
                  <TouchableOpacity
                    style={[s.stepActionBtn, { backgroundColor: theme.primaryLight, borderColor: theme.borderEmerald }]}
                    onPress={copyUserId}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.stepActionText, { color: theme.primary }]}>ID'ni paylaş</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        </Animated.View>

        {/* ── Identity card ── */}
        {user?.publicUserId && (
          <Animated.View style={idAnim}>
            <View style={[s.idCard, { backgroundColor: theme.glass, borderColor: theme.glassBorder }]}>
              <View style={s.idCardHeader}>
                <View style={s.idCardLeft}>
                  <View style={[s.idIconBox, { backgroundColor: theme.primaryLight }]}>
                    <Ionicons name="person-outline" size={14} color={theme.primaryDark} />
                  </View>
                  <Text style={[s.idCardLabel, { color: theme.textMuted }]}>{t.dashboard.userId}</Text>
                </View>
                <View style={[s.idOnlineDot, { backgroundColor: theme.emerald }]} />
              </View>

              <Text style={[s.idValue, { color: theme.primaryDark }]}>{user.publicUserId}</Text>
              <Text style={[s.idHint, { color: theme.textSub }]}>{t.dashboard.userIdHint}</Text>

              <View style={s.idActions}>
                <TouchableOpacity
                  style={[s.idActionPrimary, { backgroundColor: theme.primaryLight, borderColor: theme.borderEmerald }]}
                  onPress={copyUserId}
                  activeOpacity={0.8}
                >
                  <Ionicons name="copy-outline" size={15} color={theme.emerald} />
                  <Text style={[s.idActionPrimaryText, { color: theme.emerald }]}>Kopyala</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.idActionSecondary, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  onPress={() => navigation.getParent()?.navigate(Routes.Modal.ActivatePremium as never)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="key-outline" size={15} color={theme.textSub} />
                  <Text style={[s.idActionSecondaryText, { color: theme.textSub }]}>Kodu gir</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        )}

        {/* ── Feature preview ── */}
        <Animated.View style={featuresAnim}>
          <Text style={[s.sectionLabel, { color: theme.textMuted }]}>PREMIUM İLE AÇILIR</Text>
          <View style={s.featureGrid}>
            {FEATURES.map((f, i) => (
              <FeatureCard
                key={f.title}
                icon={f.icon}
                accent={f.accent}
                title={f.title}
                desc={f.desc}
                index={i}
                theme={theme}
              />
            ))}
          </View>
        </Animated.View>

        {/* ── Premium benefits list ── */}
        <View style={[s.benefitsBox, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <View style={s.benefitsHeader}>
            <Ionicons name="ribbon-outline" size={18} color={theme.primary} />
            <Text style={[s.benefitsTitle, { color: theme.text }]}>{t.common.premium} Avantajları</Text>
          </View>
          {t.premium.premiumBenefits.map((feature, i) => (
            <View
              key={feature}
              style={[
                s.benefitRow,
                { borderBottomColor: theme.borderLight },
                i === t.premium.premiumBenefits.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <View style={[s.benefitBullet, { backgroundColor: theme.emerald }]} />
              <Text style={[s.benefitText, { color: theme.textSub }]}>{feature}</Text>
            </View>
          ))}
        </View>

        <View style={s.bottomPad} />
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl + 12,
    paddingBottom: 120,
    gap: spacing.lg,
  },

  // Background glows
  glowA: {
    position: 'absolute', top: -70, right: -80,
    width: 240, height: 240, borderRadius: 120, opacity: 0.85,
  },
  glowB: {
    position: 'absolute', bottom: 200, left: -100,
    width: 260, height: 260, borderRadius: 130, opacity: 0.65,
  },
  glowC: {
    position: 'absolute', top: 380, right: -60,
    width: 160, height: 160, borderRadius: 80, opacity: 0.5,
  },

  // Header
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerLeft: { flex: 1, gap: 4 },
  headerRight: { flexDirection: 'row', gap: spacing.sm, paddingTop: 4 },
  freePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', borderRadius: radii.full,
    borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5,
    marginBottom: 8,
  },
  freePillDot: { width: 7, height: 7, borderRadius: 4 },
  freePillText: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  greetingEmoji: { fontSize: 28, marginBottom: 2 },
  greetingLine1: { fontSize: 26, fontWeight: '900', letterSpacing: -0.6, lineHeight: 30 },
  greetingLine2: { fontSize: 14, fontWeight: '500', lineHeight: 20 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },

  // Hero card
  heroCard: {
    borderRadius: radii.xxl,
    overflow: 'hidden',
    minHeight: 200,
    shadowColor: '#183324',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 12,
  },
  heroBlobWrap: { position: 'absolute', inset: 0 },
  heroBlob: {
    position: 'absolute', top: -40, right: -40,
    width: 200, height: 200, borderRadius: 100,
  },
  heroBlobSm: {
    position: 'absolute', bottom: -30, left: 20,
    width: 120, height: 120, borderRadius: 60,
  },
  heroContent: { padding: spacing.xl, gap: spacing.md },
  heroIconBox: {
    width: 52, height: 52, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  heroCardTitle: {
    fontSize: 28, fontWeight: '900', color: '#fff',
    lineHeight: 33, letterSpacing: -0.5,
  },
  heroCardSub: { fontSize: 14, color: 'rgba(255,255,255,0.80)', lineHeight: 21, fontWeight: '500' },
  heroBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: radii.xl,
    paddingVertical: 12,
    paddingLeft: 20,
    paddingRight: 14,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 6,
  },
  heroBtnText: { fontSize: 15, fontWeight: '900' },
  heroBtnArrow: {
    width: 28, height: 28, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },

  // Section label
  sectionLabel: {
    fontSize: 11, fontWeight: '800', letterSpacing: 1.4,
    marginBottom: -4,
  },

  // Stepper
  stepsCard: {
    borderRadius: radii.xxl, borderWidth: 1,
    overflow: 'hidden',
  },
  stepRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: 14,
  },
  stepCircle: {
    width: 30, height: 30, borderRadius: 15,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  stepConnector: { position: 'absolute', left: 29, top: 44, width: 2, height: 14 },
  stepLine: { width: 2, flex: 1 },
  stepNum: { fontSize: 13, fontWeight: '800' },
  stepLabel: { flex: 1, fontSize: 14, fontWeight: '700' },
  stepDoneBadge: { borderRadius: radii.full, paddingHorizontal: 10, paddingVertical: 4 },
  stepDoneText: { fontSize: 11, fontWeight: '800' },
  stepActionBtn: {
    borderRadius: radii.lg, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  stepActionText: { fontSize: 12, fontWeight: '800' },

  // Identity card
  idCard: { borderRadius: radii.xxl, borderWidth: 1, padding: spacing.lg, gap: 6 },
  idCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  idCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  idIconBox: { width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  idCardLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  idOnlineDot: { width: 9, height: 9, borderRadius: 5 },
  idValue: { fontSize: 22, fontWeight: '900', letterSpacing: 0.4 },
  idHint: { fontSize: 12, lineHeight: 18, fontWeight: '500' },
  idActions: { flexDirection: 'row', gap: spacing.sm, marginTop: 4 },
  idActionPrimary: {
    flex: 1, minHeight: 44, borderRadius: radii.lg, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
  },
  idActionPrimaryText: { fontSize: 13, fontWeight: '800' },
  idActionSecondary: {
    flex: 1, minHeight: 44, borderRadius: radii.lg, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
  },
  idActionSecondaryText: { fontSize: 13, fontWeight: '800' },

  // Feature grid
  featureGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
  },
  featureCard: {
    width: '47.5%',
    borderRadius: radii.xl, borderWidth: 1,
    padding: spacing.md, gap: 6,
  },
  featureIconWrap: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  featureCardTitle: { fontSize: 14, fontWeight: '900' },
  featureCardDesc: { fontSize: 12, lineHeight: 17, fontWeight: '500' },
  featureLock: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', borderRadius: radii.full,
    paddingHorizontal: 8, paddingVertical: 4, marginTop: 2,
  },
  featureLockText: { fontSize: 10, fontWeight: '700' },

  // Benefits box
  benefitsBox: { borderRadius: radii.xxl, borderWidth: 1, padding: spacing.lg },
  benefitsHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md,
  },
  benefitsTitle: { fontSize: 17, fontWeight: '900' },
  benefitRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1,
  },
  benefitBullet: { width: 7, height: 7, borderRadius: 4, marginTop: 6, flexShrink: 0 },
  benefitText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '600' },

  bottomPad: { height: 20 },
});
