import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Image,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { radii, spacing } from "../theme/tokens";
import { BRAND_LOGO } from "../assets/brandAssets";

export default function PremiumActivationScreen() {
  const nav = useNavigation();
  const { activatePremium } = useAuth();
  const { theme, isDark } = useTheme();

  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Entrance
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(32)).current;
  // Icon bounce
  const iconScale = useRef(new Animated.Value(0.7)).current;
  // Success check scale
  const successScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 340, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, damping: 18, stiffness: 120, useNativeDriver: true }),
      Animated.spring(iconScale, { toValue: 1, damping: 12, stiffness: 140, useNativeDriver: true }),
    ]).start();
  }, []);

  async function onActivate() {
    setLoading(true);
    setMsg(null);
    setIsSuccess(false);
    successScale.setValue(0);
    try {
      const res = await activatePremium(key.trim());
      setMsg(res.message);
      setIsSuccess(res.success);
      if (res.success) {
        // Animate success check in
        Animated.spring(successScale, { toValue: 1, damping: 10, stiffness: 160, useNativeDriver: true }).start();
        setTimeout(() => (nav as any).goBack(), 1800);
      }
    } finally {
      setLoading(false);
    }
  }

  const isDisabled = loading || key.trim().length < 4;

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.bg} />

      {/* Subtle tint backdrop */}
      <View style={[s.backdrop, { backgroundColor: theme.primaryLight }]} />

      <Animated.View
        style={[
          s.card,
          {
            backgroundColor: theme.surface,
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : theme.border,
            borderWidth: isDark ? 0.5 : 1,
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Brand logo */}
        <Animated.View
          style={[
            s.iconWrap,
            {
              backgroundColor: theme.accentGold + '1A',
              borderColor: theme.accentGold + '50',
            },
            { transform: [{ scale: iconScale }] },
          ]}
        >
          <Image
            source={BRAND_LOGO}
            resizeMode="contain"
            fadeDuration={0}
            style={s.iconLogo}
          />
        </Animated.View>

        {/* Title */}
        <Text style={[s.title, { color: theme.text }]}>Premium'u Aktifleştir</Text>
        <Text style={[s.sub, { color: theme.textSub }]}>
          Diyetisyeninin sana verdiği{" "}
          <Text style={[s.subBold, { color: theme.text }]}>Erişim Anahtarı</Text>'nı gir.{"\n"}
          Planlarına, notlarına ve klinik tariflere anında erişim kazanırsın.
        </Text>

        {/* Success state */}
        {isSuccess && (
          <Animated.View
            style={[
              s.successWrap,
              { backgroundColor: theme.success + '12', borderColor: theme.success + '40' },
              { transform: [{ scale: successScale }] },
            ]}
          >
          <Text style={s.successCheck}>✓</Text>
            <Text style={[s.successTxt, { color: theme.success }]}>{msg}</Text>
          </Animated.View>
        )}

        {/* Input */}
        {!isSuccess && (
          <View style={s.inputWrap}>
            <TextInput
              value={key}
              onChangeText={(t) => {
                setKey(t);
                if (msg) setMsg(null);
              }}
              placeholder="Erişim Anahtarını gir"
              placeholderTextColor={theme.textMuted}
              style={[
                s.input,
                {
                  backgroundColor: theme.surfaceElevated,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={isDisabled ? undefined : onActivate}
            />
            {key.length > 0 && (
              <Text style={[s.inputHint, { color: theme.textMuted }]}>
                {key.trim().length} karakter girdin
              </Text>
            )}
          </View>
        )}

        {/* Error message */}
        {!isSuccess && msg && (
          <View style={[s.errorWrap, { backgroundColor: theme.error + '10', borderColor: theme.error + '35' }]}>
          <Text style={[s.errorTxt, { color: theme.error }]}>× {msg}</Text>
          </View>
        )}

        {/* CTA */}
        {!isSuccess && (
          <TouchableOpacity
            style={[
              s.btn,
              { backgroundColor: theme.primary, shadowColor: theme.primary },
              isDisabled && s.btnDisabled,
            ]}
            onPress={onActivate}
            disabled={isDisabled}
            activeOpacity={0.82}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={s.btnText}>Aktifleştir</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Divider */}
        <View style={[s.divider, { backgroundColor: theme.borderLight }]} />

        {/* Close */}
        <TouchableOpacity
          style={s.close}
          onPress={() => (nav as any).goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
        >
          <Text style={[s.closeText, { color: theme.textMuted }]}>Kapat</Text>
        </TouchableOpacity>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.5,
  },

  card: {
    borderRadius: radii.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },

  iconWrap: {
    width: 76,
    height: 76,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  iconLogo: {
    width: 42,
    height: 42,
    borderRadius: 12,
  },

  title: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.3,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  sub: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 20,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  subBold: { fontWeight: "800" },

  successWrap: {
    alignItems: "center",
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
    width: "100%",
  },
  successCheck: { fontSize: 36 },
  successTxt: { fontSize: 15, fontWeight: "900", textAlign: "center" },

  inputWrap: {
    width: "100%",
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  input: {
    borderRadius: radii.lg,
    borderWidth: 1.5,
    paddingHorizontal: spacing.md,
    paddingVertical: 16,
    fontWeight: "800",
    fontSize: 16,
    textAlign: "center",
    letterSpacing: 2,
    width: "100%",
  },
  inputHint: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "right",
  },

  errorWrap: {
    marginTop: spacing.sm,
    width: "100%",
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1,
  },
  errorTxt: { fontSize: 13, fontWeight: "800", textAlign: "center" },

  btn: {
    marginTop: spacing.md,
    borderRadius: radii.xl,
    paddingVertical: 16,
    alignItems: "center",
    width: "100%",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  btnDisabled: { opacity: 0.4, shadowOpacity: 0, elevation: 0 },
  btnText: {
    color: "#FFF",
    fontWeight: "900",
    fontSize: 15,
    letterSpacing: 0.4,
  },

  divider: {
    height: 1,
    width: "100%",
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  close: { alignItems: "center" },
  closeText: { fontWeight: "800", fontSize: 14 },
});

