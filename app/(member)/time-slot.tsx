import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Platform,
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
import { UserData } from "../types";

const { width, height } = Dimensions.get("window");

// Define TimeSlot based on your UserData type
type TimeSlot = NonNullable<UserData["timeSlot"]>;

type TimeSlotDetails = {
  name: TimeSlot;
  description: string;
  timeRange: string;
  icon: string;
  color: string;
};

const TimeSlotPage: React.FC = () => {
  const router = useRouter();
  const { userData, refreshUserData } = useAuth();

  const [loading, setLoading] = useState<boolean>(true);
  const [currentTimeSlot, setCurrentTimeSlot] = useState<TimeSlot | null>(null);
  const [showChangeModal, setShowChangeModal] = useState<boolean>(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [changingSlot, setChangingSlot] = useState<boolean>(false);
  const [gymName, setGymName] = useState<string>("");

  // Member counts for each time slot
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({
    Morning: 0,
    Evening: 0,
    Night: 0,
  });
  const [loadingCounts, setLoadingCounts] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const timeSlots: TimeSlotDetails[] = [
    {
      name: "Morning",
      description: "Perfect for starting your day energized",
      timeRange: "6:00 AM - 12:00 PM",
      icon: "sunny-outline",
      color: "#fbbf24",
    },
    {
      name: "Evening",
      description: "Ideal for post-work workouts",
      timeRange: "4:00 PM - 9:00 PM",
      icon: "partly-sunny-outline",
      color: "#f97316",
    },
    {
      name: "Night",
      description: "For those who prefer late-night training",
      timeRange: "9:00 PM - 12:00 AM",
      icon: "moon-outline",
      color: "#8b5cf6",
    },
  ];

  // Check if user is approved for gym access
  const isUserApproved = useCallback((user: UserData | null) => {
    return user?.enrollmentStatus === "approved" && user?.gymId;
  }, []);

  // Load user's time slot with real-time listener
  useEffect(() => {
    if (!userData?.uid) return;

    let unsubscribeUser: (() => void) | undefined;
    let unsubscribeGym: (() => void) | undefined;

    const loadUserTimeSlot = async () => {
      try {
        setLoading(true);

        // Set up real-time listener for user's time slot
        const userDocRef = doc(db, "users", userData.uid);
        unsubscribeUser = onSnapshot(userDocRef, (docSnapshot) => {
          if (docSnapshot.exists()) {
            const data = docSnapshot.data() as UserData;

            // Only update if user is still approved
            if (isUserApproved(data)) {
              setCurrentTimeSlot(data.timeSlot || null);

              // Update gym name if gymId exists
              if (data.gymId) {
                const gymDocRef = doc(db, "gyms", data.gymId);
                unsubscribeGym = onSnapshot(gymDocRef, (gymSnapshot) => {
                  if (gymSnapshot.exists()) {
                    const gymData = gymSnapshot.data();
                    setGymName(gymData.name || "");
                  }
                });
              } else {
                setGymName("");
              }
            } else {
              // User is no longer approved, clear time slot
              setCurrentTimeSlot(null);
              setGymName("");
            }
          }
        });
      } catch (error) {
        console.error("Error loading time slot:", error);
        Alert.alert("Error", "Failed to load time slot data");
      } finally {
        setLoading(false);
      }
    };

    loadUserTimeSlot();

    // Cleanup function
    return () => {
      unsubscribeUser?.();
      unsubscribeGym?.();
    };
  }, [userData?.uid, isUserApproved]);

  // Load member counts with real-time listeners
  useEffect(() => {
    if (!userData?.gymId || !isUserApproved(userData)) {
      console.log("No gym access or user not approved");
      setMemberCounts({ Morning: 0, Evening: 0, Night: 0 });
      return;
    }

    const unsubscribers: (() => void)[] = [];

    const loadRealTimeMemberCounts = () => {
      setLoadingCounts(true);

      try {
        // Create real-time queries for each time slot
        (["Morning", "Evening", "Night"] as TimeSlot[]).forEach(
          (slot: TimeSlot) => {
            // Query for approved users in this gym and time slot
            const q = query(
              collection(db, "users"),
              where("gymId", "==", userData.gymId),
              where("timeSlot", "==", slot),
              where("enrollmentStatus", "==", "approved"),
            );

            const unsubscribe = onSnapshot(
              q,
              (querySnapshot) => {
                setMemberCounts((prev) => ({
                  ...prev,
                  [slot]: querySnapshot.size,
                }));
              },
              (error) => {
                console.error(`Error listening to ${slot} slot:`, error);
                if (error.code === "permission-denied") {
                  console.log("Permission denied for time slot query");
                }
              },
            );

            unsubscribers.push(unsubscribe);
          },
        );
      } catch (error) {
        console.error("Error setting up real-time listeners:", error);
        Alert.alert("Error", "Failed to load crowd data");
      } finally {
        setLoadingCounts(false);
      }
    };

    loadRealTimeMemberCounts();

    // Cleanup function
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [userData?.gymId, isUserApproved]);

  const getCrowdLevel = (
    count: number,
  ): { label: string; color: string; icon: string } => {
    if (count === 0)
      return { label: "Empty", color: "#10b981", icon: "checkmark-circle" };
    if (count <= 10)
      return { label: "Low", color: "#4ade80", icon: "trending-down" };
    if (count <= 25)
      return { label: "Medium", color: "#fbbf24", icon: "people" };
    return { label: "High", color: "#f87171", icon: "trending-up" };
  };

  const getCurrentTimeSlotDetails = () => {
    if (!currentTimeSlot) return null;
    return timeSlots.find((slot) => slot.name === currentTimeSlot);
  };

  const handleSelectSlot = (slot: TimeSlot) => {
    setSelectedSlot(slot);
  };

  const handleConfirmChange = async () => {
    if (!selectedSlot || !userData?.uid) {
      Alert.alert("Error", "Please select a time slot");
      return;
    }

    // Check if user is approved
    if (!isUserApproved(userData)) {
      Alert.alert(
        "Not Approved",
        "You need to be approved in a gym to set a time slot",
      );
      return;
    }

    setChangingSlot(true);
    try {
      await updateDoc(doc(db, "users", userData.uid), {
        timeSlot: selectedSlot,
        timeSlotUpdatedAt: new Date(),
      });

      // Refresh user data to get updated time slot
      await refreshUserData();

      setCurrentTimeSlot(selectedSlot);
      setShowChangeModal(false);
      setSelectedSlot(null);

      Alert.alert(
        "Success!",
        `Your time slot has been changed to ${selectedSlot}`,
        [{ text: "OK" }],
      );
    } catch (error) {
      console.error("Error updating time slot:", error);
      Alert.alert("Error", "Failed to update time slot. Please try again.");
    } finally {
      setChangingSlot(false);
    }
  };

  const handleCancelChange = () => {
    setSelectedSlot(null);
    setShowChangeModal(false);
  };

  const getCurrentTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning!";
    if (hour < 17) return "Good Afternoon!";
    return "Good Evening!";
  };

  // Refresh all data
  const refreshAllData = async () => {
    setRefreshing(true);
    try {
      await refreshUserData();
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setRefreshing(false);
    }
  };

  // Handle manual refresh
  const onRefresh = async () => {
    await refreshAllData();
  };

  // Handle back button press - navigate to MyGym page
  const handleBackPress = () => {
    router.push("/(member)/mygym");
  };

  // Render different states based on user status
  const renderContent = () => {
    // Loading state
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4ade80" />
          <Text style={styles.loadingText}>Loading time slot data...</Text>
        </View>
      );
    }

    // Not enrolled in any gym
    if (!userData?.gymId) {
      return (
        <View style={styles.noGymContainer}>
          <Ionicons name="business-outline" size={64} color="#64748b" />
          <Text style={styles.noGymTitle}>Not Enrolled in a Gym</Text>
          <Text style={styles.noGymText}>
            You need to enroll in a gym to access time slot features.
          </Text>
          <TouchableOpacity
            style={styles.enrollButton}
            onPress={() => {
              // Try to navigate to home or explore
              try {
                router.push("/(member)/home");
              } catch {
                router.push("/");
              }
            }}
          >
            <Text style={styles.enrollButtonText}>Browse Gyms</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Enrolled but not approved
    if (userData.enrollmentStatus !== "approved") {
      const statusText =
        userData.enrollmentStatus === "pending"
          ? "Your enrollment is pending approval"
          : userData.enrollmentStatus === "rejected"
            ? "Your enrollment was rejected"
            : "Your enrollment status is not approved";

      return (
        <View style={styles.pendingContainer}>
          <Ionicons name="time-outline" size={64} color="#fbbf24" />
          <Text style={styles.pendingTitle}>Awaiting Approval</Text>
          <Text style={styles.pendingText}>
            {statusText}. {`You'll be able to set a time slot once approved.`}
          </Text>
          <Text style={styles.pendingSubtext}>
            Current status: {userData.enrollmentStatus}
          </Text>
        </View>
      );
    }

    // Approved and has gym access - show time slot UI
    const currentSlotDetails = getCurrentTimeSlotDetails();

    return (
      <>
        <View style={styles.currentSlotCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="time-outline" size={28} color="#4ade80" />
            <Text style={styles.cardTitle}>Your Current Time Slot</Text>
            {loadingCounts && (
              <ActivityIndicator
                size="small"
                color="#4ade80"
                style={{ marginLeft: 10 }}
              />
            )}
          </View>

          {currentSlotDetails ? (
            <>
              <View
                style={[
                  styles.slotIndicator,
                  { backgroundColor: `${currentSlotDetails.color}20` },
                ]}
              >
                <View
                  style={[
                    styles.slotIconContainer,
                    { backgroundColor: currentSlotDetails.color },
                  ]}
                >
                  <Ionicons
                    name={currentSlotDetails.icon as any}
                    size={32}
                    color="#0a0f1a"
                  />
                </View>
                <View style={styles.slotInfo}>
                  <Text style={styles.slotName}>{currentSlotDetails.name}</Text>
                  <Text style={styles.slotTime}>
                    {currentSlotDetails.timeRange}
                  </Text>
                  <Text style={styles.slotDescription}>
                    {currentSlotDetails.description}
                  </Text>
                </View>
              </View>

              <View style={styles.slotStatusContainer}>
                <View style={styles.statusBadge}>
                  <View
                    style={[styles.statusDot, { backgroundColor: "#4ade80" }]}
                  />
                  <Text style={styles.statusText}>Active</Text>
                </View>
                <Text style={styles.lastUpdated}>
                  {memberCounts[currentSlotDetails.name]} members in this slot
                  {loadingCounts && " (updating...)"}
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.noSlotContainer}>
              <Ionicons name="time-outline" size={64} color="#64748b" />
              <Text style={styles.noSlotTitle}>No Time Slot Selected</Text>
              <Text style={styles.noSlotText}>
                {`You haven't selected a preferred time slot yet. Choose one to
                optimize your gym experience.`}
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.changeButton}
          onPress={() => setShowChangeModal(true)}
          activeOpacity={0.8}
          disabled={loadingCounts}
        >
          <Ionicons name="swap-horizontal" size={22} color="#0a0f1a" />
          <Text style={styles.changeButtonText}>
            {currentTimeSlot ? "Change Time Slot" : "Select Time Slot"}
          </Text>
        </TouchableOpacity>

        {/* Crowd Overview */}
        <View style={styles.crowdOverview}>
          <View style={styles.crowdHeader}>
            <Text style={styles.crowdTitle}>Current Crowd Levels</Text>
            {loadingCounts && (
              <ActivityIndicator size="small" color="#4ade80" />
            )}
          </View>
          {timeSlots.map((slot) => {
            const crowd = getCrowdLevel(memberCounts[slot.name]);
            return (
              <View key={slot.name} style={styles.crowdItem}>
                <View style={styles.crowdLeft}>
                  <View
                    style={[
                      styles.crowdIcon,
                      { backgroundColor: `${slot.color}20` },
                    ]}
                  >
                    <Ionicons
                      name={slot.icon as any}
                      size={20}
                      color={slot.color}
                    />
                  </View>
                  <View>
                    <Text style={styles.crowdSlotName}>{slot.name}</Text>
                    <Text style={styles.crowdSlotTime}>{slot.timeRange}</Text>
                  </View>
                </View>
                <View style={styles.crowdRight}>
                  <View
                    style={[
                      styles.crowdBadge,
                      { backgroundColor: `${crowd.color}20` },
                    ]}
                  >
                    <Ionicons
                      name={crowd.icon as any}
                      size={14}
                      color={crowd.color}
                    />
                    <Text style={[styles.crowdLabel, { color: crowd.color }]}>
                      {crowd.label}
                    </Text>
                  </View>
                  <Text style={styles.crowdCount}>
                    {memberCounts[slot.name]} members
                    {loadingCounts && " ..."}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Gym Info */}
        {gymName && (
          <View style={styles.gymInfoCard}>
            <View style={styles.gymInfoHeader}>
              <Ionicons name="business-outline" size={20} color="#4ade80" />
              <Text style={styles.gymInfoTitle}>Your Gym</Text>
            </View>
            <Text style={styles.gymInfoText}>{gymName}</Text>
            <Text style={styles.gymInfoStatus}>
              Status:{" "}
              <Text style={styles.gymInfoStatusApproved}>Approved ✓</Text>
            </Text>
          </View>
        )}
      </>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0f1a" />
      <View style={styles.accentCircleOne} />
      <View style={styles.accentCircleTwo} />

      <ScrollView
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
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#e9eef7" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Time Slot</Text>
          <TouchableOpacity
            onPress={refreshAllData}
            style={styles.refreshButton}
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color="#4ade80" />
            ) : (
              <Ionicons name="refresh" size={22} color="#4ade80" />
            )}
          </TouchableOpacity>
        </View>

        {renderContent()}

        {/* Benefits section shown to all users */}
        <View style={styles.benefitsCard}>
          <Text style={styles.benefitsTitle}>
            Benefits of Setting a Time Slot
          </Text>

          <View style={styles.benefitItem}>
            <View style={styles.benefitIcon}>
              <Ionicons name="people-outline" size={20} color="#4ade80" />
            </View>
            <View style={styles.benefitTextContainer}>
              <Text style={styles.benefitItemTitle}>Avoid Crowds</Text>
              <Text style={styles.benefitItemDescription}>
                Train during your preferred time to avoid peak hours
              </Text>
            </View>
          </View>

          <View style={styles.benefitItem}>
            <View style={styles.benefitIcon}>
              <Ionicons name="calendar-outline" size={20} color="#4ade80" />
            </View>
            <View style={styles.benefitTextContainer}>
              <Text style={styles.benefitItemTitle}>Better Planning</Text>
              <Text style={styles.benefitItemDescription}>
                Plan your workouts consistently at your chosen time
              </Text>
            </View>
          </View>

          <View style={styles.benefitItem}>
            <View style={styles.benefitIcon}>
              <Ionicons name="trending-up-outline" size={20} color="#4ade80" />
            </View>
            <View style={styles.benefitTextContainer}>
              <Text style={styles.benefitItemTitle}>Improved Consistency</Text>
              <Text style={styles.benefitItemDescription}>
                Stick to a routine for better fitness results
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.greetingContainer}>
          <Ionicons name="happy-outline" size={24} color="#fbbf24" />
          <Text style={styles.greetingText}>{getCurrentTimeGreeting()}</Text>
        </View>
      </ScrollView>

      {/* Modal for changing time slot - only shown if user is approved */}
      {isUserApproved(userData) && (
        <Modal visible={showChangeModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {currentTimeSlot ? "Change Time Slot" : "Select Time Slot"}
                </Text>
                <TouchableOpacity onPress={handleCancelChange}>
                  <Ionicons name="close" size={28} color="#e9eef7" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll}>
                <Text style={styles.modalSubtitle}>
                  Choose your preferred workout time
                </Text>

                {timeSlots.map((slot) => {
                  const crowd = getCrowdLevel(memberCounts[slot.name]);
                  return (
                    <TouchableOpacity
                      key={slot.name}
                      style={[
                        styles.slotOption,
                        selectedSlot === slot.name && styles.slotOptionSelected,
                        currentTimeSlot === slot.name &&
                          styles.currentSlotOption,
                      ]}
                      onPress={() => handleSelectSlot(slot.name)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.optionIconContainer,
                          { backgroundColor: slot.color },
                        ]}
                      >
                        <Ionicons
                          name={slot.icon as any}
                          size={24}
                          color="#0a0f1a"
                        />
                      </View>

                      <View style={styles.optionInfo}>
                        <View style={styles.optionHeader}>
                          <Text style={styles.optionName}>{slot.name}</Text>
                          {currentTimeSlot === slot.name && (
                            <View style={styles.currentBadge}>
                              <Text style={styles.currentBadgeText}>
                                Current
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.optionTime}>{slot.timeRange}</Text>
                        <Text style={styles.optionDescription}>
                          {slot.description}
                        </Text>

                        {/* Crowd indicator in modal */}
                        <View style={styles.optionCrowd}>
                          <View
                            style={[
                              styles.optionCrowdBadge,
                              { backgroundColor: `${crowd.color}20` },
                            ]}
                          >
                            <Ionicons
                              name={crowd.icon as any}
                              size={12}
                              color={crowd.color}
                            />
                            <Text
                              style={[
                                styles.optionCrowdText,
                                { color: crowd.color },
                              ]}
                            >
                              {crowd.label}
                            </Text>
                          </View>
                          <Text style={styles.optionMemberCount}>
                            {memberCounts[slot.name]} members
                            {loadingCounts && " (live)"}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.optionSelector}>
                        {selectedSlot === slot.name ? (
                          <Ionicons
                            name="checkmark-circle"
                            size={28}
                            color={slot.color}
                          />
                        ) : (
                          <View
                            style={[
                              styles.selectorCircle,
                              { borderColor: slot.color },
                            ]}
                          />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={handleCancelChange}
                    disabled={changingSlot}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      styles.confirmButton,
                      (!selectedSlot || changingSlot) &&
                        styles.confirmButtonDisabled,
                    ]}
                    onPress={handleConfirmChange}
                    disabled={!selectedSlot || changingSlot}
                  >
                    {changingSlot ? (
                      <ActivityIndicator color="#0a0f1a" />
                    ) : (
                      <Text style={styles.confirmButtonText}>
                        {currentTimeSlot ? "Change Slot" : "Confirm Selection"}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

export default TimeSlotPage;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0f1a",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  loadingText: {
    color: "#94a3b8",
    marginTop: 16,
    fontSize: 16,
  },
  scrollContent: {
    paddingHorizontal: width * 0.05,
    paddingTop: height * 0.02,
    paddingBottom: height * 0.02,
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
    backgroundColor: "rgba(74, 222, 128, 0.05)",
    bottom: height * 0.3,
    left: -width * 0.15,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: height * 0.03,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#e9eef7",
    textAlign: "center",
    flex: 1,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(74, 222, 128, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  noGymContainer: {
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 20,
    padding: 30,
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  noGymTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#e9eef7",
    marginTop: 16,
    marginBottom: 8,
  },
  noGymText: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  enrollButton: {
    backgroundColor: "#4ade80",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  enrollButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0a0f1a",
  },
  pendingContainer: {
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 20,
    padding: 30,
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.2)",
  },
  pendingTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#fbbf24",
    marginTop: 16,
    marginBottom: 8,
  },
  pendingText: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 8,
  },
  pendingSubtext: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "600",
  },
  currentSlotCard: {
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(74, 222, 128, 0.2)",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#e9eef7",
  },
  slotIndicator: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  slotIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  slotInfo: {
    flex: 1,
  },
  slotName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#e9eef7",
    marginBottom: 4,
  },
  slotTime: {
    fontSize: 14,
    fontWeight: "600",
    color: "#94a3b8",
    marginBottom: 8,
  },
  slotDescription: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 18,
  },
  slotStatusContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(74, 222, 128, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4ade80",
  },
  lastUpdated: {
    fontSize: 12,
    color: "#64748b",
  },
  noSlotContainer: {
    alignItems: "center",
    paddingVertical: 30,
  },
  noSlotTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#e9eef7",
    marginTop: 16,
    marginBottom: 8,
  },
  noSlotText: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: "80%",
  },
  changeButton: {
    backgroundColor: "#4ade80",
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginBottom: 24,
    shadowColor: "#4ade80",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  changeButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0a0f1a",
  },
  crowdOverview: {
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  crowdHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  crowdTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#e9eef7",
  },
  crowdItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.04)",
  },
  crowdLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  crowdIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  crowdSlotName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#e9eef7",
  },
  crowdSlotTime: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  crowdRight: {
    alignItems: "flex-end",
  },
  crowdBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  crowdLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  crowdCount: {
    fontSize: 12,
    color: "#94a3b8",
  },
  gymInfoCard: {
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(74, 222, 128, 0.2)",
  },
  gymInfoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  gymInfoTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4ade80",
  },
  gymInfoText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#e9eef7",
    marginBottom: 4,
  },
  gymInfoStatus: {
    fontSize: 13,
    color: "#94a3b8",
  },
  gymInfoStatusApproved: {
    color: "#4ade80",
    fontWeight: "600",
  },
  benefitsCard: {
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#e9eef7",
    marginBottom: 20,
  },
  benefitItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  benefitIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(74, 222, 128, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  benefitTextContainer: {
    flex: 1,
  },
  benefitItemTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#e9eef7",
    marginBottom: 4,
  },
  benefitItemDescription: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 20,
  },
  greetingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "rgba(251, 191, 36, 0.1)",
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.2)",
  },
  greetingText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fbbf24",
  },
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
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#e9eef7",
  },
  modalScroll: {
    paddingHorizontal: 20,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#94a3b8",
    marginTop: 20,
    marginBottom: 16,
  },
  slotOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  slotOptionSelected: {
    borderColor: "#4ade80",
    backgroundColor: "rgba(74, 222, 128, 0.05)",
  },
  currentSlotOption: {
    borderColor: "rgba(74, 222, 128, 0.3)",
    backgroundColor: "rgba(74, 222, 128, 0.05)",
  },
  optionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  optionInfo: {
    flex: 1,
  },
  optionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  optionName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#e9eef7",
    marginRight: 8,
  },
  currentBadge: {
    backgroundColor: "rgba(74, 222, 128, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#4ade80",
  },
  optionTime: {
    fontSize: 13,
    color: "#94a3b8",
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 16,
    marginBottom: 8,
  },
  optionCrowd: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  optionCrowdBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  optionCrowdText: {
    fontSize: 10,
    fontWeight: "600",
  },
  optionMemberCount: {
    fontSize: 11,
    color: "#64748b",
  },
  optionSelector: {
    marginLeft: 8,
  },
  selectorCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
    marginBottom: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#e9eef7",
  },
  confirmButton: {
    backgroundColor: "#4ade80",
  },
  confirmButtonDisabled: {
    backgroundColor: "#374151",
    opacity: 0.5,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0a0f1a",
  },
});
