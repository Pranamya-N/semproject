import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
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
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";
import { Gym } from "../types/index";

const { width, height } = Dimensions.get("window");
const isSmall = height < 700;

type IssueType = "Equipment" | "Cleanliness" | "Staff" | "Safety" | "Other";

const MyGym: React.FC = () => {
  const { userData, refreshUserData } = useAuth();
  const router = useRouter();
  const [gym, setGym] = useState<Gym | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isCheckedIn, setIsCheckedIn] = useState<boolean>(false);
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [totalDuration, setTotalDuration] = useState<number>(0);
  const timerRef = useRef<number | null>(null);

  const [checkInConfirm, setCheckInConfirm] = useState<boolean>(false);
  const [checkOutConfirm, setCheckOutConfirm] = useState<boolean>(false);

  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [selectedIssues, setSelectedIssues] = useState<IssueType[]>([]);
  const [reportDescription, setReportDescription] = useState<string>("");
  const [submittingReport, setSubmittingReport] = useState<boolean>(false);

  const [checkoutSuccess, setCheckoutSuccess] = useState<boolean>(false);

  useEffect(() => {
    checkEnrollmentAndFetchGym();
    loadStats();
  }, [userData]);

  const checkEnrollmentAndFetchGym = async () => {
    if (userData?.enrollmentStatus === "approved" && userData?.gymId) {
      await fetchGymData(userData.gymId);
    }
    setLoading(false);
  };

  const fetchGymData = async (gymId: string) => {
    try {
      const gymDoc = await getDoc(doc(db, "gyms", gymId));
      if (gymDoc.exists()) {
        setGym({
          id: gymDoc.id,
          ...gymDoc.data(),
          createdAt: gymDoc.data().createdAt?.toDate() || new Date(),
        } as Gym);
      }
    } catch (error) {
      console.error("Error fetching gym:", error);
    }
  };

  const loadStats = async () => {
    try {
      const lastCheckInDate = await AsyncStorage.getItem("lastCheckInDate");
      const savedStreak = Number(await AsyncStorage.getItem("streak")) || 0;
      const savedDuration =
        Number(await AsyncStorage.getItem("totalDuration")) || 0;

      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();

      if (lastCheckInDate === yesterday || lastCheckInDate === today) {
        setStreak(savedStreak);
      } else {
        setStreak(0);
      }

      setTotalDuration(savedDuration);
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const handleCheckInPress = () => {
    if (!checkInConfirm) {
      setCheckInConfirm(true);
      setTimeout(() => setCheckInConfirm(false), 3000);
    } else {
      performCheckIn();
      setCheckInConfirm(false);
    }
  };

  const handleCheckOutPress = () => {
    if (!checkOutConfirm) {
      setCheckOutConfirm(true);
      setCheckoutSuccess(false);
      setTimeout(() => setCheckOutConfirm(false), 3000);
    } else {
      performCheckOut();
      setCheckOutConfirm(false);
    }
  };

  const performCheckIn = async () => {
    const now = new Date();
    setIsCheckedIn(true);
    setCheckoutSuccess(false);
    timerRef.current = setInterval(
      () => setTimerSeconds((prev) => prev + 1),
      1000,
    );

    const lastCheckInDate = await AsyncStorage.getItem("lastCheckInDate");
    const yesterday = new Date(now.getTime() - 86400000).toDateString();

    let newStreak = 1;
    if (lastCheckInDate === yesterday) {
      const savedStreak = Number(await AsyncStorage.getItem("streak")) || 0;
      newStreak = savedStreak + 1;
    }

    setStreak(newStreak);
    await AsyncStorage.setItem("streak", String(newStreak));
    await AsyncStorage.setItem("lastCheckInDate", now.toDateString());

    // Track active check-in in Firestore for real-time crowd counting
    if (userData?.uid && userData?.gymId) {
      try {
        const currentHour = now.getHours();
        let currentTimeSlot: "Morning" | "Evening" | "Night";

        // Determine time slot based on current time
        if (currentHour >= 6 && currentHour < 16) {
          currentTimeSlot = "Morning";
        } else if (currentHour >= 16 && currentHour < 21) {
          currentTimeSlot = "Evening";
        } else {
          currentTimeSlot = "Night";
        }

        await setDoc(doc(db, "activeCheckIns", userData.uid), {
          userId: userData.uid,
          userName: userData.displayName,
          gymId: userData.gymId,
          timeSlot: currentTimeSlot,
          checkInTime: serverTimestamp(),
        });
      } catch (error) {
        console.error("Error tracking check-in:", error);
      }
    }
  };

  const performCheckOut = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsCheckedIn(false);
    setCheckoutSuccess(true);

    const duration = timerSeconds;
    const now = new Date();
    const dateKey = now.toISOString().split("T")[0];

    setTotalDuration((prev) => prev + duration);

    await AsyncStorage.setItem(
      "totalDuration",
      String(totalDuration + duration),
    );
    await AsyncStorage.setItem("lastCheckOutDate", now.toDateString());

    // Save to check-in history for Activity Log
    try {
      const historyJson = await AsyncStorage.getItem("checkInHistory");
      const history = historyJson ? JSON.parse(historyJson) : [];

      const existingIndex = history.findIndex(
        (record: any) => record.date === dateKey,
      );
      if (existingIndex >= 0) {
        history[existingIndex].duration += duration;
      } else {
        history.push({ date: dateKey, duration });
      }

      await AsyncStorage.setItem("checkInHistory", JSON.stringify(history));
    } catch (error) {
      console.error("Error saving check-in history:", error);
    }

    // Remove from active check-ins in Firestore
    if (userData?.uid) {
      try {
        await deleteDoc(doc(db, "activeCheckIns", userData.uid));
      } catch (error) {
        console.error("Error removing check-in:", error);
      }
    }

    setTimerSeconds(0);

    setTimeout(() => {
      setCheckoutSuccess(false);
    }, 5000);
  };

  const handleLeaveGym = () => {
    Alert.alert(
      "Leave Gym",
      `Are you sure you want to leave ${gym?.name}?\n\n⚠️ WARNING: Your membership payment is non-refundable.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave Gym",
          style: "destructive",
          onPress: async () => {
            try {
              if (!userData?.uid) return;
              await updateDoc(doc(db, "users", userData.uid), {
                gymId: null,
                enrollmentStatus: "none",
                paymentMethod: null,
                transactionId: null,
                enrolledAt: null,
              });
              await refreshUserData();
              router.replace("/(member)/home");
              Alert.alert(
                "Success",
                "You have left the gym. Browse the home page to find a new gym!",
              );
            } catch (error) {
              console.error("Error leaving gym:", error);
              Alert.alert("Error", "Failed to leave gym");
            }
          },
        },
      ],
    );
  };

  const handleRefreshStatus = async () => {
    await refreshUserData();
    if (userData?.enrollmentStatus === "approved") {
      Alert.alert("Approved!", "Your enrollment has been approved!");
    } else {
      Alert.alert("Still Pending", "Your enrollment is still pending approval");
    }
  };

  const handleIssueToggle = (issue: IssueType) => {
    if (selectedIssues.includes(issue)) {
      setSelectedIssues(selectedIssues.filter((item) => item !== issue));
    } else {
      setSelectedIssues([...selectedIssues, issue]);
    }
  };

  const handleSubmitReport = async () => {
    if (selectedIssues.length === 0) {
      Alert.alert("Error", "Please select at least one issue type");
      return;
    }
    if (!reportDescription.trim()) {
      Alert.alert("Error", "Please describe the issue(s)");
      return;
    }

    setSubmittingReport(true);
    try {
      await addDoc(collection(db, "gymReports"), {
        gymId: gym?.id,
        gymName: gym?.name,
        userId: userData?.uid,
        userName: userData?.displayName,
        userEmail: userData?.email,
        issueTypes: selectedIssues,
        description: reportDescription,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      Alert.alert(
        "Success",
        "Your report has been submitted. The gym admin will review it shortly.",
      );
      setShowReportModal(false);
      setSelectedIssues([]);
      setReportDescription("");
    } catch (error) {
      console.error("Error submitting report:", error);
      Alert.alert("Error", "Failed to submit report. Please try again.");
    } finally {
      setSubmittingReport(false);
    }
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs ? hrs + "h " : ""}${mins ? mins + "m " : ""}${secs}s`;
  };

  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
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

  if (userData?.enrollmentStatus === "pending") {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0a0f1a" />
        <View style={styles.accentCircleOne} />
        <View style={styles.accentCircleTwo} />
        <View style={styles.emptyContainer}>
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="time-outline" size={64} color="#fbbf24" />
            </View>
          </View>
          <Text style={styles.emptyTitle}>Enrollment Pending</Text>
          <Text style={styles.emptySubtext}>
            Your enrollment request is being reviewed by the gym admin. You'll
            be able to check-in once approved.
          </Text>
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Status</Text>
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>
                  Pending Verification
                </Text>
              </View>
            </View>
            {userData?.paymentMethod && (
              <>
                <View style={styles.divider} />
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Payment Plan</Text>
                  <Text style={styles.statusValue}>
                    {userData.paymentMethod === "Quarterly"
                      ? "Quarterly (3 months)"
                      : userData.paymentMethod === "6-Month"
                        ? "6 Month Plan"
                        : userData.paymentMethod === "online"
                          ? "Monthly (Online)"
                          : "Offline Payment"}
                  </Text>
                </View>
              </>
            )}
            {userData?.transactionId && (
              <>
                <View style={styles.divider} />
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Transaction ID</Text>
                  <Text style={styles.statusValue}>
                    {userData.transactionId}
                  </Text>
                </View>
              </>
            )}
          </View>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleRefreshStatus}
          >
            <Ionicons name="refresh-outline" size={20} color="#e9eef7" />
            <Text style={styles.refreshButtonText}>Check Status</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (userData?.enrollmentStatus === "none" || !userData?.gymId) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0a0f1a" />
        <View style={styles.accentCircleOne} />
        <View style={styles.accentCircleTwo} />
        <View style={styles.emptyContainer}>
          <Ionicons name="fitness-outline" size={80} color="#64748b" />
          <Text style={styles.emptyTitle}>No Gym Enrolled</Text>
          <Text style={styles.emptySubtext}>
            Browse available gyms on the Home tab and join one to get started!
          </Text>
          <TouchableOpacity
            style={styles.browseButton}
            onPress={() => router.push("/(member)/home")}
          >
            <Ionicons name="search" size={20} color="#0a0f1a" />
            <Text style={styles.browseButtonText}>Browse Gyms</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (userData?.enrollmentStatus === "rejected") {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0a0f1a" />
        <View style={styles.accentCircleOne} />
        <View style={styles.accentCircleTwo} />
        <View style={styles.emptyContainer}>
          <Ionicons name="close-circle-outline" size={80} color="#f87171" />
          <Text style={styles.emptyTitle}>Enrollment Rejected</Text>
          <Text style={styles.emptySubtext}>
            Your enrollment request was rejected. Please contact the gym for
            more information.
          </Text>
          <TouchableOpacity
            style={styles.browseButton}
            onPress={() => router.push("/(member)/home")}
          >
            <Text style={styles.browseButtonText}>Browse Other Gyms</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

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
            <Text style={styles.userName}>
              {userData?.displayName || "Member"}
            </Text>
          </View>
        </View>

        <View style={styles.gymCard}>
          <Ionicons name="barbell-outline" size={24} color="#4ade80" />
          <View style={styles.gymInfo}>
            <Text style={styles.gymName}>{gym?.name || "Loading..."}</Text>
            <Text style={styles.gymAddress}>
              {gym?.address || "Loading..."}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.checkInBtn,
            isCheckedIn && styles.checkOutBtn,
            checkoutSuccess && styles.checkoutSuccessBtn,
          ]}
          onPress={isCheckedIn ? handleCheckOutPress : handleCheckInPress}
        >
          <Ionicons
            name={isCheckedIn ? "exit-outline" : "enter-outline"}
            size={40}
            color="#0a0f1a"
          />
          <Text
            style={[
              styles.checkInText,
              checkoutSuccess && styles.checkoutSuccessText,
            ]}
          >
            {isCheckedIn
              ? checkOutConfirm
                ? "Tap Again to Confirm"
                : checkoutSuccess
                  ? "Checked Out Successfully!"
                  : "Check Out"
              : checkInConfirm
                ? "Tap Again to Confirm"
                : "Check In"}
          </Text>
          <Text
            style={[
              styles.checkInSubtext,
              checkoutSuccess && styles.checkoutSuccessSubtext,
            ]}
          >
            {isCheckedIn
              ? checkOutConfirm
                ? "Confirm your checkout"
                : checkoutSuccess
                  ? "Great workout! See you next time! ✓"
                  : `Session: ${formatTime(timerSeconds)}`
              : checkInConfirm
                ? "Confirm to start your workout"
                : "Tap to start your workout"}
          </Text>
        </TouchableOpacity>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="flame-outline" size={28} color="#f97316" />
            <Text style={styles.statNumber}>{streak}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="time-outline" size={28} color="#a855f7" />
            <Text style={styles.statNumber}>
              {formatTime(Math.floor(totalDuration))}
            </Text>
            <Text style={styles.statLabel}>Total Time</Text>
          </View>
        </View>

        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={styles.timeSlotBtn}
            onPress={() => router.push("/(member)/time-slot")}
          >
            <View style={styles.buttonInner}>
              <Ionicons name="time-outline" size={22} color="#8b5cf6" />
              <Text style={styles.timeSlotBtnText}>Time Slot</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#64748b" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.activityBtn}
            onPress={() => router.push("/(member)/activity-log")}
          >
            <View style={styles.buttonInner}>
              <Ionicons name="calendar-outline" size={22} color="#3b82f6" />
              <Text style={styles.activityBtnText}>Activity Log</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#64748b" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.reportButton}
            onPress={() => setShowReportModal(true)}
          >
            <View style={styles.buttonInner}>
              <Ionicons name="flag-outline" size={22} color="#fbbf24" />
              <Text style={styles.reportButtonText}>Report an Issue</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#64748b" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveGym}>
            <View style={styles.buttonInner}>
              <Ionicons name="exit-outline" size={22} color="#f87171" />
              <Text style={styles.leaveButtonText}>Leave Gym</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={showReportModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report an Issue</Text>
              <TouchableOpacity onPress={() => setShowReportModal(false)}>
                <Ionicons name="close" size={28} color="#e9eef7" />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <Text style={styles.modalSectionTitle}>
                Select Issue Type
                {selectedIssues.length > 0 &&
                  ` (${selectedIssues.length} selected)`}
              </Text>

              {(
                [
                  "Equipment",
                  "Cleanliness",
                  "Staff",
                  "Safety",
                  "Other",
                ] as IssueType[]
              ).map((issue) => (
                <TouchableOpacity
                  key={issue}
                  style={[
                    styles.issueOption,
                    selectedIssues.includes(issue) &&
                      styles.issueOptionSelected,
                  ]}
                  onPress={() => handleIssueToggle(issue)}
                >
                  <Ionicons
                    name={
                      issue === "Equipment"
                        ? "barbell"
                        : issue === "Cleanliness"
                          ? "water"
                          : issue === "Staff"
                            ? "people"
                            : issue === "Safety"
                              ? "warning"
                              : "ellipsis-horizontal"
                    }
                    size={24}
                    color={
                      selectedIssues.includes(issue) ? "#4ade80" : "#64748b"
                    }
                  />
                  <Text style={styles.issueOptionText}>{issue}</Text>
                  {selectedIssues.includes(issue) && (
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color="#4ade80"
                    />
                  )}
                </TouchableOpacity>
              ))}

              <Text style={styles.modalSectionTitle}>Description</Text>
              <TextInput
                style={styles.descriptionInput}
                placeholder="Describe the issue(s) in detail..."
                placeholderTextColor="#64748b"
                value={reportDescription}
                onChangeText={setReportDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </ScrollView>

            <TouchableOpacity
              style={[
                styles.submitButton,
                (selectedIssues.length === 0 || submittingReport) &&
                  styles.submitButtonDisabled,
              ]}
              onPress={handleSubmitReport}
              disabled={selectedIssues.length === 0 || submittingReport}
            >
              {submittingReport ? (
                <ActivityIndicator color="#0a0f1a" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Report</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default MyGym;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0f1a",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0a0f1a",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  loadingText: { color: "#94a3b8", marginTop: 16, fontSize: 16 },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: width * 0.1,
  },
  iconContainer: { marginBottom: 24 },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(251, 191, 36, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#e9eef7",
    marginTop: 20,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 15,
    color: "#64748b",
    marginTop: 12,
    textAlign: "center",
    lineHeight: 22,
  },
  statusCard: {
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 20,
    padding: 20,
    width: "100%",
    marginTop: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusLabel: { fontSize: 14, color: "#64748b" },
  statusValue: { fontSize: 14, fontWeight: "600", color: "#e9eef7" },
  pendingBadge: {
    backgroundColor: "rgba(251, 191, 36, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pendingBadgeText: { fontSize: 12, fontWeight: "700", color: "#fbbf24" },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginVertical: 14,
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(30, 41, 59, 0.8)",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  refreshButtonText: { fontSize: 16, fontWeight: "600", color: "#e9eef7" },
  browseButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#4ade80",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 24,
  },
  browseButtonText: { fontSize: 16, fontWeight: "700", color: "#0a0f1a" },
  scrollContent: {
    paddingHorizontal: width * 0.05,
    paddingTop: height * 0.02,
    paddingBottom: height * 0.05,
  },
  accentCircleOne: {
    position: "absolute",
    width: width * 0.6,
    height: width * 0.6,
    borderRadius: width * 0.3,
    backgroundColor: "rgba(74, 222, 128, 0.06)",
    top: -width * 0.2,
    right: -width * 0.2,
  },
  accentCircleTwo: {
    position: "absolute",
    width: width * 0.4,
    height: width * 0.4,
    borderRadius: width * 0.2,
    backgroundColor: "rgba(59, 130, 246, 0.05)",
    bottom: height * 0.3,
    left: -width * 0.15,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: height * 0.025,
  },
  greeting: { fontSize: 16, color: "#94a3b8" },
  userName: {
    fontSize: isSmall ? 24 : 28,
    fontWeight: "700",
    color: "#e9eef7",
  },
  gymCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 16,
    padding: 16,
    marginBottom: height * 0.025,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  gymInfo: { flex: 1, marginLeft: 12 },
  gymName: { fontSize: 16, fontWeight: "600", color: "#e9eef7" },
  gymAddress: { fontSize: 13, color: "#64748b", marginTop: 2 },
  checkInBtn: {
    backgroundColor: "#4ade80",
    borderRadius: 24,
    paddingVertical: height * 0.04,
    alignItems: "center",
    marginBottom: height * 0.025,
    shadowColor: "#4ade80",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  checkOutBtn: { backgroundColor: "#f97316", shadowColor: "#f97316" },
  checkoutSuccessBtn: { backgroundColor: "#10b981", shadowColor: "#10b981" },
  checkInText: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0a0f1a",
    marginTop: 8,
    textAlign: "center",
  },
  checkoutSuccessText: { color: "#0a0f1a" },
  checkInSubtext: {
    fontSize: 14,
    color: "rgba(10, 15, 26, 0.7)",
    marginTop: 4,
    textAlign: "center",
  },
  checkoutSuccessSubtext: { color: "rgba(10, 15, 26, 0.8)", fontWeight: "600" },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: height * 0.025,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  statNumber: {
    fontSize: 22,
    fontWeight: "700",
    color: "#e9eef7",
    marginTop: 8,
  },
  statLabel: { fontSize: 11, color: "#64748b", marginTop: 4 },
  buttonsContainer: { gap: 12, marginBottom: 30 },
  buttonInner: { flexDirection: "row", alignItems: "center", gap: 10 },
  timeSlotBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(139, 92, 246, 0.1)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
  },
  timeSlotBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#8b5cf6",
    flex: 1,
  },
  activityBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.2)",
  },
  activityBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#3b82f6",
    flex: 1,
  },
  reportButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(251, 191, 36, 0.1)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.2)",
  },
  reportButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fbbf24",
    flex: 1,
  },
  leaveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(248, 113, 113, 0.1)",
    borderRadius: 14,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.2)",
  },
  leaveButtonText: { fontSize: 16, fontWeight: "600", color: "#f87171" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#0a0f1a",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.85,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#e9eef7" },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#e9eef7",
    marginTop: 20,
    marginBottom: 12,
    marginHorizontal: 20,
  },
  issueOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    marginHorizontal: 20,
    marginBottom: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  issueOptionSelected: {
    borderColor: "#4ade80",
    backgroundColor: "rgba(74, 222, 128, 0.05)",
  },
  issueOptionText: { flex: 1, fontSize: 16, color: "#e9eef7", marginLeft: 12 },
  descriptionInput: {
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    marginHorizontal: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    color: "#e9eef7",
    fontSize: 16,
    minHeight: 120,
    marginBottom: 20,
  },
  submitButton: {
    backgroundColor: "#4ade80",
    marginHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 10,
  },
  submitButtonDisabled: { backgroundColor: "#374151", opacity: 0.5 },
  submitButtonText: { fontSize: 16, fontWeight: "700", color: "#0a0f1a" },
});
