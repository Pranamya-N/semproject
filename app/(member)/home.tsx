import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { Gym } from '../types';

const { width, height } = Dimensions.get('window');
const isSmall = height < 700;

const MemberHome: React.FC = () => {
  const { userData } = useAuth();
  const router = useRouter();
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchGyms();
  }, []);

  const fetchGyms = async (): Promise<void> => {
    try {
      const gymsQuery = query(
        collection(db, 'gyms'),
        where('isActive', '==', true)
      );
      const snapshot = await getDocs(gymsQuery);
      const gymsList: Gym[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as Gym[];

      setGyms(gymsList);
    } catch (error) {
      console.error('Error fetching gyms:', error);
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const renderGymCard = ({ item }: { item: Gym }) => {
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => router.push(`/gymdetails/${item.id}`)}
      >
        <View style={styles.gymCard}>
          <View style={styles.gymIconContainer}>
            <Ionicons name="barbell" size={28} color="#4ade80" />
          </View>

          <View style={styles.gymInfo}>
            <Text style={styles.gymName}>{item.name}</Text>

            <View style={styles.gymDetailRow}>
              <Ionicons name="location-outline" size={14} color="#64748b" />
              <Text style={styles.gymAddress}>{item.address}</Text>
            </View>

            <View style={styles.gymDetailRow}>
              <Ionicons name="call-outline" size={14} color="#64748b" />
              <Text style={styles.gymPhone}>{item.phone}</Text>
            </View>
          </View>

          <View style={styles.gymPriceContainer}>
            <Text style={styles.gymPriceLabel}>Monthly</Text>
            <Text style={styles.gymPrice}>₹{item.monthlyFee}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#0a0f1a" />
        <ActivityIndicator size="large" color="#4ade80" />
        <Text style={styles.loadingText}>Loading gyms...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0f1a" />

      <View style={styles.accentCircleOne} />
      <View style={styles.accentCircleTwo} />

      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{getGreeting()},</Text>
          <Text style={styles.userName}>{userData?.displayName || 'Member'}</Text>
        </View>
        <TouchableOpacity style={styles.notificationBtn}>
          <Ionicons name="notifications-outline" size={24} color="#e9eef7" />
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Available Gyms</Text>

      {gyms.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="fitness-outline" size={64} color="#64748b" />
          <Text style={styles.emptyText}>No gyms available</Text>
          <Text style={styles.emptySubtext}>Please check back later</Text>
        </View>
      ) : (
        <FlatList
          data={gyms}
          renderItem={renderGymCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

export default MemberHome;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1a',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a0f1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 16,
    fontSize: 16,
  },
  accentCircleOne: {
    position: 'absolute',
    width: width * 0.6,
    height: width * 0.6,
    borderRadius: width * 0.3,
    backgroundColor: 'rgba(74, 222, 128, 0.06)',
    top: -width * 0.2,
    right: -width * 0.2,
  },
  accentCircleTwo: {
    position: 'absolute',
    width: width * 0.4,
    height: width * 0.4,
    borderRadius: width * 0.2,
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    bottom: height * 0.3,
    left: -width * 0.15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: width * 0.05,
    paddingTop: height * 0.06,
  },
  greeting: {
    fontSize: 16,
    color: '#94a3b8',
  },
  userName: {
    fontSize: isSmall ? 24 : 28,
    fontWeight: '700',
    color: '#e9eef7',
  },
  notificationBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#e9eef7',
    paddingHorizontal: width * 0.05,
    marginTop: height * 0.03,
    marginBottom: height * 0.02,
  },
  listContent: {
    paddingHorizontal: width * 0.05,
    paddingBottom: 20,
  },
  gymCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  gymIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gymInfo: {
    flex: 1,
    marginLeft: 14,
  },
  gymName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#e9eef7',
    marginBottom: 6,
  },
  gymDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  gymAddress: {
    fontSize: 13,
    color: '#64748b',
    marginLeft: 6,
    flex: 1,
  },
  gymPhone: {
    fontSize: 13,
    color: '#64748b',
    marginLeft: 6,
  },
  gymPriceContainer: {
    alignItems: 'flex-end',
  },
  gymPriceLabel: {
    fontSize: 11,
    color: '#64748b',
  },
  gymPrice: {
    fontSize: 20,
    fontWeight: '800',
    color: '#4ade80',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#e9eef7',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
  },
});