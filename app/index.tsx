//app/index.tsx
import '@/global.css';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';

const Index: React.FC = () => {
  const router = useRouter();
  const { width, height } = useWindowDimensions();

  // Responsive breakpoints
  const isSmallDevice = height < 700;
  const isTablet = width >= 768;
  const isMedium = width >= 480;

  const responsiveStyles = useMemo(
    () => ({
      logoSize: isSmallDevice ? 90 : isTablet ? 130 : 110,
      brandFontSize: isSmallDevice ? 36 : isTablet ? 52 : 46,
      taglineFontSize: isSmallDevice ? 13 : isTablet ? 18 : 16,
      cardPadding: isTablet ? width * 0.08 : width * 0.06,
      horizontalPadding: isTablet ? width * 0.12 : width * 0.05,
      featureIconSize: isTablet ? 60 : 50,
      buttonHeight: isSmallDevice ? 50 : isTablet ? 58 : 54,
      buttonFontSize: isSmallDevice ? 15 : isTablet ? 18 : 16,
      cardTitleSize: isSmallDevice ? 20 : isTablet ? 30 : 26,
    }),
    [width, height, isSmallDevice, isTablet]
  );

  const onLogin = (): void => router.push('/login');
  const onSignUp = (): void => router.push('/signup');

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Decorative Background Circles */}
        <View
          style={[
            styles.accentCircle,
            { width: width * 0.6, height: width * 0.6, top: -width * 0.2, right: -width * 0.15 },
          ]}
        />
        <View
          style={[
            styles.accentCircle,
            { width: width * 0.5, height: width * 0.5, bottom: -width * 0.1, left: -width * 0.2 },
          ]}
        />

        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View
            style={[
              styles.logoCircle,
              {
                width: responsiveStyles.logoSize,
                height: responsiveStyles.logoSize,
                borderRadius: responsiveStyles.logoSize / 2,
                marginBottom: 16,
              },
            ]}
          >
            <Ionicons name="barbell" size={responsiveStyles.logoSize * 0.5} color="#0a0f1a" />
          </View>
          <Text style={[styles.brandName, { fontSize: responsiveStyles.brandFontSize }]}>
            FITCORE
          </Text>
          <Text
            style={[
              styles.tagline,
              { fontSize: responsiveStyles.taglineFontSize, marginTop: 8, marginBottom: 30 },
            ]}
          >
            Strengthen Your Routine{'\n'}Track Your Wins
          </Text>

          {/* Features Section */}
          <View
            style={[
              styles.featuresRow,
              { marginBottom: 30, paddingHorizontal: responsiveStyles.horizontalPadding },
            ]}
          >
            <View style={styles.featureItem}>
              <View
                style={[
                  styles.featureIcon,
                  {
                    width: responsiveStyles.featureIconSize,
                    height: responsiveStyles.featureIconSize,
                    borderRadius: responsiveStyles.featureIconSize / 2,
                  },
                ]}
              >
                <Ionicons name="trophy" size={responsiveStyles.featureIconSize * 0.5} color="#4ade80" />
              </View>
              <Text style={styles.featureText}>Achievements</Text>
            </View>
            <View style={styles.featureItem}>
              <View
                style={[
                  styles.featureIcon,
                  {
                    width: responsiveStyles.featureIconSize,
                    height: responsiveStyles.featureIconSize,
                    borderRadius: responsiveStyles.featureIconSize / 2,
                  },
                ]}
              >
                <Ionicons name="bar-chart" size={responsiveStyles.featureIconSize * 0.5} color="#4ade80" />
              </View>
              <Text style={styles.featureText}>Analytics</Text>
            </View>
            <View style={styles.featureItem}>
              <View
                style={[
                  styles.featureIcon,
                  {
                    width: responsiveStyles.featureIconSize,
                    height: responsiveStyles.featureIconSize,
                    borderRadius: responsiveStyles.featureIconSize / 2,
                  },
                ]}
              >
                <Ionicons name="people" size={responsiveStyles.featureIconSize * 0.5} color="#4ade80" />
              </View>
              <Text style={styles.featureText}>Community</Text>
            </View>
          </View>
        </View>

        {/* Main Card */}
        <View
          style={[
            styles.card,
            {
              padding: responsiveStyles.cardPadding,
              marginHorizontal: responsiveStyles.horizontalPadding,
            },
          ]}
        >
          <Text style={[styles.cardTitle, { fontSize: responsiveStyles.cardTitleSize }]}>
            Ready to Transform?
          </Text>
          <Text style={styles.cardSubtitle}>
            Join thousands of members achieving their fitness goals with Fitcore.
          </Text>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.primaryButton, { height: responsiveStyles.buttonHeight, marginTop: 24 }]}
            onPress={onLogin}
            activeOpacity={0.8}
          >
            <Text style={[styles.primaryButtonText, { fontSize: responsiveStyles.buttonFontSize }]}>
              Login
            </Text>
            <Ionicons name="arrow-forward" size={20} color="#0a0f1a" />
          </TouchableOpacity>

          {/* Sign Up Button */}
          <TouchableOpacity
            style={[styles.secondaryButton, { height: responsiveStyles.buttonHeight, marginTop: 12 }]}
            onPress={onSignUp}
            activeOpacity={0.8}
          >
            <Text style={[styles.secondaryButtonText, { fontSize: responsiveStyles.buttonFontSize }]}>
              Create Account
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#0a0f1a',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 20,
  },
  accentCircle: {
    position: 'absolute',
    backgroundColor: 'rgba(74, 222, 128, 0.08)',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 10,
  },
  logoCircle: {
    backgroundColor: '#4ade80',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4ade80',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 15,
  },
  brandName: {
    fontWeight: '900',
    color: '#e9eef7',
    letterSpacing: 5,
    textAlign: 'center',
  },
  tagline: {
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 24,
    letterSpacing: 0.5,
  },
  featuresRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
  },
  featureItem: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  featureIcon: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  featureText: {
    color: '#94a3b8',
    fontWeight: '600',
    textAlign: 'center',
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
  cardTitle: {
    fontWeight: '700',
    color: '#e9eef7',
    marginBottom: 8,
  },
  cardSubtitle: {
    color: '#94a3b8',
    lineHeight: 22,
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
  primaryButtonText: {
    fontWeight: '700',
    color: '#0a0f1a',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(148, 163, 184, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontWeight: '600',
    color: '#e9eef7',
  },
});

export default Index;