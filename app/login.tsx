// app/login.tsx
import '@/global.css';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import React, { useMemo, useState } from 'react';
import {                                                    
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from 'react-native';
import { auth, db } from './lib/firebase';

const errorMessage = (code?: string): string => {
  const messages: { [key: string]: string } = {
    'auth/invalid-email': 'Email is invalid.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Invalid credentials. Please try again.',
    'auth/too-many-requests': 'Too many attempts. Try again later.',
  };
  return messages[code || ''] || 'Unable to login. Please try again.';
};

const isEmailValid = (val: string): boolean => /\S+@\S+\.\S+/.test(val);

const Login: React.FC = () => {
  const router = useRouter();
  const { width, height } = useWindowDimensions();

  const isSmallDevice = height < 700;
  const isTablet = width >= 768;

  const responsiveStyles = useMemo(
    () => ({
      logoSize: isSmallDevice ? 70 : isTablet ? 100 : 85,
      brandFontSize: isSmallDevice ? 28 : isTablet ? 42 : 36,
      taglineFontSize: isSmallDevice ? 12 : isTablet ? 16 : 14,
      cardPadding: isTablet ? width * 0.08 : width * 0.06,
      horizontalPadding: isTablet ? width * 0.15 : width * 0.05,
      inputHeight: isSmallDevice ? 52 : isTablet ? 60 : 56,
      buttonHeight: isSmallDevice ? 50 : isTablet ? 58 : 54,
      cardTitleSize: isSmallDevice ? 20 : isTablet ? 28 : 24,
    }),
    [width, height, isSmallDevice, isTablet]
  );

  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorText, setErrorText] = useState<string>('');

  const onSignup = (): void => router.push('/signup');
  const onForgotPassword = (): void => router.push('/forgot-password');
  const togglePasswordVisibility = (): void => setShowPassword(!showPassword);

const handleLogin = async (): Promise<void> => {
  const trimmedEmail = email.trim();
  if (!trimmedEmail || !password) {
    setErrorText('Please enter email and password.');
    return;
  }
  if (! isEmailValid(trimmedEmail)) {
    setErrorText('Please enter a valid email address.');
    return;
  }
  try {
    setLoading(true);
    setErrorText('');
    
    const userCred = await signInWithEmailAndPassword(auth, trimmedEmail, password);
    
    // Fetch user data to check enrollment status
    const userDoc = await getDoc(doc(db, 'users', userCred.user. uid));
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      
      if (userData. enrollmentStatus === 'approved') {
        // User is approved, go to member dashboard
        router.replace('/(member)/home' as any);
      } else if (userData.enrollmentStatus === 'pending') {
        // User has pending enrollment
        router.replace('/(auth)/pending-approval' as any);
      } else {
        // User needs to select gym
        router.replace('/(auth)/gym-selection' as any);
      }
    } else {
      // New user, needs to select gym
      router.replace('/(auth)/gym-selection' as any);
    }
  } catch (err:  any) {
    setErrorText(errorMessage(err?. code));
  } finally {
    setLoading(false);
  }
};
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0a0f1a" />

            {/* Background Accents */}
            <View
              style={[
                styles.accentCircle,
                {
                  width: width * 0.7,
                  height: width * 0.7,
                  borderRadius: (width * 0.7) / 2,
                  top: -width * 0.25,
                  right: -width * 0.2,
                },
              ]}
            />
            <View
              style={[
                styles.accentCircle,
                {
                  width: width * 0.5,
                  height: width * 0.5,
                  borderRadius: (width * 0.5) / 2,
                  backgroundColor: 'rgba(59, 130, 246, 0.06)',
                  bottom: height * 0.1,
                  left: -width * 0.2,
                },
              ]}
            />
            <View
              style={[
                styles.accentCircle,
                {
                  width: width * 0.3,
                  height: width * 0.3,
                  borderRadius: (width * 0.3) / 2,
                  backgroundColor: 'rgba(251, 191, 36, 0.06)',
                  bottom: -width * 0.1,
                  right: width * 0.1,
                },
              ]}
            />

            <ScrollView
              contentContainerStyle={[
                styles.scrollContent,
                {
                  paddingHorizontal: responsiveStyles.horizontalPadding,
                  paddingTop: isSmallDevice ? height * 0.04 : height * 0.08,
                  paddingBottom: height * 0.05,
                },
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bounces={false}
            >
              {/* Header */}
              <View style={styles.headerSection}>
                <View
                  style={[
                    styles.logoCircle,
                    {
                      width: responsiveStyles.logoSize,
                      height: responsiveStyles.logoSize,
                      borderRadius: responsiveStyles.logoSize / 2,
                    },
                  ]}
                >
                  <Ionicons
                    name="barbell-outline"
                    size={isSmallDevice ? 32 : isTablet ? 48 : 40}
                    color="#0a0f1a"
                  />
                </View>

                <Text
                  style={[
                    styles.brandName,
                    {
                      fontSize: responsiveStyles.brandFontSize,
                      marginTop: height * 0.015,
                    },
                  ]}
                >
                  FITCORE
                </Text>

                <Text
                  style={[
                    styles.tagline,
                    {
                      fontSize: responsiveStyles.taglineFontSize,
                      marginTop: height * 0.01,
                    },
                  ]}
                >
                  Train Harder. Get Stronger.
                </Text>
              </View>

              {/* Login Card */}
              <View
                style={[
                  styles.card,
                  {
                    padding: responsiveStyles.cardPadding,
                    maxWidth: isTablet ? 550 : '100%',
                    alignSelf: 'center',
                  },
                ]}
              >
                {/* Card Header */}
                <View style={styles.cardHeader}>
                  <Text
                    style={[
                      styles.cardTitle,
                      {
                        fontSize: responsiveStyles.cardTitleSize,
                      },
                    ]}
                  >
                    Welcome Back
                  </Text>
                  <View style={styles.badge}>
                    <Ionicons name="flash" size={11} color="#0a0f1a" />
                    <Text
                      style={[
                        styles.badgeText,
                        { fontSize: isTablet ? 10 : 9 },
                      ]}
                    >
                      PRO
                    </Text>
                  </View>
                </View>

                <Text
                  style={[
                    styles.cardSubtitle,
                    {
                      marginBottom: height * 0.025,
                      fontSize: isTablet ? 15 : 13,
                    },
                  ]}
                >
                  Sign in to continue your fitness journey
                </Text>

                {/* Email Input */}
                <View
                  style={[
                    styles.inputWrapper,
                    {
                      height: responsiveStyles.inputHeight,
                      marginBottom: height * 0.015,
                    },
                  ]}
                >
                  <View style={styles.inputIconBox}>
                    <Ionicons name="mail-outline" size={20} color="#64748b" />
                  </View>
                  <TextInput
                    placeholder="Email Address"
                    placeholderTextColor="#64748b"
                    style={styles.input}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    value={email}
                    onChangeText={setEmail}
                    editable={!loading}
                    returnKeyType="next"
                  />
                </View>

                {/* Password Input */}
                <View
                  style={[
                    styles.inputWrapper,
                    {
                      height: responsiveStyles.inputHeight,
                      marginBottom: height * 0.01,
                    },
                  ]}
                >
                  <View style={styles.inputIconBox}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color="#64748b"
                    />
                  </View>
                  <TextInput
                    placeholder="Password"
                    placeholderTextColor="#64748b"
                    secureTextEntry={!showPassword}
                    style={[styles.input, styles.passwordInput]}
                    autoCapitalize="none"
                    autoComplete="password"
                    value={password}
                    onChangeText={setPassword}
                    editable={!loading}
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                  />
                  <TouchableOpacity
                    onPress={togglePasswordVisibility}
                    style={styles.eyeButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#64748b"
                    />
                  </TouchableOpacity>
                </View>

                {/* Forgot Password Link */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={onForgotPassword}
                  style={styles.forgotPasswordButton}
                >
                  <Text style={[styles.forgotPasswordText, { fontSize: isTablet ? 14 : 12 }]}>
                    Forgot Password?
                  </Text>
                </TouchableOpacity>

                {/* Error Message */}
                {errorText ? (
                  <View
                    style={[
                      styles.errorBox,
                      { marginBottom: height * 0.015, marginTop: height * 0.01 },
                    ]}
                  >
                    <Ionicons name="alert-circle" size={16} color="#f87171" />
                    <Text style={[styles.errorText, { fontSize: isTablet ? 14 : 12 }]}>
                      {errorText}
                    </Text>
                  </View>
                ) : null}

                {/* Login Button */}
                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    {
                      height: responsiveStyles.buttonHeight,
                      marginBottom: height * 0.02,
                      marginTop: height * 0.015,
                    },
                    loading && styles.buttonDisabled,
                  ]}
                  activeOpacity={0.75}
                  onPress={handleLogin}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#0a0f1a" size="small" />
                  ) : (
                    <>
                      <Text
                        style={[
                          styles.primaryButtonText,
                          { fontSize: isSmallDevice ? 15 : isTablet ? 17 : 16 },
                        ]}
                      >
                        Login
                      </Text>
                      <Ionicons
                        name="arrow-forward"
                        size={isSmallDevice ? 16 : isTablet ? 20 : 18}
                        color="#0a0f1a"
                      />
                    </>
                  )}
                </TouchableOpacity>

                {/* Divider */}
                <View style={[styles.dividerRow, { marginVertical: height * 0.02 }]}>
                  <View style={styles.dividerLine} />
                  <Text style={[styles.dividerText, { fontSize: isTablet ? 13 : 12 }]}>
                    or
                  </Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Social Buttons */}
                <View style={[styles.socialRow, { marginBottom: height * 0.025 }]}>
                  <TouchableOpacity style={styles.socialButton} activeOpacity={0.7}>
                    <Ionicons
                      name="logo-google"
                      size={isTablet ? 24 : 20}
                      color="#e9eef7"
                    />
                  </TouchableOpacity>
                  
                  
                </View>

                {/* Sign Up Link */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={onSignup}
                  style={styles.linkRow}
                >
                  <Text style={[styles.linkText, { fontSize: isTablet ? 15 : 13 }]}>
                    Don't have an account?{' '}
                  </Text>
                  <Text style={[styles.linkAccent, { fontSize: isTablet ? 15 : 13 }]}>
                    Sign up
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0a0f1a',
  },
  container: {
    flex: 1,
    backgroundColor: '#0a0f1a',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  accentCircle: {
    position: 'absolute',
    backgroundColor: 'rgba(74, 222, 128, 0.08)',
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoCircle: {
    backgroundColor: '#4ade80',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4ade80',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  brandName: {
    fontWeight: '900',
    color: '#e9eef7',
    letterSpacing: 4,
  },
  tagline: {
    color: '#94a3b8',
    letterSpacing: 1,
  },
  card: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 16,
    width: '100%',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontWeight: '700',
    color: '#e9eef7',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#4ade80',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  badgeText: {
    color: '#0a0f1a',
    fontWeight: '800',
  },
  cardSubtitle: {
    color: '#94a3b8',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 0,
  },
  inputIconBox: {
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#e9eef7',
    paddingRight: 12,
  },
  passwordInput: {
    paddingRight: 50,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    padding: 8,
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingVertical: 4,
  },
  forgotPasswordText: {
    color: '#4ade80',
    fontWeight: '600',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.25)',
  },
  errorText: {
    color: '#fca5a5',
    flex: 1,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4ade80',
    borderRadius: 14,
    shadowColor: '#4ade80',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontWeight: '700',
    color: '#0a0f1a',
    letterSpacing: 0.5,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
  },
  dividerText: {
    color: '#64748b',
    marginHorizontal: 12,
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
  },
  socialButton: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
  },
  linkText: {
    color: '#94a3b8',
  },
  linkAccent: {
    color: '#4ade80',
    fontWeight: '700',
  },
});

export default Login;
