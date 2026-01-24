import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Gym, PaymentMethod } from '../types/index';
import { useAuth } from '../context/AuthContext';

const { width, height } = Dimensions.get('window');

const GymDetails: React.FC = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { userData, refreshUserData } = useAuth();
  const [gym, setGym] = useState<Gym | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PaymentMethod>('online');
  const [transactionId, setTransactionId] = useState('');
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    if (id) fetchGymDetails();
  }, [id]);

  const fetchGymDetails = async () => {
    try {
      const docSnap = await getDoc(doc(db, 'gyms', id));
      if (docSnap.exists()) {
        setGym({ id: docSnap.id, ...docSnap.data(), createdAt: docSnap.data().createdAt?.toDate() || new Date() } as Gym);
      } else {
        Alert.alert('Error', 'Gym not found');
        router.back();
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to load gym');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinNow = () => {
    // Check if already enrolled
    if (userData?.enrollmentStatus === 'approved') {
      Alert.alert(
        'Already Enrolled',
        `You are already a member of a gym. Your current membership is non-refundable.\n\nIf you want to join ${gym?.name}, you must first leave your current gym from the "My Gym" tab.`,
        [{ text: 'OK' }]
      );
      return;
    }

    if (userData?.enrollmentStatus === 'pending') {
      Alert.alert(
        'Pending Approval',
        'You already have a pending enrollment request. Please wait for admin approval.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Show enrollment modal
    setShowEnrollModal(true);
  };

  const handleEnrollSubmit = async () => {
    if (selectedPlan === 'online' && !transactionId.trim()) {
      Alert.alert('Error', 'Please enter your transaction ID');
      return;
    }

    Alert.alert(
      'Confirm Enrollment',
      `Join ${gym?.name}?\n\nPlan: ${selectedPlan === 'Quarterly' ? 'Quarterly (3 months)' : selectedPlan === '6-Month' ? '6 Month Plan' : 'Monthly'}\nPayment: ${selectedPlan === 'offline' ? 'Pay at gym' : 'Online (Transaction ID: ' + transactionId + ')'}\n\n⚠️ Payment is non-refundable`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setEnrolling(true);
            try {
              if (!userData?.uid) {
                Alert.alert('Error', 'User not found');
                return;
              }

              // Update user document
              await updateDoc(doc(db, 'users', userData.uid), {
                gymId: gym?.id,
                enrollmentStatus: 'pending',
                paymentMethod: selectedPlan,
                transactionId: selectedPlan === 'online' ? transactionId : null,
                enrolledAt: serverTimestamp(),
              });

              await refreshUserData();

              setShowEnrollModal(false);
              Alert.alert(
                'Success',
                'Enrollment request submitted! Please wait for gym admin approval.',
                [{ text: 'OK', onPress: () => router.replace('/pending-approval') }]
              );
            } catch (error) {
              console.error('Enrollment error:', error);
              Alert.alert('Error', 'Failed to submit enrollment. Please try again.');
            } finally {
              setEnrolling(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#0a0f1a" />
        <ActivityIndicator size="large" color="#4ade80" />
        <Text style={styles.loadingText}>Loading gym details...</Text>
      </View>
    );
  }

  if (!gym) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#0a0f1a" />
        <Ionicons name="alert-circle-outline" size={64} color="#64748b" />
        <Text style={styles.errorText}>Gym not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0f1a" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#e9eef7" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gym Details</Text>
        <TouchableOpacity style={styles.favoriteButton}>
          <Ionicons name="heart-outline" size={24} color="#e9eef7" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Gym Hero */}
        <View style={styles.heroCard}>
          <View style={styles.gymIconLarge}>
            <Ionicons name="barbell" size={48} color="#0a0f1a" />
          </View>
          <Text style={styles.gymName}>{gym.name}</Text>
          {gym.rating && (
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={18} color="#fbbf24" />
              <Text style={styles.ratingText}>{gym.rating}</Text>
              {gym.reviews && <Text style={styles.reviewsText}>({gym.reviews} reviews)</Text>}
            </View>
          )}
        </View>

        {/* Contact Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="location" size={20} color="#4ade80" />
              <Text style={styles.infoText}>{gym.address}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="call" size={20} color="#3b82f6" />
              <Text style={styles.infoText}>{gym.phone}</Text>
            </View>
            {gym.email && (
              <View style={styles.infoRow}>
                <Ionicons name="mail" size={20} color="#f97316" />
                <Text style={styles.infoText}>{gym.email}</Text>
              </View>
            )}
            {gym.openingHours && (
              <View style={styles.infoRow}>
                <Ionicons name="time" size={20} color="#a855f7" />
                <Text style={styles.infoText}>{gym.openingHours}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Description */}
        {gym.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <View style={styles.descriptionCard}>
              <Text style={styles.descriptionText}>{gym.description}</Text>
            </View>
          </View>
        )}

        {/* Pricing */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Membership Plans</Text>
          <View style={styles.pricingGrid}>
            <View style={styles.pricingCard}>
              <Text style={styles.planName}>Monthly</Text>
              <Text style={styles.planPrice}>₹{gym.monthlyFee}</Text>
              <Text style={styles.planDuration}>per month</Text>
            </View>
            {gym.quarterlyFee && (
              <View style={styles.pricingCard}>
                <View style={styles.popularBadge}>
                  <Text style={styles.popularText}>Popular</Text>
                </View>
                <Text style={styles.planName}>Quarterly</Text>
                <Text style={styles.planPrice}>₹{gym.quarterlyFee}</Text>
                <Text style={styles.planDuration}>3 months</Text>
                <Text style={styles.savingsText}>Save ₹{gym.monthlyFee * 3 - gym.quarterlyFee}</Text>
              </View>
            )}
            {gym.annualFee && (
              <View style={styles.pricingCard}>
                <Text style={styles.planName}>Annual</Text>
                <Text style={styles.planPrice}>₹{gym.annualFee}</Text>
                <Text style={styles.planDuration}>12 months</Text>
                <Text style={styles.savingsText}>Save ₹{gym.monthlyFee * 12 - gym.annualFee}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Amenities */}
        {gym.amenities && gym.amenities.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Amenities</Text>
            <View style={styles.amenitiesContainer}>
              {gym.amenities.map((amenity, index) => (
                <View key={index} style={styles.amenityChip}>
                  <Ionicons name="checkmark-circle" size={16} color="#4ade80" />
                  <Text style={styles.amenityText}>{amenity}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.priceFooter}>
          <Text style={styles.footerLabel}>Starting from</Text>
          <Text style={styles.footerPrice}>₹{gym.monthlyFee}/month</Text>
        </View>
        <TouchableOpacity style={styles.joinButton} onPress={handleJoinNow}>
          <Text style={styles.joinButtonText}>Join Now</Text>
          <Ionicons name="arrow-forward" size={20} color="#0a0f1a" />
        </TouchableOpacity>
      </View>

      {/* Enrollment Modal */}
      <Modal visible={showEnrollModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Join {gym.name}</Text>
              <TouchableOpacity onPress={() => setShowEnrollModal(false)}>
                <Ionicons name="close" size={28} color="#e9eef7" />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <Text style={styles.modalSectionTitle}>Select Payment Plan</Text>
              
              <TouchableOpacity
                style={[styles.planOption, selectedPlan === 'online' && styles.planOptionSelected]}
                onPress={() => setSelectedPlan('online')}
              >
                <View style={styles.planOptionLeft}>
                  <Ionicons name="card" size={24} color={selectedPlan === 'online' ? '#4ade80' : '#64748b'} />
                  <View style={styles.planOptionText}>
                    <Text style={styles.planOptionTitle}>Monthly (Online)</Text>
                    <Text style={styles.planOptionSubtitle}>₹{gym.monthlyFee}/month</Text>
                  </View>
                </View>
                {selectedPlan === 'online' && <Ionicons name="checkmark-circle" size={24} color="#4ade80" />}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.planOption, selectedPlan === 'Quarterly' && styles.planOptionSelected]}
                onPress={() => setSelectedPlan('Quarterly')}
              >
                <View style={styles.planOptionLeft}>
                  <Ionicons name="calendar" size={24} color={selectedPlan === 'Quarterly' ? '#4ade80' : '#64748b'} />
                  <View style={styles.planOptionText}>
                    <Text style={styles.planOptionTitle}>Quarterly (3 months)</Text>
                    <Text style={styles.planOptionSubtitle}>₹{gym.quarterlyFee || gym.monthlyFee * 3}/3 months</Text>
                  </View>
                </View>
                {selectedPlan === 'Quarterly' && <Ionicons name="checkmark-circle" size={24} color="#4ade80" />}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.planOption, selectedPlan === '6-Month' && styles.planOptionSelected]}
                onPress={() => setSelectedPlan('6-Month')}
              >
                <View style={styles.planOptionLeft}>
                  <Ionicons name="calendar" size={24} color={selectedPlan === '6-Month' ? '#4ade80' : '#64748b'} />
                  <View style={styles.planOptionText}>
                    <Text style={styles.planOptionTitle}>6 Month Plan</Text>
                    <Text style={styles.planOptionSubtitle}>₹{gym.annualFee ? gym.annualFee / 2 : gym.monthlyFee * 6}/6 months</Text>
                  </View>
                </View>
                {selectedPlan === '6-Month' && <Ionicons name="checkmark-circle" size={24} color="#4ade80" />}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.planOption, selectedPlan === 'offline' && styles.planOptionSelected]}
                onPress={() => setSelectedPlan('offline')}
              >
                <View style={styles.planOptionLeft}>
                  <Ionicons name="cash" size={24} color={selectedPlan === 'offline' ? '#4ade80' : '#64748b'} />
                  <View style={styles.planOptionText}>
                    <Text style={styles.planOptionTitle}>Pay at Gym (Offline)</Text>
                    <Text style={styles.planOptionSubtitle}>Visit gym to pay</Text>
                  </View>
                </View>
                {selectedPlan === 'offline' && <Ionicons name="checkmark-circle" size={24} color="#4ade80" />}
              </TouchableOpacity>

              {selectedPlan === 'online' && (
                <View style={styles.transactionSection}>
                  <Text style={styles.modalSectionTitle}>Transaction ID</Text>
                  <TextInput
                    style={styles.transactionInput}
                    placeholder="Enter transaction ID"
                    placeholderTextColor="#64748b"
                    value={transactionId}
                    onChangeText={setTransactionId}
                  />
                  <Text style={styles.helperText}>Enter your online payment transaction ID</Text>
                </View>
              )}

              <View style={styles.warningBox}>
                <Ionicons name="warning" size={20} color="#fbbf24" />
                <Text style={styles.warningText}>
                  Payment is non-refundable. Once approved, you cannot get a refund if you leave the gym.
                </Text>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.submitButton, enrolling && styles.submitButtonDisabled]}
              onPress={handleEnrollSubmit}
              disabled={enrolling}
            >
              {enrolling ? (
                <ActivityIndicator color="#0a0f1a" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Enrollment</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default GymDetails;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1a', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  loadingContainer: { flex: 1, backgroundColor: '#0a0f1a', justifyContent: 'center', alignItems: 'center', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  loadingText: { color: '#94a3b8', marginTop: 16, fontSize: 16 },
  errorText: { color: '#94a3b8', marginTop: 16, fontSize: 18, fontWeight: '600' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: width * 0.05, paddingVertical: 16 },
  backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(15, 23, 42, 0.8)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#e9eef7' },
  favoriteButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(15, 23, 42, 0.8)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  scrollContent: { paddingHorizontal: width * 0.05, paddingBottom: 100 },
  heroCard: { backgroundColor: 'rgba(15, 23, 42, 0.8)', borderRadius: 24, padding: 32, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  gymIconLarge: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#4ade80', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  gymName: { fontSize: 28, fontWeight: '800', color: '#e9eef7', textAlign: 'center', marginBottom: 8 },
  ratingContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingText: { fontSize: 16, fontWeight: '700', color: '#fbbf24' },
  reviewsText: { fontSize: 14, color: '#64748b' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#e9eef7', marginBottom: 12 },
  infoCard: { backgroundColor: 'rgba(15, 23, 42, 0.8)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', gap: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoText: { flex: 1, fontSize: 15, color: '#e9eef7' },
  descriptionCard: { backgroundColor: 'rgba(15, 23, 42, 0.8)', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  descriptionText: { fontSize: 15, color: '#94a3b8', lineHeight: 24 },
  pricingGrid: { gap: 12 },
  pricingCard: { backgroundColor: 'rgba(15, 23, 42, 0.8)', borderRadius: 16, padding: 20, borderWidth: 2, borderColor: 'rgba(74, 222, 128, 0.2)', position: 'relative' },
  popularBadge: { position: 'absolute', top: -12, right: 16, backgroundColor: '#4ade80', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  popularText: { fontSize: 11, fontWeight: '800', color: '#0a0f1a' },
  planName: { fontSize: 16, fontWeight: '600', color: '#94a3b8', marginBottom: 8 },
  planPrice: { fontSize: 32, fontWeight: '800', color: '#4ade80', marginBottom: 4 },
  planDuration: { fontSize: 14, color: '#64748b', marginBottom: 8 },
  savingsText: { fontSize: 13, fontWeight: '600', color: '#fbbf24' },
  amenitiesContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amenityChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(74, 222, 128, 0.15)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  amenityText: { fontSize: 13, fontWeight: '600', color: '#4ade80' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(15, 23, 42, 0.95)', paddingHorizontal: width * 0.05, paddingVertical: 16, paddingBottom: Platform.OS === 'android' ? 16 : 32, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', flexDirection: 'row', alignItems: 'center', gap: 16 },
  priceFooter: { flex: 1 },
  footerLabel: { fontSize: 12, color: '#64748b' },
  footerPrice: { fontSize: 20, fontWeight: '800', color: '#4ade80' },
  joinButton: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#4ade80', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  joinButtonText: { fontSize: 16, fontWeight: '700', color: '#0a0f1a' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#0f172a', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: height * 0.85 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: '700', color: '#e9eef7' },
  modalSectionTitle: { fontSize: 16, fontWeight: '600', color: '#e9eef7', marginTop: 16, marginBottom: 12 },
  planOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(30, 41, 59, 0.5)', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 2, borderColor: 'transparent' },
  planOptionSelected: { borderColor: '#4ade80', backgroundColor: 'rgba(74, 222, 128, 0.1)' },
  planOptionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  planOptionText: { flex: 1 },
  planOptionTitle: { fontSize: 16, fontWeight: '600', color: '#e9eef7' },
  planOptionSubtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
  transactionSection: { marginTop: 8 },
  transactionInput: { backgroundColor: 'rgba(30, 41, 59, 0.5)', borderRadius: 12, padding: 16, fontSize: 16, color: '#e9eef7', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  helperText: { fontSize: 12, color: '#64748b', marginTop: 6 },
  warningBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: 'rgba(251, 191, 36, 0.1)', borderRadius: 12, padding: 16, marginTop: 16, borderWidth: 1, borderColor: 'rgba(251, 191, 36, 0.2)' },
  warningText: { flex: 1, fontSize: 13, color: '#fbbf24', lineHeight: 18 },
  submitButton: { backgroundColor: '#4ade80', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 20 },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { fontSize: 16, fontWeight: '700', color: '#0a0f1a' },
});