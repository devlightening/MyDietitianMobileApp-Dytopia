import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <View style={s.wrap}>
        <Text style={s.emoji}>⚠️</Text>
        <Text style={s.title}>Bir şeyler yanlış gitti</Text>
        <Text style={s.sub}>{this.state.error?.message ?? 'Bilinmeyen hata'}</Text>
        <TouchableOpacity style={s.btn} onPress={() => this.setState({ hasError: false, error: null })}>
          <Text style={s.btnTxt}>Tekrar Dene</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emoji: { fontSize: 40, marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '800', color: '#333', marginBottom: 6, textAlign: 'center' },
  sub: { fontSize: 13, color: '#888', marginBottom: 24, textAlign: 'center', lineHeight: 19 },
  btn: { backgroundColor: '#4CAF50', borderRadius: 24, paddingHorizontal: 24, paddingVertical: 10 },
  btnTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
