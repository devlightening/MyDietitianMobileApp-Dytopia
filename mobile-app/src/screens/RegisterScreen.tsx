import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
  StatusBar,
  ActivityIndicator,
  Image,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../auth/AuthContext';
import { Gender } from '../types/auth';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../context/I18nContext';
import { radii, spacing } from '../theme/tokens';
import { BRAND_LOGO } from '../assets/brandAssets';
import ProduceBubble from '../components/decor/ProduceBubble';

const hasUppercase = /[A-ZÇĞİÖŞÜ]/;
const hasLowercase = /[a-zçğıöşü]/;
const hasDigit = /\d/;

function getRegisterErrorMessage(error: any) {
  const data = error?.response?.data;
  const code = data?.code ?? data?.extensions?.code ?? data?.errors?.code;
  const detail = data?.detail || data?.message;

  switch (code) {
    case 'WEAK_PASSWORD':
      return 'Şifre en az 8 karakter, bir büyük harf, bir küçük harf ve bir rakam içermeli.';
    case 'EMAIL_DOMAIN_NOT_ALLOWED':
      return detail || 'Bu email uzantısı desteklenmiyor.';
    case 'INVALID_EMAIL':
      return detail || 'Geçerli bir email adresi gir.';
    case 'REGISTRATION_NOT_ALLOWED':
      return detail || 'Bu email ile kayıt şu anda desteklenmiyor.';
    case 'EMAIL_ALREADY_EXISTS':
    case 'REGISTER_FAILED':
      return detail || 'Bu email ile kayıt oluşturulamadı.';
    default:
      if (error?.code === 'ERR_NETWORK') {
        return 'Sunucuya ulaşılamadı. İnternet bağlantını ve API adresini kontrol et.';
      }
      return detail || error?.message || 'Bir hata oluştu';
  }
}

export default function RegisterScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [gender, setGender] = useState<Gender>(Gender.Male);
  const [birthDate, setBirthDate] = useState(new Date(2000, 0, 1));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigation = useNavigation();
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const backLabel = t.common.back.replace(/^[←\s]+/, '');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 650, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 650, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const passwordRules = {
    minLength: password.length >= 8,
    uppercase: hasUppercase.test(password),
    lowercase: hasLowercase.test(password),
    digit: hasDigit.test(password),
  };
  const isPasswordStrong = Object.values(passwordRules).every(Boolean);
  const isValid = !!fullName.trim() && email.includes('@') && isPasswordStrong;

  async function handleRegister() {
    if (!isValid) {
      Alert.alert('Hata', isPasswordStrong
        ? 'Lütfen tüm alanları doldurun'
        : 'Şifre en az 8 karakter, bir büyük harf, bir küçük harf ve bir rakam içermeli.');
      return;
    }
    const age = new Date().getFullYear() - birthDate.getFullYear();
    if (age < 13) {
      Alert.alert('Hata', 'En az 13 yaşında olmalısınız');
      return;
    }
    setLoading(true);
    try {
      await register(email, password, fullName, gender, birthDate.toISOString().split('T')[0]);
    } catch (e: any) {
      Alert.alert('Kayıt Başarısız', getRegisterErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  const genderOpts: { v: Gender; l: string }[] = [
    { v: Gender.Male, l: t.auth.genderMale },
    { v: Gender.Female, l: t.auth.genderFemale },
    { v: Gender.Other, l: t.auth.genderOther },
  ];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[s.outer, { backgroundColor: theme.bg }]}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />
      <ProduceBubble
        icon="food-apple-outline"
        iconSize={34}
        iconColor={`${theme.primary}42`}
        style={[s.topGlow, { backgroundColor: theme.primaryGlow }]}
      />
      <ProduceBubble
        icon="fruit-pear"
        iconSize={38}
        iconColor={`${theme.primary}46`}
        style={[s.bottomGlow, { backgroundColor: theme.emeraldGlow }]}
      />

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <TouchableOpacity
            style={[s.back, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderEmerald }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.78}
          >
            <View style={[s.backIconWrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="arrow-back" size={17} color={theme.primaryDark} />
            </View>
            <Text style={[s.backTxt, { color: theme.primaryDark }]}>{backLabel}</Text>
          </TouchableOpacity>

          <View style={[s.heroCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={s.heroTop}>
              <View style={[s.logoWrap, { backgroundColor: theme.primaryLight, borderColor: theme.primary + '35' }]}>
                <Image source={BRAND_LOGO} style={s.logoImage} resizeMode="contain" fadeDuration={0} />
              </View>
              <View style={[s.heroBadge, { backgroundColor: theme.surfaceElevated }]}>
                <Text style={[s.heroBadgeText, { color: theme.emerald }]}>Taze bir başlangıç</Text>
              </View>
            </View>

            <Text style={[s.title, { color: theme.text }]}>{t.auth.registerTitle}</Text>
            <Text style={[s.subTxt, { color: theme.textSub }]}>{t.auth.registerSubtitle}</Text>
          </View>

          <View style={[s.card, { backgroundColor: theme.glass, borderColor: theme.glassBorder }]}>
            <View style={s.field}>
              <Text style={[s.lbl, { color: theme.textSub }]}>{t.auth.fullName}</Text>
              <TextInput
                style={[s.inp, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, color: theme.text }]}
                placeholder="Adınız Soyadınız"
                placeholderTextColor={theme.textMuted}
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                editable={!loading}
              />
            </View>

            <View style={s.field}>
              <Text style={[s.lbl, { color: theme.textSub }]}>{t.auth.email}</Text>
              <TextInput
                style={[s.inp, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, color: theme.text }]}
                placeholder="email@example.com"
                placeholderTextColor={theme.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading}
                autoCorrect={false}
              />
            </View>

            <View style={s.field}>
              <Text style={[s.lbl, { color: theme.textSub }]}>{t.auth.password}</Text>
              <View style={[s.pwRow, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                <TextInput
                  style={[s.pwInp, { color: theme.text }]}
                  placeholder="En az 8 karakter, Aa ve 1 rakam"
                  placeholderTextColor={theme.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPw}
                  editable={!loading}
                  autoCorrect={false}
                />
                <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPw((v) => !v)}>
                  <Ionicons name={showPw ? 'eye-outline' : 'eye-off-outline'} size={18} color={theme.textMuted} />
                </TouchableOpacity>
              </View>
              <Text style={[s.passwordHint, { color: isPasswordStrong ? theme.emerald : theme.textMuted }]}>
                En az 8 karakter, büyük harf, küçük harf ve rakam
              </Text>
            </View>

            <View style={s.field}>
              <Text style={[s.lbl, { color: theme.textSub }]}>{t.auth.gender}</Text>
              <View style={s.genderRow}>
                {genderOpts.map(({ v, l }) => (
                  <TouchableOpacity
                    key={v}
                    style={[
                      s.genderPill,
                      { borderColor: theme.border, backgroundColor: theme.surfaceElevated },
                      gender === v && { backgroundColor: theme.primary, borderColor: theme.primary },
                    ]}
                    onPress={() => setGender(v)}
                    disabled={loading}
                  >
                    <Text style={[s.genderTxt, { color: theme.text }, gender === v && { color: '#FFF' }]}>
                      {l}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={s.field}>
              <Text style={[s.lbl, { color: theme.textSub }]}>{t.auth.birthDate}</Text>
              <TouchableOpacity
                style={[s.dateBtn, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
                onPress={() => setShowDatePicker(true)}
                disabled={loading}
              >
                <Ionicons name="calendar-outline" size={16} color={theme.primaryDark} />
                <Text style={[s.dateTxt, { color: theme.text }]}>
                  {birthDate.toLocaleDateString('tr-TR')}
                </Text>
              </TouchableOpacity>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={birthDate}
                mode="date"
                display="spinner"
                onChange={(_event: any, d?: Date) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (d) setBirthDate(d);
                }}
                maximumDate={new Date()}
              />
            )}

            <TouchableOpacity
              style={[
                s.regBtn,
                { backgroundColor: theme.primary, shadowColor: theme.primaryGlow },
                (!isValid || loading) && s.btnDis,
              ]}
              onPress={handleRegister}
              disabled={!isValid || loading}
              activeOpacity={0.85}
            >
              {loading ? <ActivityIndicator color="#FFF" size="small" /> : (
                <>
                  <Text style={s.regBtnTxt}>{t.auth.registerBtn}</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFF" />
                </>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={s.link}
            onPress={() => navigation.navigate('Login' as never)}
            disabled={loading}
          >
            <Text style={[s.linkTxt, { color: theme.textSub }]}>
              {t.auth.hasAccount}{' '}
              <Text style={[s.linkBold, { color: theme.primary }]}>{t.auth.goToLogin}</Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  outer: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xl },
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

  back: {
    alignSelf: 'flex-start',
    marginBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
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
  backTxt: { fontSize: 14, fontWeight: '900' },

  heroCard: {
    borderRadius: radii.xxl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    shadowColor: '#183324',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 28,
    elevation: 10,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.base },
  heroBadge: { borderRadius: radii.full, paddingHorizontal: 12, paddingVertical: 8 },
  heroBadgeText: { fontSize: 12, fontWeight: '800' },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  logoImage: { width: 66, height: 66, borderRadius: 20 },

  title: { fontSize: 34, fontWeight: '900', letterSpacing: -0.5, marginBottom: spacing.xs },
  subTxt: { fontSize: 14, fontWeight: '500', marginBottom: 0, lineHeight: 20 },

  card: {
    borderRadius: radii.xxl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  field: { marginBottom: spacing.base },
  lbl: { fontSize: 12, fontWeight: '700', marginBottom: spacing.xs, letterSpacing: 0.3 },
  inp: { height: 52, borderWidth: 1.5, borderRadius: radii.xl, paddingHorizontal: spacing.md, fontSize: 15 },
  pwRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: radii.xl, height: 52 },
  pwInp: { flex: 1, height: 52, paddingHorizontal: spacing.md, fontSize: 15 },
  eyeBtn: { paddingHorizontal: spacing.md, height: 52, justifyContent: 'center' },
  passwordHint: { marginTop: 7, fontSize: 11.5, lineHeight: 16, fontWeight: '700' },

  genderRow: { flexDirection: 'row', gap: spacing.sm },
  genderPill: { flex: 1, paddingVertical: 12, borderRadius: radii.lg, borderWidth: 1.5, alignItems: 'center' },
  genderTxt: { fontSize: 13, fontWeight: '700' },

  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderWidth: 1.5,
    borderRadius: radii.xl,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  dateTxt: { fontSize: 15, fontWeight: '500' },

  regBtn: {
    marginTop: spacing.sm,
    paddingVertical: 16,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  btnDis: { opacity: 0.5, shadowOpacity: 0, elevation: 0 },
  regBtnTxt: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },

  link: { alignItems: 'center', paddingVertical: spacing.xs },
  linkTxt: { fontSize: 14 },
  linkBold: { fontWeight: '700' },
});

