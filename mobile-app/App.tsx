import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./src/queries/queryClient";
import { AuthProvider } from "./src/auth/AuthContext";
import { I18nProvider } from "./src/context/I18nContext";
import { NotificationProvider } from "./src/context/NotificationContext";
import RootNavigator from "./src/navigation/RootNavigator";
import WidgetSyncBootstrap from "./src/widgets/WidgetSyncBootstrap";
import OfflineBanner from "./src/components/OfflineBanner";

// ─── Error Boundary ───────────────────────────────────────────────────────────
// Prevents the entire app from crashing to a white screen on JS errors.
// Shows a recoverable error screen in development; minimal view in production.

interface ErrorBoundaryState {
  error: Error | null;
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // In production, send to crash reporting service here
    if (__DEV__) {
      console.error("[AppErrorBoundary] Uncaught error:", error.message);
      console.error("[AppErrorBoundary] Component stack:", info.componentStack);
    }
  }

  render() {
    if (this.state.error) {
      if (!__DEV__) {
        // Production: silent recovery attempt
        return (
          <View style={eb.root}>
            <Text style={eb.title}>Bir sorun oluştu</Text>
            <Text style={eb.sub}>Lütfen uygulamayı yeniden başlatın.</Text>
          </View>
        );
      }
      return (
        <ScrollView contentContainerStyle={eb.root}>
          <Text style={eb.title}>⚠ App Error</Text>
          <Text style={eb.msg}>{this.state.error.message}</Text>
          <Text style={eb.stack}>{this.state.error.stack}</Text>
          <TouchableOpacity
            style={eb.btn}
            onPress={() => this.setState({ error: null })}
          >
            <Text style={eb.btnTxt}>Retry</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

const eb = StyleSheet.create({
  root:  { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "#FFF7F1" },
  title: { fontSize: 18, fontWeight: "bold", color: "#D45D63", marginBottom: 8 },
  sub:   { fontSize: 14, color: "rgba(64,42,34,0.68)", textAlign: "center" },
  msg:   { fontSize: 13, color: "#E7A93B", marginBottom: 12, textAlign: "center" },
  stack: { fontSize: 10, color: "rgba(64,42,34,0.42)", fontFamily: "monospace", marginBottom: 20 },
  btn:   { backgroundColor: "#F08A5D", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 16 },
  btnTxt:{ color: "#FFF", fontWeight: "bold", fontSize: 14 },
});

// ─── Root App ─────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <AppErrorBoundary>
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <NotificationProvider>
              <WidgetSyncBootstrap />
              <RootNavigator />
              <OfflineBanner />
            </NotificationProvider>
          </AuthProvider>
        </QueryClientProvider>
      </I18nProvider>
    </AppErrorBoundary>
  );
}
