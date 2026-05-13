import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../context/I18nContext';
import { spacing, radii } from '../theme/tokens';
import { BRAND_LOGO } from '../assets/brandAssets';
import ProduceBubble from '../components/decor/ProduceBubble';

const BENEFITS = [
  { icon: 'calendar-clear-outline', label: 'Plan' },
  { icon: 'restaurant-outline', label: 'Mutfak' },
  { icon: 'chatbubbles-outline', label: 'Notlar' },
] as const;

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);

  const { login } = useAuth();
  const navigation = useNavigation();
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();

  const isValid = useMemo(() => email.trim().includes('@') && password.trim().length >= 6, [email, password]);
  const backLabel = t.common.back.replace(/^[←\s]+/, '');

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Hata', 'Email ve şifre gerekli');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
    } catch (error: any) {
      if (error.response?.status === 401) {
        Alert.alert('Giriş başarısız', 'Email veya şifre hatalı');
      } else {
        Alert.alert('Hata', error.response?.data?.detail || error.response?.data?.message || error.message || 'Teknik hata');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[s.root, { backgroundColor: theme.bg }]}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />

      <ProduceBubble
        icon="food-apple-outline"
        iconSize={34}
        iconColor={`${theme.primary}42`}
        style={[s.topGlow, { backgroundColor: theme.primaryGlow }]}
      />
      <ProduceBubble
        icon="carrot"
        iconSize={38}
        iconColor={`${theme.primary}46`}
        style={[s.bottomGlow, { backgroundColor: theme.emeraldGlow }]}
      />
      <ProduceBubble
        icon="leaf"
        iconSize={22}
        iconColor={`${theme.primary}36`}
        style={[s.midGlow, { backgroundColor: `${theme.accentCyan}16` }]}
      />

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          style={[s.backBtn, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderEmerald }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.78}
        >
          <View style={[s.backIconWrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="arrow-back" size={17} color={theme.primaryDark} />
          </View>
          <Text style={[s.backText, { color: theme.primaryDark }]}>{backLabel}</Text>
        </TouchableOpacity>

        <View style={[s.heroCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[s.heroGlow, { backgroundColor: theme.primaryGlow }]} />
          <View style={s.heroHeader}>
            <View style={[s.brandMark, { backgroundColor: theme.primaryLight, borderColor: theme.borderEmerald }]}>
              <Image source={BRAND_LOGO} style={s.brandLogo} resizeMode="contain" fadeDuration={0} />
            </View>
            <View style={[s.heroTag, { backgroundColor: theme.surfaceElevated }]}>
              <Text style={[s.heroTagText, { color: theme.emerald }]}>Dytopia</Text>
            </View>
          </View>

          <Text style={[s.title, { color: theme.text }]}>{t.auth.loginTitle}</Text>
          <Text style={[s.subtitle, { color: theme.textSub }]}>{t.auth.loginSubtitle}</Text>

          <View style={[s.summaryBand, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderLight }]}>
            <View style={s.summaryCopy}>
              <Text style={[s.summaryEyebrow, { color: theme.textMuted }]}>KİŞİSEL AKIŞ</Text>
              <Text style={[s.summaryTitle, { color: theme.text }]}>Planın kaldığı yerden devam eder</Text>
            </View>
            <View style={[s.summaryIcon, { backgroundColor: theme.primaryLight }]}>
              <Ionicons name="shield-checkmark-outline" size={18} color={theme.primaryDark} />
            </View>
          </View>

          <View style={s.benefitsRow}>
            {BENEFITS.map((benefit) => (
              <View key={benefit.label} style={[s.benefitChip, { backgroundColor: theme.primaryLight, borderColor: theme.borderEmerald }]}>
                <Ionicons name={benefit.icon} size={13} color={theme.primaryDark} />
                <Text style={[s.benefitText, { color: theme.textSub }]}>{benefit.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[s.formCard, { backgroundColor: theme.glass, borderColor: theme.glassBorder }]}>
          <View style={s.formHeader}>
            <View>
              <Text style={[s.formEyebrow, { color: theme.primaryDark }]}>GÜVENLİ GİRİŞ</Text>
              <Text style={[s.formTitle, { color: theme.text }]}>Hesabına eriş</Text>
            </View>
            <View style={[s.lockBadge, { backgroundColor: theme.primaryLight, borderColor: theme.borderEmerald }]}>
              <Ionicons name="lock-closed" size={15} color={theme.primaryDark} />
            </View>
          </View>

          <View style={s.field}>
            <Text style={[s.label, { color: theme.textMuted }]}>{t.auth.email}</Text>
            <View style={[
              s.inputShell,
              { backgroundColor: theme.surfaceElevated, borderColor: focusedField === 'email' ? theme.primary : theme.border },
            ]}>
              <Ionicons name="mail-outline" size={18} color={focusedField === 'email' ? theme.primary : theme.textMuted} />
              <TextInput
                style={[s.input, { color: theme.text }]}
                placeholder="email@example.com"
                placeholderTextColor={theme.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                editable={!loading}
              />
            </View>
          </View>

          <View style={s.field}>
            <Text style={[s.label, { color: theme.textMuted }]}>{t.auth.password}</Text>
            <View style={[
              s.inputShell,
              { backgroundColor: theme.surfaceElevated, borderColor: focusedField === 'password' ? theme.primary : theme.border },
            ]}>
              <Ionicons name="lock-closed-outline" size={18} color={focusedField === 'password' ? theme.primary : theme.textMuted} />
              <TextInput
                style={[s.input, { color: theme.text }]}
                placeholder="••••••••"
                placeholderTextColor={theme.textMuted}
                secureTextEntry={!showPw}
                autoCorrect={false}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                editable={!loading}
              />
              <TouchableOpacity onPress={() => setShowPw((v) => !v)} disabled={loading} style={s.eyeBtn}>
                <Ionicons name={showPw ? 'eye-outline' : 'eye-off-outline'} size={18} color={theme.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[
              s.primaryBtn,
              { backgroundColor: theme.primary, shadowColor: theme.primaryGlow },
              (!isValid || loading) && s.disabledBtn,
            ]}
            onPress={handleLogin}
            disabled={!isValid || loading}
            activeOpacity={0.88}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Text style={s.primaryBtnText}>{t.auth.loginBtn}</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFF" />
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.secondaryBtn, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
            onPress={() => navigation.navigate('Register' as never)}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={[s.secondaryBtnText, { color: theme.primaryDark }]}>
              {t.auth.noAccount} <Text style={s.secondaryBtnBold}>{t.auth.registerBtn}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl + 4,
    paddingBottom: spacing.xxxl,
  },

  topGlow: {
    position: 'absolute',
    top: -90,
    right: -70,
    width: 240,
    height: 240,
    borderRadius: 120,
    opacity: 0.95,
  },
  bottomGlow: {
    position: 'absolute',
    bottom: -90,
    left: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    opacity: 0.82,
  },
  midGlow: {
    position: 'absolute',
    top: '48%',
    right: 18,
    width: 92,
    height: 92,
    borderRadius: 46,
    opacity: 0.7,
  },

  backBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: spacing.base,
    borderWidth: 1,
    borderRadius: radii.full,
    paddingLeft: 6,
    paddingRight: 14,
    paddingVertical: 6,
  },
  backIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { fontSize: 14, fontWeight: '900' },

  heroCard: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    shadowColor: '#183324',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 28,
    elevation: 10,
  },
  heroGlow: {
    position: 'absolute',
    top: -76,
    right: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    opacity: 0.5,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  brandMark: {
    width: 62,
    height: 62,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  brandLogo: { width: 56, height: 56, borderRadius: 18 },
  heroTag: {
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroTagText: { fontSize: 12, fontWeight: '800' },
  title: {
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 38,
    letterSpacing: -0.8,
    marginBottom: spacing.sm,
  },
  subtitle: { fontSize: 15, lineHeight: 23, marginBottom: spacing.base, maxWidth: 300 },
  summaryBand: {
    minHeight: 68,
    borderWidth: 1,
    borderRadius: radii.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  summaryCopy: { flex: 1 },
  summaryEyebrow: { fontSize: 10.5, fontWeight: '900', letterSpacing: 1.1, marginBottom: 3 },
  summaryTitle: { fontSize: 14, lineHeight: 18, fontWeight: '900' },
  summaryIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  benefitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radii.full,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  benefitText: { fontSize: 11.5, fontWeight: '800' },

  formCard: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.1,
    shadowRadius: 30,
    elevation: 8,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  formEyebrow: {
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginBottom: 4,
  },
  formTitle: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
    letterSpacing: -0.35,
  },
  lockBadge: {
    width: 38,
    height: 38,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: { marginBottom: spacing.base },
  label: { fontSize: 12, fontWeight: '900', marginBottom: 8, letterSpacing: 0.4 },
  inputShell: {
    minHeight: 58,
    borderWidth: 1.5,
    borderRadius: radii.xl,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 14,
  },
  eyeBtn: {
    width: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },

  primaryBtn: {
    minHeight: 58,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 22,
    elevation: 10,
  },
  disabledBtn: {
    opacity: 0.55,
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryBtnText: { color: '#FFF', fontSize: 17, fontWeight: '900' },

  secondaryBtn: {
    minHeight: 54,
    borderRadius: radii.xl,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  secondaryBtnBold: { fontWeight: '900' },
});

