import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../auth/AuthContext";
import { colors, radii, shadows, spacing } from "../theme";

export default function PremiumActivationScreen() {
  const nav = useNavigation();
  const { activatePremium } = useAuth();

  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onActivate() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await activatePremium(key.trim());
      setMsg(res.message);
      if (res.success) {
        setTimeout(() => (nav as any).goBack(), 500);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      <View style={[styles.card, shadows.soft]}>
        <Text style={styles.title}>Premium Activation</Text>
        <Text style={styles.sub}>
          Diyetisyeninin verdiği Access Key ile premium’u aç. Bu ekran asla “zorla” gelmez — sen isteyince açılır.
        </Text>

        <TextInput
          value={key}
          onChangeText={setKey}
          placeholder="Enter access key"
          placeholderTextColor={colors.subtle}
          style={[styles.input, shadows.subtle]}
          autoCapitalize="characters"
        />

        <TouchableOpacity
          style={[styles.btn, shadows.soft]}
          onPress={onActivate}
          disabled={loading || key.trim().length < 4}
        >
          {loading ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Text style={styles.btnText}>Activate</Text>
          )}
        </TouchableOpacity>

        {msg ? <Text style={styles.msg}>{msg}</Text> : null}

        <TouchableOpacity style={styles.close} onPress={() => (nav as any).goBack()}>
          <Text style={styles.closeText}>Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.oat,
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
  },
  title: { fontSize: 18, fontWeight: "900", color: colors.text },
  sub: { marginTop: 10, fontSize: 12, color: colors.muted, fontWeight: "700", lineHeight: 18 },

  input: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontWeight: "800",
    color: colors.text,
  },

  btn: {
    marginTop: spacing.lg,
    borderRadius: radii.xl,
    paddingVertical: 16,
    alignItems: "center",
    backgroundColor: "rgba(244,211,94,0.40)",
    borderWidth: 1,
    borderColor: "rgba(244,211,94,0.55)",
  },
  btnText: { color: colors.text, fontWeight: "900", letterSpacing: 0.6 },

  msg: { marginTop: spacing.md, color: colors.muted, fontWeight: "800" },

  close: { marginTop: spacing.lg, alignItems: "center" },
  closeText: { color: colors.muted, fontWeight: "900" },
});
