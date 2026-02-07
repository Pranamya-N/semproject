import { Ionicons } from "@expo/vector-icons";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";
import { Gym, PlanChangeRequest } from "../types";

const Payments: React.FC = () => {
  const { userData, refreshUserData } = useAuth();
  const [currentTimeSlot, setCurrentTimeSlot] =
    useState<string>("Not Assigned");
  const [gymData, setGymData] = useState<Gym | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [latestRequest, setLatestRequest] = useState<PlanChangeRequest | null>(
    null,
  );

  const status = userData?.enrollmentStatus ?? "none";
  // ⭐ FIXED: Only get enrolledAt if status is approved
  const enrolledAt =
    userData?.enrollmentStatus === "approved" ? userData?.enrolledAt : null;
  const currentDuration = userData?.planDuration ?? 1;

  // Listen to plan change requests
  useEffect(() => {
    if (!userData?.uid) return;

    const q = query(
      collection(db, "planChangeRequests"),
      where("userId", "==", userData.uid),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          // Manually sort and get latest
          const sortedDocs = snapshot.docs.sort((a, b) => {
            const aData = a.data();
            const bData = b.data();
            const getTimestamp = (data: any) => {
              if (data.createdAt?.seconds) return data.createdAt.seconds;
              if (data.createdAt?.toDate)
                return data.createdAt.toDate().getTime() / 1000;
              if (data.createdAt?.getTime)
                return data.createdAt.getTime() / 1000;
              return 0;
            };
            const aTime = getTimestamp(aData);
            const bTime = getTimestamp(bData);
            return bTime - aTime;
          });

          const latest = sortedDocs[0];
          const data = latest.data();

          // If request was just approved, refresh user data
          if (
            data.status === "approved" &&
            latestRequest?.status !== "approved"
          ) {
            refreshUserData();
          }

          const requestData: PlanChangeRequest = {
            id: latest.id,
            userId: data.userId,
            gymId: data.gymId,
            currentDuration: data.currentDuration,
            requestedDuration: data.requestedDuration,
            status: data.status,
            createdAt: data.createdAt?.toDate
              ? data.createdAt.toDate()
              : new Date(data.createdAt),
            reviewedAt: data.reviewedAt?.toDate
              ? data.reviewedAt.toDate()
              : data.reviewedAt
                ? new Date(data.reviewedAt)
                : null,
            reviewedBy: data.reviewedBy || null,
          };

          setLatestRequest(requestData);
        } else {
          setLatestRequest(null);
        }
      },
      (error) => {
        console.error("Plan change request listener error:", error);
        setUpdateError("Failed to load plan requests. Please try again.");
      },
    );

    return () => unsubscribe();
  }, [userData?.uid]);

  // Fetch gym data
  useEffect(() => {
    const fetchGym = async () => {
      if (!userData?.gymId) {
        setLoading(false);
        return;
      }
      try {
        const gymDoc = await getDoc(doc(db, "gyms", userData.gymId));
        if (gymDoc.exists()) {
          const data = gymDoc.data();
          setGymData({
            id: gymDoc.id,
            name: data.name,
            address: data.address,
            phone: data.phone,
            email: data.email,
            upiId: data.upiId,
            monthlyFee: data.monthlyFee,
            createdAt: data.createdAt?.toDate?.() ?? new Date(),
            adminId: data.adminId,
            isActive: data.isActive,
            quarterlyFee: data.quarterlyFee,
            annualFee: data.annualFee,
          } as Gym);
        }
      } catch (e) {
        console.error("Failed to fetch gym:", e);
        Alert.alert("Error", "Failed to load gym information");
      } finally {
        setLoading(false);
      }
    };
    fetchGym();
  }, [userData?.gymId]);

  // Fetch time slot
  useEffect(() => {
    if (userData?.timeSlot) {
      setCurrentTimeSlot(userData.timeSlot);
    }
  }, [userData?.timeSlot]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshUserData();
    setRefreshing(false);
  };

  // ⭐ FIXED: Check if enrolledAt exists before calculating
  const getExpiryDate = (duration: number) => {
    if (!enrolledAt) return "Not enrolled yet";
    const newExpiry = new Date(enrolledAt);
    newExpiry.setMonth(newExpiry.getMonth() + duration);
    return newExpiry.toDateString();
  };

  // ⭐ FIXED: Check if enrolledAt exists before calculating
  const getDaysLeft = (duration: number) => {
    if (!enrolledAt) return 0;
    const expiryDate = new Date(enrolledAt);
    expiryDate.setMonth(expiryDate.getMonth() + duration);
    const today = new Date();
    const diffTime = expiryDate.getTime() - today.getTime();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };

  const expiryDate = getExpiryDate(currentDuration);
  const daysLeft = getDaysLeft(currentDuration);

  const allPlans = [
    { months: 1, label: "1 Month", fee: gymData?.monthlyFee ?? 0 },
    {
      months: 3,
      label: "3 Months",
      fee: gymData?.quarterlyFee ?? (gymData?.monthlyFee ?? 0) * 3,
    },
    {
      months: 6,
      label: "6 Months",
      fee:
        gymData?.annualFee != null
          ? gymData.annualFee / 2
          : (gymData?.monthlyFee ?? 0) * 6,
    },
    {
      months: 12,
      label: "12 Months",
      fee: gymData?.annualFee ?? (gymData?.monthlyFee ?? 0) * 12,
    },
  ];

  const handleChangePlan = async (newDuration: number) => {
    if (!userData?.uid) {
      setUpdateError("User not found. Please log in again.");
      return;
    }
    if (newDuration === currentDuration) return;
    if (latestRequest?.status === "pending") {
      Alert.alert(
        "Request Pending",
        "You already have a pending request. Wait for admin approval or cancel it first.",
      );
      return;
    }

    const selectedPlan = allPlans.find((p) => p.months === newDuration);

    // Show confirmation dialog
    Alert.alert(
      "Confirm Plan Change",
      `Do you want to change your plan to ${selectedPlan?.label}?\n\nAmount: ₹${selectedPlan?.fee}\n\nNote: This request will be sent to the gym admin for approval.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Confirm",
          onPress: async () => {
            setUpdating(true);
            setUpdateError(null);
            try {
              await addDoc(collection(db, "planChangeRequests"), {
                userId: userData.uid,
                gymId: userData.gymId,
                currentDuration: currentDuration,
                requestedDuration: newDuration,
                status: "pending",
                createdAt: serverTimestamp(),
                reviewedAt: null,
                reviewedBy: null,
                userName: userData.displayName,
                userEmail: userData.email,
                gymName: gymData?.name,
              });

              setModalVisible(false);
              Alert.alert(
                "Request Sent ✅",
                "Your plan change request has been sent to the admin for approval.",
              );
            } catch (e: any) {
              console.error("Failed to submit plan change request:", e);
              Alert.alert(
                "Error",
                "Failed to submit request. Please try again.",
              );
            } finally {
              setUpdating(false);
            }
          },
        },
      ],
    );
  };

  const handleCancelRequest = () => {
    if (!latestRequest) return;

    Alert.alert(
      "Cancel Request",
      "Are you sure you want to cancel your plan change request?",
      [
        {
          text: "No",
          style: "cancel",
        },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "planChangeRequests", latestRequest.id));
              setLatestRequest(null);
              Alert.alert("Success", "Request cancelled successfully");
            } catch (error) {
              console.error("Error cancelling request:", error);
              Alert.alert(
                "Error",
                "Failed to cancel request. Please try again.",
              );
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4ade80" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0f1a" />

      {/* Header with safe area */}
      <View style={styles.headerContainer}>
        <Text style={styles.header}>Membership</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#4ade80"
            colors={["#4ade80"]}
          />
        }
      >
        {status === "none" || !gymData ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="card-outline" size={64} color="#64748b" />
            <Text style={styles.emptyTitle}>No Active Membership</Text>
            <Text style={styles.emptySubtitle}>
              Join a gym to see your membership details here.
            </Text>
          </View>
        ) : (
          <>
            {/* Gym Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.gymName}>{gymData.name}</Text>
                <View
                  style={[
                    styles.badge,
                    status === "approved"
                      ? styles.badgeActive
                      : styles.badgeInactive,
                  ]}
                >
                  <Text style={styles.badgeText}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.planDisplay}>
                <Text style={styles.planDurationNumber}>{currentDuration}</Text>
                <Text style={styles.planDurationLabel}>
                  {currentDuration === 1 ? "Month" : "Months"} Plan
                </Text>
              </View>

              {/* ⭐ FIXED: Show different content based on enrollment status */}
              {status === "approved" && enrolledAt ? (
                <View style={styles.detailsGrid}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Enrolled</Text>
                    <Text style={styles.detailValue}>
                      {enrolledAt.toDateString()}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Expires</Text>
                    <Text style={styles.detailValue}>{expiryDate}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Days Left</Text>
                    <Text
                      style={[
                        styles.detailValue,
                        daysLeft <= 7 && styles.detailValueWarning,
                      ]}
                    >
                      {daysLeft}d
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Time Slot</Text>
                    <Text style={styles.detailValue}>{currentTimeSlot}</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.pendingContainer}>
                  <Ionicons
                    name={
                      status === "pending"
                        ? "time-outline"
                        : "information-circle"
                    }
                    size={40}
                    color="#64748b"
                  />
                  <Text style={styles.pendingText}>
                    {status === "pending"
                      ? "Your enrollment is pending admin approval"
                      : "You are not enrolled in any gym"}
                  </Text>
                  {status === "pending" && (
                    <Text style={styles.pendingSubtext}>
                      Your enrollment date will be set once approved
                    </Text>
                  )}
                </View>
              )}
            </View>

            {/* Request Status Banner */}
            {latestRequest && (
              <View
                style={[
                  styles.requestBanner,
                  latestRequest.status === "pending" &&
                    styles.requestBannerPending,
                  latestRequest.status === "approved" &&
                    styles.requestBannerApproved,
                  latestRequest.status === "rejected" &&
                    styles.requestBannerRejected,
                ]}
              >
                <View style={styles.requestBannerRow}>
                  <View style={styles.requestBannerIcon}>
                    <Ionicons
                      name={
                        latestRequest.status === "pending"
                          ? "time-outline"
                          : latestRequest.status === "approved"
                            ? "checkmark-circle"
                            : "close-circle"
                      }
                      size={24}
                      color={
                        latestRequest.status === "pending"
                          ? "#fbbf24"
                          : latestRequest.status === "approved"
                            ? "#4ade80"
                            : "#f87171"
                      }
                    />
                  </View>
                  <View style={styles.requestBannerContent}>
                    <Text style={styles.requestBannerTitle}>
                      {latestRequest.status === "pending"
                        ? "Plan Change Pending"
                        : latestRequest.status === "approved"
                          ? "Plan Change Approved"
                          : "Plan Change Rejected"}
                    </Text>
                    <Text style={styles.requestBannerSub}>
                      {latestRequest.status === "pending"
                        ? `Requested: ${latestRequest.requestedDuration} ${latestRequest.requestedDuration === 1 ? "Month" : "Months"} Plan`
                        : latestRequest.status === "approved"
                          ? `Your plan has been updated to ${latestRequest.requestedDuration} ${latestRequest.requestedDuration === 1 ? "Month" : "Months"}`
                          : `Request for ${latestRequest.requestedDuration} ${latestRequest.requestedDuration === 1 ? "Month" : "Months"} Plan was rejected`}
                    </Text>
                    {latestRequest.status !== "pending" &&
                      latestRequest.reviewedAt && (
                        <Text style={styles.requestBannerDate}>
                          Reviewed:{" "}
                          {latestRequest.reviewedAt.toLocaleDateString()}
                        </Text>
                      )}
                  </View>
                </View>
                {latestRequest.status === "pending" && (
                  <TouchableOpacity
                    style={styles.cancelRequestBtn}
                    onPress={handleCancelRequest}
                  >
                    <Ionicons
                      name="close-circle-outline"
                      size={18}
                      color="#f87171"
                    />
                    <Text style={styles.cancelRequestText}>Cancel Request</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              {status === "approved" && (
                <TouchableOpacity
                  style={[
                    styles.changeBtn,
                    latestRequest?.status === "pending" &&
                      styles.changeBtnDisabled,
                  ]}
                  onPress={() => setModalVisible(true)}
                  disabled={latestRequest?.status === "pending"}
                >
                  <Ionicons name="swap-horizontal" size={20} color="#0a0f1a" />
                  <Text style={styles.changeBtnText}>
                    {latestRequest?.status === "pending"
                      ? "Request Pending..."
                      : "Change Plan"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Plan Change Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Your Plan</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={28} color="#e9eef7" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Current: {currentDuration}{" "}
              {currentDuration === 1 ? "Month" : "Months"}
            </Text>

            {allPlans.map((plan) => {
              const isCurrent = plan.months === currentDuration;
              return (
                <TouchableOpacity
                  key={plan.months}
                  style={[
                    styles.planOption,
                    isCurrent && styles.planOptionCurrent,
                  ]}
                  onPress={() => handleChangePlan(plan.months)}
                  disabled={updating || isCurrent}
                >
                  <View style={styles.planOptionLeft}>
                    <Ionicons
                      name="calendar-outline"
                      size={20}
                      color={isCurrent ? "#4ade80" : "#64748b"}
                    />
                    <View>
                      <Text style={styles.planOptionLabel}>{plan.label}</Text>
                      <Text style={styles.planOptionFee}>
                        ₹{plan.fee.toFixed(0)}
                      </Text>
                    </View>
                  </View>
                  {isCurrent ? (
                    <Text style={styles.planOptionCurrentBadge}>Current</Text>
                  ) : (
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color="#64748b"
                    />
                  )}
                </TouchableOpacity>
              );
            })}

            {updateError && <Text style={styles.errorText}>{updateError}</Text>}

            {updating && (
              <ActivityIndicator
                size="small"
                color="#4ade80"
                style={styles.updatingIndicator}
              />
            )}

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.modalCloseBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default Payments;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0f1a",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0a0f1a",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#94a3b8",
    marginTop: 12,
    fontSize: 14,
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  header: {
    fontSize: 28,
    fontWeight: "700",
    color: "#e9eef7",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  emptyContainer: {
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 20,
    padding: 40,
    alignItems: "center",
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#e9eef7",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
  },
  card: {
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    marginBottom: 20,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  gymName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#e9eef7",
    flex: 1,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeActive: {
    backgroundColor: "rgba(74, 222, 128, 0.15)",
  },
  badgeInactive: {
    backgroundColor: "rgba(249, 115, 22, 0.15)",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4ade80",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginVertical: 20,
  },
  planDisplay: {
    alignItems: "center",
    marginBottom: 24,
  },
  planDurationNumber: {
    fontSize: 56,
    fontWeight: "800",
    color: "#4ade80",
    lineHeight: 64,
  },
  planDurationLabel: {
    fontSize: 16,
    color: "#94a3b8",
    marginTop: 4,
    fontWeight: "500",
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  detailItem: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    padding: 16,
  },
  detailLabel: {
    fontSize: 12,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#e9eef7",
  },
  detailValueWarning: {
    color: "#f97316",
  },
  // ⭐ ADDED: Pending container styles
  pendingContainer: {
    alignItems: "center",
    paddingVertical: 30,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    marginTop: 10,
    marginBottom: 20,
  },
  pendingText: {
    fontSize: 15,
    color: "#e9eef7",
    textAlign: "center",
    marginTop: 12,
    fontWeight: "600",
  },
  pendingSubtext: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    marginTop: 6,
  },
  requestBanner: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  requestBannerPending: {
    backgroundColor: "rgba(251, 191, 36, 0.08)",
    borderColor: "rgba(251, 191, 36, 0.3)",
  },
  requestBannerApproved: {
    backgroundColor: "rgba(74, 222, 128, 0.08)",
    borderColor: "rgba(74, 222, 128, 0.3)",
  },
  requestBannerRejected: {
    backgroundColor: "rgba(249, 115, 22, 0.08)",
    borderColor: "rgba(249, 115, 22, 0.3)",
  },
  requestBannerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  requestBannerIcon: {
    marginTop: 2,
  },
  requestBannerContent: {
    flex: 1,
  },
  requestBannerTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#e9eef7",
    marginBottom: 4,
  },
  requestBannerSub: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 18,
  },
  requestBannerDate: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 4,
    fontStyle: "italic",
  },
  cancelRequestBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "rgba(248, 113, 113, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cancelRequestText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#f87171",
  },
  actionButtons: {
    gap: 12,
  },
  changeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#4ade80",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  changeBtnDisabled: {
    backgroundColor: "rgba(74, 222, 128, 0.35)",
    opacity: 0.7,
  },
  changeBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0a0f1a",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#0a0f1a",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#e9eef7",
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 20,
  },
  planOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  planOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  planOptionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#e9eef7",
  },
  planOptionFee: {
    fontSize: 13,
    color: "#4ade80",
    fontWeight: "600",
    marginTop: 2,
  },
  planOptionCurrent: {
    borderColor: "rgba(74, 222, 128, 0.4)",
    backgroundColor: "rgba(74, 222, 128, 0.07)",
  },
  planOptionCurrentBadge: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4ade80",
    backgroundColor: "rgba(74, 222, 128, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  errorText: {
    color: "#f97316",
    fontSize: 14,
    textAlign: "center",
    marginTop: 12,
  },
  updatingIndicator: {
    marginTop: 12,
  },
  modalCloseBtn: {
    alignItems: "center",
    paddingVertical: 12,
    marginTop: 16,
  },
  modalCloseBtnText: {
    fontSize: 16,
    color: "#64748b",
    fontWeight: "600",
  },
});
