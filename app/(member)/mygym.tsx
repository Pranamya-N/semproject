import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { Gym } from '../types';

const { width, height } = Dimensions.get('window');
const isSmall = height < 700;

const MyGym: React.FC = () => {
  const { userData, refreshUserData } = useAuth();
  const router = useRouter();
  const [gym, setGym] = useState<Gym | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isCheckedIn, setIsCheckedIn] = useState<boolean>(false);
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [sessionsThisMonth, setSessionsThisMonth] = useState<number>(0);
  const [totalDuration, setTotalDuration] = useState<number>(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    checkEnrollmentAndFetchGym();
    loadStats();
  }, [userData]);

  const checkEnrollmentAndFetchGym = async () => {
    // Redirect based on enrollment status
    if (userData?.enrollmentStatus === 'pending') {
      router.replace('/pending-approval');
      return;
    }

    if (userData?.enrollmentStatus === 'none' || !userData?.gymId) {
      setLoading(false);
      return;
    }

    if (userData?.enrollmentStatus === 'approved' && userData?.gymId) {
      await fetchGymData(userData.gymId);
    }

    setLoading(false);
  };

  const fetchGymData = async (gymId: string) => {
    try {
      const gymDoc = await getDoc(doc(db, 'gyms', gymId));
      if (gymDoc.exists()) {
        setGym({
          id: gymDoc.id,
          ...gymDoc.data(),
          createdAt: gymDoc.data().createdAt?.toDate() || new Date(),
        } as Gym);
      }
    } catch (error) {
      console.error('Error fetching gym:', error);
    }
  };

  const loadStats = async () => {
    try {
      const lastCheckInDate = await AsyncStorage.getItem('lastCheckInDate');
      const savedStreak = Number(await AsyncStorage.getItem('streak')) || 0;
      const savedSessions = Number(await AsyncStorage.getItem('sessionsThisMonth')) || 0;
      const savedDuration = Number(await AsyncStorage.getItem('totalDuration')) || 0;

      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();

      if (lastCheckInDate === yesterday) {
        setStreak(savedStreak);
      } else if (lastCheckInDate === today) {
        setStreak(savedStreak);
      } else {
        setStreak(0);
      }

      setSessionsThisMonth(savedSessions);
      setTotalDuration(savedDuration);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleCheckInOut = async () => {
    if (!isCheckedIn) {
      const now = new Date();
      setIsCheckedIn(true);
      timerRef.current = setInterval(() => setTimerSeconds(prev => prev + 1), 1000);

      const lastCheckInDate = await AsyncStorage.getItem('lastCheckInDate');
      const today = now.toDateString();
      const yesterday = new Date(now.getTime() - 86400000).toDateString();

      let newStreak = 1;
      if (lastCheckInDate === yesterday) {
        const savedStreak = Number(await AsyncStorage.getItem('streak')) || 0;
        newStreak = savedStreak + 1;
      }

      setStreak(newStreak);
      await AsyncStorage.setItem('streak', String(newStreak));
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setIsCheckedIn(false);

      const duration = timerSeconds;
      setTotalDuration(prev => prev + duration);

      const now = new Date();
      const sessionMonth = now.getMonth();
      const storedMonth = await AsyncStorage.getItem('sessionMonth');
      let newSessions = sessionsThisMonth;

      if (storedMonth === String(sessionMonth)) {
        newSessions = sessionsThisMonth + 1;
      } else {
        newSessions = 1;
        await AsyncStorage.setItem('sessionMonth', String(sessionMonth));
      }

      setSessionsThisMonth(newSessions);
      await AsyncStorage.setItem('totalDuration', String(totalDuration + duration));
      await AsyncStorage.setItem('sessionsThisMonth', String(newSessions));
      await AsyncStorage.setItem('lastCheckInDate', new Date().toDateString());

      setTimerSeconds(0);
    }
  };

  const handleLeaveGym = () => {
    Alert.alert(
      'Leave Gym',
      `Are you sure you want to leave ${gym?.name}?\n\n⚠️ WARNING: Your membership payment is non-refundable. If you leave, you will lose access to all gym facilities and your remaining membership days.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave Gym',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!userData?.uid) return;
              
              await updateDoc(doc(db, 'users', userData.uid), {
                gymId: null,
                enrollmentStatus: 'none',
                paymentMethod: null,
                transactionId: null,
                enrolledAt: null,
              });

              await refreshUserData();
              Alert.alert('Success', 'You have left the gym');
            } catch (error) {
              console.error('Error leaving gym:', error);
              Alert.alert('Error', 'Failed to leave gym');
            }
          },
        },
      ]
    );
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs ? hrs + 'h ' : ''}${mins ? mins + 'm ' : ''}${secs}s`;
  };

  const averageDuration = sessionsThisMonth > 0 ? Math.floor(totalDuration / sessionsThisMonth) : 0;

  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const calculateMembershipExpiry = () => {
    if (!userData?.enrolledAt || !userData?.planDuration) return null;
    const enrolledDate = new Date(userData.enrolledAt);
    const expiryDate = new Date(enrolledDate);
    expiryDate.setMonth(expiryDate.getMonth() + userData.planDuration);
    return expiryDate;
  };

  const getDaysRemaining = () => {
    const expiry = calculateMembershipExpiry();
    if (!expiry) return 0;
    const today = new Date();
    const diff = expiry.getTime() - today.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#0a0f1a" />
        <ActivityIndicator size="large" color="#4ade80" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // Not enrolled
  if (userData?.enrollmentStatus === 'none' || !userData?.gymId) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0a0f1a" />
        <View style={styles.emptyContainer}>
          <Ionicons name="fitness-outline" size={80} color="#64748b" />
          <Text style={styles.emptyTitle}>No Gym Enrolled</Text>
          <Text style={styles.emptySubtext}>
            Browse available gyms on the Home tab and join one to get started!
          </Text>
          <TouchableOpacity
            style={styles.browseButton}
            onPress={() => router.push('/(member)/home')}
          >
            <Ionicons name="search" size={20} color="#0a0f1a" />
            <Text style={styles.browseButtonText}>Browse Gyms</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Rejected
  if (userData?.enrollmentStatus === 'rejected') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0a0f1a" />
        <View style={styles.emptyContainer}>
          <Ionicons name="close-circle-outline" size={80} color="#f87171" />
          <Text style={styles.emptyTitle}>Enrollment Rejected</Text>
          <Text style={styles.emptySubtext}>
            Your enrollment request was rejected. Please contact the gym for more information.
          </Text>
          <TouchableOpacity
            style={styles.browseButton}
            onPress={() => router.push('/(member)/home')}
          >
            <Text style={styles.browseButtonText}>Browse Other Gyms</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Approved and enrolled
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0f1a" />
      <View style={styles.accentCircleOne} />
      <View style={styles.accentCircleTwo} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.userName}>{userData?.displayName || 'Member'}</Text>
          </View>
          <TouchableOpacity style={styles.notificationBtn}>
            <Ionicons name="notifications-outline" size={24} color="#e9eef7" />
          </TouchableOpacity>
        </View>

        {/* Gym Card */}
        <View style={styles.gymCard}>
          <Ionicons name="barbell-outline" size={24} color="#4ade80" />
          <View style={styles.gymInfo}>
            <Text style={styles.gymName}>{gym?.name || 'Loading...'}</Text>
            <Text style={styles.gymAddress}>{gym?.address || 'Loading...'}</Text>
          </View>
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Active</Text>
          </View>
        </View>

        {/* Check In Button */}
        <TouchableOpacity
          style={[styles.checkInBtn, isCheckedIn && styles.checkOutBtn]}
          activeOpacity={0.85}
          onPress={handleCheckInOut}
        >
          <View style={styles.checkInIconContainer}>
            <Ionicons name={isCheckedIn ? 'exit-outline' : 'enter-outline'} size={40} color="#0a0f1a" />
          </View>
          <Text style={styles.checkInText}>{isCheckedIn ? 'Check Out' : 'Check In'}</Text>
          <Text style={styles.checkInSubtext}>
            {isCheckedIn ? `Session duration: ${formatTime(timerSeconds)}` : 'Tap to start your workout'}
          </Text>
        </TouchableOpacity>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="flame-outline" size={28} color="#f97316" />
            <Text style={styles.statNumber}>{streak}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="calendar-outline" size={28} color="#3b82f6" />
            <Text style={styles.statNumber}>{sessionsThisMonth}</Text>
            <Text style={styles.statLabel}>This Month</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="time-outline" size={28} color="#a855f7" />
            <Text style={styles.statNumber}>{formatTime(averageDuration)}</Text>
            <Text style={styles.statLabel}>Avg Duration</Text>
          </View>
        </View>

        {/* Membership Card */}
        <View style={styles.membershipCard}>
          <View style={styles.membershipHeader}>
            <Text style={styles.membershipTitle}>Membership Status</Text>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>Active</Text>
            </View>
          </View>
          <View style={styles.membershipDetails}>
            <View style={styles.membershipRow}>
              <Text style={styles.membershipLabel}>Plan</Text>
              <Text style={styles.membershipValue}>
                {userData?.paymentMethod === 'Quarterly' ? 'Quarterly (3 months)' :
                 userData?.paymentMethod === '6-Month' ? '6 Month Plan' : 'Monthly'}
              </Text>
            </View>
            <View style={styles.membershipRow}>
              <Text style={styles.membershipLabel}>Enrolled</Text>
              <Text style={styles.membershipValue}>
                {userData?.enrolledAt ? new Date(userData.enrolledAt).toLocaleDateString() : 'N/A'}
              </Text>
            </View>
            <View style={styles.membershipRow}>
              <Text style={styles.membershipLabel}>Expires</Text>
              <Text style={styles.membershipValue}>
                {calculateMembershipExpiry()?.toLocaleDateString() || 'N/A'}
              </Text>
            </View>
            <View style={styles.membershipRow}>
              <Text style={styles.membershipLabel}>Days Left</Text>
              <Text style={[styles.membershipValue, { color: '#4ade80' }]}>
                {getDaysRemaining()} days
              </Text>
            </View>
          </View>
        </View>

        {/* Leave Gym Button */}
        <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveGym}>
          <Ionicons name="exit-outline" size={20} color="#f87171" />
          <Text style={styles.leaveButtonText}>Leave Gym</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

export default MyGym;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1a', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  loadingContainer: { flex: 1, backgroundColor: '#0a0f1a', justifyContent: 'center', alignItems: 'center', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  loadingText: { color: '#94a3b8', marginTop: 16, fontSize: 16 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: width * 0.1 },
  emptyTitle: { fontSize: 24, fontWeight: '700', color: '#e9eef7', marginTop: 20, textAlign: 'center' },
  emptySubtext: { fontSize: 15, color: '#64748b', marginTop: 12, textAlign: 'center', lineHeight: 22 },
  browseButton: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#4ade80', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14, marginTop: 24 },
  browseButtonText: { fontSize: 16, fontWeight: '700', color: '#0a0f1a' },
  scrollContent: { paddingHorizontal: width * 0.05, paddingTop: height * 0.02, paddingBottom: height * 0.02 },
  accentCircleOne: { position: 'absolute', width: width * 0.6, height: width * 0.6, borderRadius: width * 0.3, backgroundColor: 'rgba(74, 222, 128, 0.06)', top: -width * 0.2, right: -width * 0.2 },
  accentCircleTwo: { position: 'absolute', width: width * 0.4, height: width * 0.4, borderRadius: width * 0.2, backgroundColor: 'rgba(59, 130, 246, 0.05)', bottom: height * 0.3, left: -width * 0.15 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: height * 0.025 },
  greeting: { fontSize: 16, color: '#94a3b8' },
  userName: { fontSize: isSmall ? 24 : 28, fontWeight: '700', color: '#e9eef7' },
  notificationBtn: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(30, 41, 59, 0.8)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  gymCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(15, 23, 42, 0.8)', borderRadius: 16, padding: 16, marginBottom: height * 0.025, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  gymInfo: { flex: 1, marginLeft: 12 },
  gymName: { fontSize: 16, fontWeight: '600', color: '#e9eef7' },
  gymAddress: { fontSize: 13, color: '#64748b', marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(74, 222, 128, 0.15)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ade80', marginRight: 6 },
  statusText: { fontSize: 12, fontWeight: '600', color: '#4ade80' },
  checkInBtn: { backgroundColor: '#4ade80', borderRadius: 24, paddingVertical: height * 0.04, alignItems: 'center', marginBottom: height * 0.025, shadowColor: '#4ade80', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 10 },
  checkOutBtn: { backgroundColor: '#f97316', shadowColor: '#f97316' },
  checkInIconContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  checkInText: { fontSize: 24, fontWeight: '800', color: '#0a0f1a' },
  checkInSubtext: { fontSize: 14, color: 'rgba(10, 15, 26, 0.7)', marginTop: 4 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: height * 0.025 },
  statCard: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.8)', borderRadius: 16, padding: 16, alignItems: 'center', marginHorizontal: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  statNumber: { fontSize: 22, fontWeight: '700', color: '#e9eef7', marginTop: 8 },
  statLabel: { fontSize: 11, color: '#64748b', marginTop: 4 },
  membershipCard: { backgroundColor: 'rgba(15, 23, 42, 0.8)', borderRadius: 20, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  membershipHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  membershipTitle: { fontSize: 18, fontWeight: '700', color: '#e9eef7' },
  activeBadge: { backgroundColor: 'rgba(74, 222, 128, 0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  activeBadgeText: { fontSize: 12, fontWeight: '700', color: '#4ade80' },
  membershipDetails: { gap: 12 },
  membershipRow: { flexDirection: 'row', justifyContent: 'space-between' },
  membershipLabel: { fontSize: 14, color: '#64748b' },
  membershipValue: { fontSize: 14, fontWeight: '600', color: '#e9eef7' },
  leaveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: 'rgba(248, 113, 113, 0.1)', paddingVertical: 16, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(248, 113, 113, 0.2)' },
  leaveButtonText: { fontSize: 16, fontWeight: '600', color: '#f87171' },
});