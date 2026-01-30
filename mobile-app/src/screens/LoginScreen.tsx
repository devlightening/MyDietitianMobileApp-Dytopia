import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../auth/AuthContext';
import { colors, spacing } from '../theme';
import { API_BASE_URL } from '../config/api';
import axios from 'axios';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [testingConnectivity, setTestingConnectivity] = useState(false);
  const { login } = useAuth();
  const navigation = useNavigation();

  // Log API base URL and login URL before login
  React.useEffect(() => {
    const loginUrl = `${API_BASE_URL}/api/auth/client/login`;
    console.log('=== Login Screen ===');
    console.log('API_BASE_URL:', API_BASE_URL);
    console.log('Login URL:', loginUrl);
    console.log('===================');
  }, []);

  const [showFixModal, setShowFixModal] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    baseURL: string;
    duration: number;
    errorType?: 'timeout' | 'network' | 'http' | 'unknown';
    statusCode?: number;
    message?: string;
  } | null>(null);

  async function testConnectivity() {
    setTestingConnectivity(true);
    const startTime = Date.now();
    
    // Check if baseURL is localhost on physical device
    const isLocalhost = API_BASE_URL.includes('localhost') || API_BASE_URL.includes('127.0.0.1');
    if (isLocalhost) {
      setShowFixModal(true);
      setTestingConnectivity(false);
      return;
    }
    
    try {
      const response = await axios.get(`${API_BASE_URL}/api/health`, {
        timeout: 5000,
      });
      const duration = Date.now() - startTime;
      
      const result = {
        success: true,
        baseURL: API_BASE_URL,
        duration,
      };
      setTestResult(result);
      
      Alert.alert(
        '✅ Bağlantı Testi Başarılı',
        `Base URL: ${API_BASE_URL}\n` +
        `Süre: ${duration}ms\n` +
        `Durum: ${response.status} OK\n` +
        `Yanıt: ${JSON.stringify(response.data)}`
      );
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      // Determine error type
      let errorType: 'timeout' | 'network' | 'http' | 'unknown' = 'unknown';
      let statusCode: number | undefined;
      let message = error.message || 'Bilinmeyen hata';
      
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        errorType = 'timeout';
        message = 'Bağlantı zaman aşımı (5 saniye)';
      } else if (error.code === 'ERR_NETWORK' || error.message?.includes('Network')) {
        errorType = 'network';
        message = 'Ağ bağlantısı hatası';
      } else if (error.response) {
        errorType = 'http';
        statusCode = error.response.status;
        message = `HTTP ${statusCode}: ${error.response.statusText || 'Sunucu hatası'}`;
      }
      
      const result = {
        success: false,
        baseURL: API_BASE_URL,
        duration,
        errorType,
        statusCode,
        message,
      };
      setTestResult(result);
      
      // Build detailed error message
      let errorDetails = `Base URL: ${API_BASE_URL}\n`;
      errorDetails += `Süre: ${duration}ms\n`;
      errorDetails += `Hata Tipi: ${errorType}\n`;
      if (statusCode) {
        errorDetails += `HTTP Durum: ${statusCode}\n`;
      }
      errorDetails += `Mesaj: ${message}\n\n`;
      
      if (errorType === 'timeout') {
        errorDetails += 'Kontrol edin:\n';
        errorDetails += '• Backend çalışıyor mu?\n';
        errorDetails += '• LAN IP doğru mu?\n';
        errorDetails += '• Firewall port 5000\'i engelliyor mu?';
      } else if (errorType === 'network') {
        errorDetails += 'Kontrol edin:\n';
        errorDetails += '• Telefon ve PC aynı Wi-Fi\'de mi?\n';
        errorDetails += '• Backend 0.0.0.0:5000\'de çalışıyor mu?\n';
        errorDetails += '• EXPO_PUBLIC_API_BASE_URL doğru mu?';
      } else if (errorType === 'http') {
        errorDetails += `Sunucu yanıt verdi ancak hata döndü (${statusCode})`;
      }
      
      Alert.alert('❌ Bağlantı Testi Başarısız', errorDetails);
    } finally {
      setTestingConnectivity(false);
    }
  }

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Hata', 'Email ve şifre gereklidir');
      return;
    }

    // Log login URL before attempting
    const loginUrl = `${API_BASE_URL}/api/auth/client/login`;
    console.log('Attempting login to:', loginUrl);

    setLoading(true);
    try {
      await login(email, password);
    } catch (error: any) {
      // DETAILED ERROR LOGGING
      console.log('=== LOGIN ERROR ===');
      console.log('Error:', error);
      console.log('Response:', error?.response);
      console.log('Status:', error?.response?.status);
      console.log('Data:', error?.response?.data);
      console.log('Message:', error?.message);
      console.log('Code:', error?.code);
      console.log('==================');

      if (error.response?.status === 401) {
        Alert.alert('Giriş Başarısız', 'Email veya şifre hatalı');
      } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        Alert.alert(
          'Bağlantı Zaman Aşımı',
          'Sunucuya ulaşılamıyor. Kontrol edin:\n' +
          '- LAN IP adresi\n' +
          '- Firewall ayarları\n' +
          '- Backend binding (0.0.0.0:5000)\n' +
          '- API_BASE_URL değeri'
        );
      } else if (error.message?.includes('Network') || error.code === 'ERR_NETWORK') {
        Alert.alert(
          'Bağlantı Hatası',
          `Backend'e ulaşılamıyor: ${API_BASE_URL}\n\n` +
          'Kontrol edin:\n' +
          '- LAN IP adresi\n' +
          '- Firewall ayarları\n' +
          '- Backend binding (0.0.0.0:5000)\n' +
          '- API_BASE_URL değeri'
        );
      } else {
        Alert.alert(
          'Sunucu Hatası',
          error.response?.data?.message || error.message || 'Teknik bir hata oluştu'
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>MyDietitian</Text>
        <Text style={styles.subtitle}>Diyet planınıza giriş yapın</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
        />

        <TextInput
          style={styles.input}
          placeholder="Şifre"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => navigation.navigate('Register' as never)} // Routes.Auth.Register
          disabled={loading}
        >
          <Text style={styles.linkText}>
            Hesabınız yok mu? <Text style={styles.linkTextBold}>Kayıt Ol</Text>
          </Text>
        </TouchableOpacity>

        {/* Connectivity Test Button (Dev Only) */}
        {__DEV__ && (
          <TouchableOpacity
            style={[styles.testButton, testingConnectivity && styles.buttonDisabled]}
            onPress={testConnectivity}
            disabled={testingConnectivity || loading}
          >
            <Text style={styles.testButtonText}>
              {testingConnectivity ? 'Test Ediliyor...' : '🔍 Bağlantı Testi'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Fix Steps Modal (shown when localhost detected on device) */}
        <Modal
          visible={showFixModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowFixModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>⚠️ Yapılandırma Hatası</Text>
              <Text style={styles.modalText}>
                Cihazda localhost kullanılamaz. localhost cihazın kendisini işaret eder.
              </Text>
              <Text style={styles.modalSubtitle}>Çözüm Adımları:</Text>
              <Text style={styles.modalStep}>1. PC'nizin LAN IP adresini bulun:</Text>
              <Text style={styles.modalCode}>   Windows: ipconfig</Text>
              <Text style={styles.modalCode}>   Mac/Linux: ifconfig</Text>
              <Text style={styles.modalStep}>2. mobile-app/.env dosyası oluşturun:</Text>
              <Text style={styles.modalCode}>   EXPO_PUBLIC_API_BASE_URL=http://YOUR_IP:5000</Text>
              <Text style={styles.modalStep}>3. Uygulamayı yeniden başlatın:</Text>
              <Text style={styles.modalCode}>   npx expo start --clear</Text>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowFixModal(false)}
              >
                <Text style={styles.modalButtonText}>Tamam</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: 16,
    marginBottom: spacing.md,
    backgroundColor: colors.card,
  },
  button: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  linkText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  linkTextBold: {
    color: colors.primary,
    fontWeight: '600',
  },
  testButton: {
    backgroundColor: colors.textMuted,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  testButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: spacing.md,
  },
  modalText: {
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  modalSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  modalStep: {
    fontSize: 14,
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  modalCode: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: colors.primary,
    backgroundColor: colors.background,
    padding: spacing.xs,
    borderRadius: 4,
    marginLeft: spacing.md,
    marginBottom: spacing.xs,
  },
  modalButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  modalButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
