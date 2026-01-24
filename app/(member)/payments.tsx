import React from 'react';
import { StatusBar, StyleSheet, Text, View, ScrollView } from 'react-native';
import { useAuth } from '../context/AuthContext';

const Payments: React.FC = () => {
  const { userData } = useAuth();

  const planName = userData?.paymentMethod || 'No Plan';
  const status = userData?.enrollmentStatus || 'none';
  const enrolledAt = userData?.enrolledAt?.toDateString() || 'N/A';

  const planDurationMonths = userData?.planDuration || 1; // default 1 month
  const expiryDate = userData?.enrolledAt
    ? new Date(userData.enrolledAt.getTime() + planDurationMonths * 30 * 24 * 60 * 60 * 1000).toDateString()
    : 'N/A';

  const daysLeft = userData?.enrolledAt
    ? Math.max(
        0,
        Math.ceil(
          (new Date(userData.enrolledAt.getTime() + planDurationMonths * 30 * 24 * 60 * 60 * 1000).getTime() -
            new Date().getTime()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0f1a" />

      <Text style={styles.header}>Membership Details</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Plan Name</Text>
          <Text style={styles.value}>{planName}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Status</Text>
          <Text style={[styles.value, status === 'approved' ? styles.active : styles.inactive]}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Enrolled At</Text>
          <Text style={styles.value}>{enrolledAt}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Expiry Date</Text>
          <Text style={styles.value}>{expiryDate}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Days Left</Text>
          <Text style={styles.value}>{daysLeft} days</Text>
        </View>
      </View>
    </ScrollView>
  );
};

export default Payments;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1a',
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  header: {
    fontSize: 28,
    fontWeight: '700',
    color: '#e9eef7',
    marginBottom: 30,
  },
  card: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  label: {
    fontSize: 16,
    color: '#94a3b8',
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e9eef7',
  },
  active: {
    color: '#4ade80',
  },
  inactive: {
    color: '#f97316',
  },
});
