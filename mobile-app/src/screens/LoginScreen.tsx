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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../context/I18nContext';
import { spacing, radii } from '../theme/tokens';
import { API_BASE_URL } from '../config/api';
import ProduceBubble from '../components/decor/ProduceBubble';

let Device: any = null;
try { Device = require('expo-device'); } catch {}

const BENEFITS = [
  { icon: 'calendar-clear-outline', label: 'Plan görünümü' },
  { icon: 'restaurant-outline', label: 'Akıllı tarifler' },
  { icon: 'fitness-outline', label: 'Ölçüm takibi' },
] as const;

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [testingConn, setTestingConn] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);

  const { login } = useAuth();
  const navigation = useNavigation();
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();

  const isValid = useMemo(() => email.trim().includes('@') && password.trim().length >= 6, [email, password]);

  async function testConnectivity() {
    setTestingConn(true);
    const isPhysical = Device?.isDevice === true;
    const isLocal = API_BASE_URL.includes('localhost') || API_BASE_URL.includes('127.0.0.1');

    if (isPhysical && isLocal) {
      Alert.alert('Yapılandırma', 'Fiziksel cihazda localhost yerine bilgisayarınızın IP adresini kullanmalısınız.');
      setTestingConn(false);
      return;
    }

    try {
      const startedAt = Date.now();
      const result = await axios.get(`${API_BASE_URL}/api/health`, { timeout: 5000 });
      Alert.alert('Bağlantı başarılı', `${API_BASE_URL}\n${Date.now() - startedAt} ms · ${result.status}`);
    } catch (error: any) {
      Alert.alert('Bağlantı hatası', `${API_BASE_URL}\n${error.message}`);
    } finally {
      setTestingConn(false);
    }
  }

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
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={18} color={theme.primaryDark} />
          <Text style={[s.backText, { color: theme.primaryDark }]}>{t.common.back}</Text>
        </TouchableOpacity>

        <View style={[s.heroCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={s.heroHeader}>
            <View style={[s.brandMark, { backgroundColor: theme.primaryLight, borderColor: theme.borderEmerald }]}>
              <Ionicons name="leaf" size={22} color={theme.primaryDark} />
            </View>
            <View style={[s.heroTag, { backgroundColor: theme.surfaceElevated }]}>
              <Text style={[s.heroTagText, { color: theme.emerald }]}>Healthy routine</Text>
            </View>
          </View>

          <Text style={[s.title, { color: theme.text }]}>{t.auth.loginTitle}</Text>
          <Text style={[s.subtitle, { color: theme.textSub }]}>{t.auth.loginSubtitle}</Text>

          <View style={s.benefitsRow}>
            {BENEFITS.map((benefit) => (
              <View key={benefit.label} style={[s.benefitChip, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderLight }]}>
                <Ionicons name={benefit.icon} size={14} color={theme.primaryDark} />
                <Text style={[s.benefitText, { color: theme.textSub }]}>{benefit.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[s.formCard, { backgroundColor: theme.glass, borderColor: theme.glassBorder }]}>
          <View style={s.field}>
            <Text style={[s.label, { color: theme.textMuted }]}>{t.auth.email}</Text>
            <View style={[
              s.inputShell,
              { backgroundColor: theme.surface, borderColor: focusedField === 'email' ? theme.primary : theme.border },
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
              { backgroundColor: theme.surface, borderColor: focusedField === 'password' ? theme.primary : theme.border },
            ]}>
              <Ionicons name="lock-closed-outline" size={18} color={focusedField === 'password' ? theme.primary : theme.textMuted} />
              <TextInput
                style={[s.input, { color: theme.text }]}
                placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
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
            <Text style={s.primaryBtnText}>{loading ? 'Giriş yapılıyor...' : t.auth.loginBtn}</Text>
            {!loading && <Ionicons name="arrow-forward" size={18} color="#FFF" />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.secondaryBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => navigation.navigate('Register' as never)}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={[s.secondaryBtnText, { color: theme.primaryDark }]}>
              {t.auth.noAccount} <Text style={s.secondaryBtnBold}>{t.auth.registerBtn}</Text>
            </Text>
          </TouchableOpacity>

          {__DEV__ && (
            <TouchableOpacity
              style={[s.devBtn, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}
              onPress={testConnectivity}
              disabled={loading || testingConn}
              activeOpacity={0.75}
            >
              <Ionicons name="wifi-outline" size={15} color={theme.textMuted} />
              <Text style={[s.devText, { color: theme.textMuted }]}>
                {testingConn ? 'Bağlantı test ediliyor...' : 'API bağlantısını test et'}
              </Text>
            </TouchableOpacity>
          )}
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
    paddingTop: spacing.xl + 10,
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
    gap: 8,
    marginBottom: spacing.lg,
  },
  backText: { fontSize: 14, fontWeight: '800' },

  heroCard: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    shadowColor: '#183324',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 28,
    elevation: 10,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  brandMark: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  heroTag: {
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroTagText: { fontSize: 12, fontWeight: '800' },
  title: {
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 36,
    letterSpacing: -1,
    marginBottom: spacing.sm,
  },
  subtitle: { fontSize: 15, lineHeight: 22, marginBottom: spacing.lg },
  benefitsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  benefitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  benefitText: { fontSize: 12, fontWeight: '700' },

  formCard: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    padding: spacing.lg,
  },
  field: { marginBottom: spacing.base },
  label: { fontSize: 12, fontWeight: '800', marginBottom: 8, letterSpacing: 0.5 },
  inputShell: {
    minHeight: 56,
    borderWidth: 1.3,
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
    minHeight: 56,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
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
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900' },

  secondaryBtn: {
    minHeight: 52,
    borderRadius: radii.xl,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  secondaryBtnBold: { fontWeight: '900' },

  devBtn: {
    marginTop: spacing.md,
    minHeight: 46,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  devText: { fontSize: 12, fontWeight: '700' },
});

