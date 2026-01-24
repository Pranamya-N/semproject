import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect, useRef } from 'react';
import {
  Dimensions,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';

const { width, height } = Dimensions.get('window');
const isSmall = height < 700;

const MemberHome: React.FC = () => {
  const { userData } = useAuth();
  const [isCheckedIn, setIsCheckedIn] = useState<boolean>(false);
  const [checkInTime, setCheckInTime] = useState<Date | null>(null);
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [sessionsThisMonth, setSessionsThisMonth] = useState<number>(0);
  const [totalDuration, setTotalDuration] = useState<number>(0); // in seconds
  const timerRef = useRef<number | null>(null);

  // Load stats from AsyncStorage on mount
  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const lastCheckInDate = await AsyncStorage.getItem('lastCheckInDate');
      const savedStreak = Number(await AsyncStorage.getItem('streak')) || 0;
      const savedSessions = Number(await AsyncStorage.getItem('sessionsThisMonth')) || 0;
      const savedDuration = Number(await AsyncStorage.getItem('totalDuration')) || 0;

      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();

      // Determine streak
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
      // Check In
      const now = new Date();
      setCheckInTime(now);
      setIsCheckedIn(true);

      // Start timer
      timerRef.current = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);

      // Update streak
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
      // Check Out
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setIsCheckedIn(false);

      const duration = timerSeconds;
      setTotalDuration(prev => prev + duration);

      // Update monthly sessions
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

      // Save duration and sessions
      await AsyncStorage.setItem('totalDuration', String(totalDuration + duration));
      await AsyncStorage.setItem('sessionsThisMonth', String(newSessions));
      await AsyncStorage.setItem('lastCheckInDate', new Date().toDateString());

      setTimerSeconds(0);
      setCheckInTime(null);
    }
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs ? hrs + 'h ' : ''}${mins ? mins + 'm ' : ''}${secs}s`;
  };

  const averageDuration =
    sessionsThisMonth > 0 ? Math.floor(totalDuration / sessionsThisMonth) : 0;

  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0f1a" />

      <View style={styles.accentCircleOne} />
      <View style={styles.accentCircleTwo} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.userName}>{userData?.displayName || 'Member'}</Text>
          </View>
          <TouchableOpacity style={styles.notificationBtn}>
            <Ionicons name="notifications-outline" size={24} color="#e9eef7" />
          </TouchableOpacity>
        </View>

        <View style={styles.gymCard}>
          <Ionicons name="barbell-outline" size={24} color="#4ade80" />
          <View style={styles.gymInfo}>
            <Text style={styles.gymName}>FitCore Gym</Text>
            <Text style={styles.gymAddress}>123 Fitness Street, City</Text>
          </View>
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Open</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.checkInBtn, isCheckedIn && styles.checkOutBtn]}
          activeOpacity={0.85}
          onPress={handleCheckInOut}
        >
          <View style={styles.checkInIconContainer}>
            <Ionicons
              name={isCheckedIn ? 'exit-outline' : 'enter-outline'}
              size={40}
              color="#0a0f1a"
            />
          </View>
          <Text style={styles.checkInText}>
            {isCheckedIn ? 'Check Out' : 'Check In'}
          </Text>
          <Text style={styles.checkInSubtext}>
            {isCheckedIn
              ? `Session duration: ${formatTime(timerSeconds)}`
              : 'Tap to start your workout'}
          </Text>
        </TouchableOpacity>

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

        {/* Membership card stays same */}
      </ScrollView>
    </View>
  );
};

export default MemberHome;

// Styles remain unchanged
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1a' },
  scrollContent: { paddingHorizontal: width * 0.05, paddingTop: height * 0.06, paddingBottom: height * 0.02 },
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
  membershipCard: { backgroundColor: 'rgba(15, 23, 42, 0.8)', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  membershipHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  membershipTitle: { fontSize: 18, fontWeight: '700', color: '#e9eef7' },
  activeBadge: { backgroundColor: 'rgba(74, 222, 128, 0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  activeBadgeText: { fontSize: 12, fontWeight: '700', color: '#4ade80' },
  membershipDetails: { gap: 12 },
  membershipRow: { flexDirection: 'row', justifyContent: 'space-between' },
  membershipLabel: { fontSize: 14, color: '#64748b' },
  membershipValue: { fontSize: 14, fontWeight: '600', color: '#e9eef7' },
});
