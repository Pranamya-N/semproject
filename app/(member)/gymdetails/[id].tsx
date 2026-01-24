import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Gym } from '../../types';

const { width } = Dimensions.get('window');

const GymDetails: React.FC = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [gym, setGym] = useState<Gym | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) fetchGymDetails();
  }, [id]);

  const fetchGymDetails = async () => {
    try {
      const docSnap = await getDoc(doc(db, 'gyms', id));
      if (docSnap.exists()) setGym({ id: docSnap.id, ...docSnap.data() } as Gym);
      else {
        Alert.alert('Error', 'Gym not found');
        router.back();
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to load gym');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = () => {
    Alert.alert('Join Gym', `Do you want to join ${gym?.name}?`);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#4ade80" />
      </View>
    );
  }

  if (!gym) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={64} color="#64748b" />
        <Text style={styles.errorText}>Gym not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gym Details</Text>
        <View style={{ width: 24 }} /> {/* placeholder */}
      </View>

      {/* Gym Info */}
      <View style={styles.gymCard}>
        <Ionicons name="barbell" size={48} color="#4ade80" />
        <Text style={styles.gymName}>{gym.name}</Text>
        <Text style={styles.gymAddress}>{gym.address}</Text>
        <Text style={styles.gymPhone}>{gym.phone}</Text>
        {gym.description && <Text style={styles.gymDesc}>{gym.description}</Text>}
      </View>

      {/* Join Button */}
      <TouchableOpacity style={styles.joinButton} onPress={handleJoin}>
        <Text style={styles.joinText}>Join Now</Text>
      </TouchableOpacity>
    </View>
  );
};

export default GymDetails;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1a', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0, paddingHorizontal: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#fff', marginTop: 16, fontSize: 18 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 16 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  gymCard: { backgroundColor: '#1e293b', borderRadius: 16, padding: 20, alignItems: 'center', marginVertical: 16 },
  gymName: { color: '#fff', fontSize: 24, fontWeight: '700', marginVertical: 8 },
  gymAddress: { color: '#94a3b8', fontSize: 16 },
  gymPhone: { color: '#94a3b8', fontSize: 16, marginBottom: 8 },
  gymDesc: { color: '#94a3b8', fontSize: 14, marginTop: 8, textAlign: 'center' },
  joinButton: { backgroundColor: '#4ade80', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 'auto', marginBottom: 32 },
  joinText: { fontSize: 16, fontWeight: '700', color: '#0a0f1a' },
});
