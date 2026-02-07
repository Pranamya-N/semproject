import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  Dimensions,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";
import { Gym, GymReview, PaymentMethod } from "../types/index";

const { width, height } = Dimensions.get("window");
const isSmall = height < 700;

// Time slot types
type TimeSlot = "Morning" | "Evening" | "Night";
type PlanType = "monthly" | "3months" | "6months" | "12months";

const GymDetails: React.FC = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { userData, refreshUserData } = useAuth();
  const [gym, setGym] = useState<Gym | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeSlotCounts, setTimeSlotCounts] = useState<
    Record<TimeSlot, number>
  >({
    Morning: 0,
    Evening: 0,
    Night: 0,
  });
  const [totalEnrolledMembers, setTotalEnrolledMembers] = useState(0);
  const [userEnrollmentId, setUserEnrollmentId] = useState<string | null>(null);

  // ⭐ ADDED: Gym Reviews State
  const [showReviewsModal, setShowReviewsModal] = useState(false);
  const [gymReviews, setGymReviews] = useState<GymReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);

  // Join modal states
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanType>("monthly");
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(
    null,
  );
  const [step, setStep] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    if (id) {
      fetchGymDetails();
      fetchEnrolledMembers();
      fetchGymReviews(); // ⭐ ADDED: Fetch reviews on load
    }
  }, [id]);

  useEffect(() => {
    if (userData?.uid && id) {
      checkUserEnrollment();
    }
  }, [userData?.uid, id]);

  const fetchGymDetails = async () => {
    try {
      const docSnap = await getDoc(doc(db, "gyms", id));
      if (docSnap.exists()) {
        setGym({
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt?.toDate() || new Date(),
        } as Gym);
      } else {
        Alert.alert("Error", "Gym not found");
        router.back();
      }
    } catch (err) {
      Alert.alert("Error", "Failed to load gym");
    } finally {
      setLoading(false);
    }
  };

  // ⭐ ADDED: Fetch Gym Reviews
  const fetchGymReviews = async () => {
    if (!id) return;

    setLoadingReviews(true);
    try {
      const reviewsRef = collection(db, "gymReviews");
      const reviewsQuery = query(reviewsRef, where("gymId", "==", id));

      const querySnapshot = await getDocs(reviewsQuery);
      const reviews: GymReview[] = [];
      let totalRating = 0;
      let reviewCount = 0;

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const review = {
          id: doc.id,
          gymId: data.gymId,
          userId: data.userId,
          userName: data.userName,
          userEmail: data.userEmail,
          userPhone: data.userPhone || "",
          rating: data.rating || 0,
          comment: data.comment || "",
          createdAt: data.createdAt?.toDate() || new Date(),
        } as GymReview;

        reviews.push(review);
        totalRating += data.rating || 0;
        reviewCount++;
      });

      // Sort by date (newest first)
      const sortedReviews = reviews.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );

      setGymReviews(sortedReviews);
      setTotalReviews(reviewCount);
      setAverageRating(reviewCount > 0 ? totalRating / reviewCount : 0);

      // Update gym's rating in local state (for display)
      if (gym && reviewCount > 0) {
        setGym((prev) =>
          prev
            ? {
                ...prev,
                rating: parseFloat((totalRating / reviewCount).toFixed(1)),
                reviews: reviewCount,
              }
            : prev,
        );
      }
    } catch (error) {
      console.error("Error fetching gym reviews:", error);
    } finally {
      setLoadingReviews(false);
    }
  };

  // Check if user has a pending enrollment for this gym
  const checkUserEnrollment = async () => {
    if (!userData?.uid || !id) return;

    try {
      const enrollmentsRef = collection(db, "enrollments");
      const q = query(
        enrollmentsRef,
        where("userId", "==", userData.uid),
        where("gymId", "==", id),
        where("status", "==", "pending"),
      );

      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        setUserEnrollmentId(querySnapshot.docs[0].id);
      } else {
        setUserEnrollmentId(null);
      }
    } catch (error) {
      console.error("Error checking enrollment:", error);
    }
  };

  // Fetch enrolled members count by time slot
  const fetchEnrolledMembers = async () => {
    if (!id) return;

    try {
      const usersRef = collection(db, "users");
      const q = query(
        usersRef,
        where("gymId", "==", id),
        where("enrollmentStatus", "==", "approved"),
      );

      const querySnapshot = await getDocs(q);
      const counts = { Morning: 0, Evening: 0, Night: 0 };
      let total = 0;

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const timeSlot = data.timeSlot as TimeSlot;

        if (timeSlot && timeSlot in counts) {
          counts[timeSlot]++;
          total++;
        }
      });

      setTimeSlotCounts(counts);
      setTotalEnrolledMembers(total);
    } catch (error) {
      console.error("Error fetching enrolled members:", error);
      // Silently fail - just show 0 counts
      setTimeSlotCounts({ Morning: 0, Evening: 0, Night: 0 });
      setTotalEnrolledMembers(0);
    }
  };

  // Pull to refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchGymDetails(),
      fetchEnrolledMembers(),
      fetchGymReviews(), // ⭐ ADDED: Refresh reviews
      userData?.uid && id ? checkUserEnrollment() : Promise.resolve(),
    ]);
    setRefreshing(false);
  };

  // Cancel enrollment request
  const handleCancelEnrollment = () => {
    Alert.alert(
      "Cancel Enrollment Request",
      "Are you sure you want to cancel your enrollment request?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              if (!userEnrollmentId || !userData?.uid) return;

              // Delete enrollment record
              await deleteDoc(doc(db, "enrollments", userEnrollmentId));

              // Update user document
              await updateDoc(doc(db, "users", userData.uid), {
                gymId: null,
                enrollmentStatus: "none",
                paymentMethod: null,
                planDuration: null,
                timeSlot: null,
                enrolledAt: null,
              });

              await refreshUserData();
              setUserEnrollmentId(null);

              Alert.alert(
                "Request Cancelled",
                "Your enrollment request has been cancelled.",
                [{ text: "OK" }],
              );
            } catch (error) {
              console.error("Error cancelling enrollment:", error);
              Alert.alert(
                "Error",
                "Failed to cancel enrollment. Please try again.",
              );
            }
          },
        },
      ],
    );
  };

  // Join Gym Functions
  const calculatePrice = () => {
    if (!gym) return 0;

    switch (selectedPlan) {
      case "monthly":
        return gym.monthlyFee;
      case "3months":
        return gym.quarterlyFee || gym.monthlyFee * 3;
      case "6months":
        return gym.annualFee ? gym.annualFee / 2 : gym.monthlyFee * 6;
      case "12months":
        return gym.annualFee || gym.monthlyFee * 12;
      default:
        return gym.monthlyFee;
    }
  };

  const getPlanDuration = () => {
    switch (selectedPlan) {
      case "monthly":
        return 1;
      case "3months":
        return 3;
      case "6months":
        return 6;
      case "12months":
        return 12;
      default:
        return 1;
    }
  };

  const getPlanName = () => {
    switch (selectedPlan) {
      case "monthly":
        return "Monthly Plan";
      case "3months":
        return "3 Month Plan";
      case "6months":
        return "6 Month Plan";
      case "12months":
        return "Annual Plan";
      default:
        return "Monthly Plan";
    }
  };

  const handleJoinNow = () => {
    // Check if already enrolled in THIS gym
    if (userData?.gymId === id) {
      if (userData?.enrollmentStatus === "approved") {
        Alert.alert(
          "Already a Member",
          `You are already a member of ${gym?.name}!`,
          [
            { text: "OK", style: "cancel" },
            {
              text: "Go to My Gym",
              onPress: () => router.push("/(member)/mygym"),
            },
          ],
        );
        return;
      }

      if (userData?.enrollmentStatus === "pending") {
        Alert.alert(
          "Request Pending",
          `Your enrollment request for ${gym?.name} is pending approval.`,
          [{ text: "OK" }],
        );
        return;
      }
    }

    // Check if enrolled in ANOTHER gym
    if (
      userData?.gymId &&
      userData?.gymId !== id &&
      userData?.enrollmentStatus !== "none"
    ) {
      Alert.alert(
        "Already Enrolled",
        `You are already enrolled in another gym. To join ${gym?.name}, you must first leave your current gym from the "My Gym" tab.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Go to My Gym",
            onPress: () => router.push("/(member)/mygym"),
          },
        ],
      );
      return;
    }

    // Open the join modal
    setShowJoinModal(true);
    setStep(1);
    setSelectedPlan("monthly");
    setSelectedTimeSlot(null);
  };

  const handleSubmitEnrollment = async () => {
    if (!gym || !userData?.uid || !selectedTimeSlot) {
      Alert.alert("Error", "Please complete all selections");
      return;
    }

    Alert.alert(
      "Confirm Enrollment",
      `Are you sure you want to join ${gym.name}?\n\nPlan: ${getPlanName()}\nTime Slot: ${selectedTimeSlot}\nAmount: ₹${calculatePrice()}\n\n⚠️ Note: You need to visit the gym to complete payment.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Submit Request",
          onPress: async () => {
            setSubmitting(true);
            try {
              // 1. Create enrollment record
              const enrollmentRef = await addDoc(
                collection(db, "enrollments"),
                {
                  userId: userData.uid,
                  userName: userData.displayName,
                  userEmail: userData.email,
                  gymId: gym.id,
                  gymName: gym.name,
                  planDuration: getPlanDuration(),
                  timeSlot: selectedTimeSlot,
                  amount: calculatePrice(),
                  status: "pending",
                  paymentMethod: "offline" as PaymentMethod,
                  createdAt: serverTimestamp(),
                  reviewedAt: null,
                  reviewedBy: null,
                },
              );

              setUserEnrollmentId(enrollmentRef.id);

              // 2. Update user document
              await updateDoc(doc(db, "users", userData.uid), {
                gymId: gym.id,
                enrollmentStatus: "pending",
                paymentMethod: "offline" as PaymentMethod,
                planDuration: getPlanDuration(),
                timeSlot: selectedTimeSlot,
                enrolledAt: serverTimestamp(),
              });

              await refreshUserData();
              setShowJoinModal(false);

              Alert.alert(
                "Request Submitted! ✅",
                `Your enrollment request has been sent to ${gym.name}.\n\nPlease visit the gym to complete payment.`,
                [
                  {
                    text: "Download Bill",
                    onPress: generateAndShareBill,
                  },
                  {
                    text: "Go to My Gym",
                    onPress: () => router.replace("/(member)/mygym"),
                  },
                ],
              );
            } catch (error) {
              console.error("Enrollment error:", error);
              Alert.alert(
                "Error",
                "Failed to submit enrollment. Please try again.",
              );
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  };

  const generateAndShareBill = async () => {
    if (!gym || !selectedTimeSlot) return;

    const billDetails = `
GymFIT - Membership Bill
========================

Gym: ${gym.name}
Address: ${gym.address}
Phone: ${gym.phone}
${gym.email ? `Email: ${gym.email}` : ""}

Customer: ${userData?.displayName || "Member"}
Email: ${userData?.email || "N/A"}

Membership Details:
-------------------
Plan: ${getPlanName()}
Duration: ${getPlanDuration()} month${getPlanDuration() > 1 ? "s" : ""}
Time Slot: ${selectedTimeSlot}
Amount: ₹${calculatePrice()}

Payment Instructions:
--------------------
1. Visit ${gym.name} to complete payment
2. Show this bill to the gym staff
3. Payment must be completed within 7 days
4. Keep this bill for your records

Bill Date: ${new Date().toLocaleDateString()}
Bill ID: ${userData?.uid?.slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-6)}

Terms & Conditions:
------------------
• Payment is non-refundable
• Membership starts after payment confirmation
• Gym rules and regulations apply
    `;

    try {
      await Share.share({
        title: `Membership Bill - ${gym.name}`,
        message: billDetails,
      });
    } catch (error) {
      console.error("Error sharing bill:", error);
      Alert.alert(
        "Error",
        "Could not generate bill. Please take a screenshot instead.",
      );
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    Clipboard.setString(text);
    Alert.alert("Copied!", `${label} copied to clipboard`);
  };

  const callGym = () => {
    if (gym?.phone) {
      Alert.alert("Call Gym", `Call ${gym.name} at ${gym.phone}?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Copy Number",
          onPress: () => copyToClipboard(gym.phone, "Phone number"),
        },
        {
          text: "Call",
          onPress: () => {
            Alert.alert(
              "Note",
              "Call functionality would open dialer in production",
            );
          },
        },
      ]);
    }
  };

  const emailGym = () => {
    if (gym?.email) {
      Alert.alert("Email Gym", `Email ${gym.name} at ${gym.email}?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Copy Email",
          onPress: () => copyToClipboard(gym.email!, "Email address"),
        },
        {
          text: "Compose Email",
          onPress: () => {
            Alert.alert("Note", "Email composer would open in production");
          },
        },
      ]);
    }
  };

  // Check if user can join this gym
  const canJoinGym = () => {
    if (userData?.gymId === id && userData?.enrollmentStatus !== "rejected") {
      return false;
    }
    if (
      userData?.gymId &&
      userData?.gymId !== id &&
      userData?.enrollmentStatus !== "none"
    ) {
      return false;
    }
    return true;
  };

  const getJoinButtonText = () => {
    if (userData?.gymId === id) {
      if (userData?.enrollmentStatus === "approved") return "Already a Member";
      if (userData?.enrollmentStatus === "pending") return "Request Pending";
    }
    if (
      userData?.gymId &&
      userData?.gymId !== id &&
      userData?.enrollmentStatus !== "none"
    ) {
      return "Already Enrolled Elsewhere";
    }
    return "Join Now";
  };

  const getTimeSlotIcon = (slot: TimeSlot) => {
    switch (slot) {
      case "Morning":
        return "sunny-outline";
      case "Evening":
        return "partly-sunny-outline";
      case "Night":
        return "moon-outline";
      default:
        return "time-outline";
    }
  };

  const getTimeSlotColor = (slot: TimeSlot) => {
    switch (slot) {
      case "Morning":
        return "#fbbf24";
      case "Evening":
        return "#f97316";
      case "Night":
        return "#8b5cf6";
      default:
        return "#64748b";
    }
  };

  // ⭐ ADDED: Render star rating
  const renderStars = (rating: number, size: number = 16) => {
    return Array(5)
      .fill(0)
      .map((_, index) => (
        <Ionicons
          key={index}
          name={index < Math.floor(rating) ? "star" : "star-outline"}
          size={size}
          color="#fbbf24"
          style={{ marginHorizontal: 1 }}
        />
      ));
  };

  // ⭐ ADDED: Format review date
  const formatReviewDate = (date: Date) => {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return date.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  };

  // ⭐ ADDED: Render review item
  const renderReviewItem = (review: GymReview) => (
    <View key={review.id} style={styles.reviewItem}>
      <View style={styles.reviewHeader}>
        <View style={styles.userAvatar}>
          <Text style={styles.userInitial}>
            {review.userName?.charAt(0)?.toUpperCase() || "U"}
          </Text>
        </View>
        <View style={styles.reviewUserInfo}>
          <Text style={styles.userName}>{review.userName || "Anonymous"}</Text>
          <Text style={styles.reviewDate}>
            {formatReviewDate(review.createdAt)}
          </Text>
        </View>
        <View style={styles.ratingContainerSmall}>
          {renderStars(review.rating)}
          <Text style={styles.ratingTextSmall}>{review.rating.toFixed(1)}</Text>
        </View>
      </View>

      {review.comment ? (
        <Text style={styles.reviewComment}>{review.comment}</Text>
      ) : (
        <Text style={styles.noCommentText}>No comment provided</Text>
      )}
    </View>
  );

  // ⭐ ADDED: Render reviews modal
  const renderReviewsModal = () => (
    <Modal
      visible={showReviewsModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowReviewsModal(false)}
    >
      <View style={styles.reviewsModalOverlay}>
        <View style={styles.reviewsModalContent}>
          <View style={styles.reviewsModalHeader}>
            <View style={styles.reviewsHeaderLeft}>
              <Text style={styles.reviewsModalTitle}>Member Reviews</Text>
              <View style={styles.reviewsSummary}>
                <Text style={styles.averageRatingLarge}>
                  {averageRating.toFixed(1)}
                </Text>
                <View style={styles.ratingStarsLarge}>
                  {renderStars(averageRating, 20)}
                </View>
                <Text style={styles.totalReviewsText}>
                  {totalReviews} {totalReviews === 1 ? "review" : "reviews"}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setShowReviewsModal(false)}
              style={styles.reviewsCloseButton}
            >
              <Ionicons name="close" size={28} color="#e9eef7" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.reviewsList}
            showsVerticalScrollIndicator={false}
          >
            {loadingReviews ? (
              <View style={styles.reviewsLoading}>
                <ActivityIndicator size="large" color="#4ade80" />
                <Text style={styles.loadingReviewsText}>
                  Loading reviews...
                </Text>
              </View>
            ) : gymReviews.length === 0 ? (
              <View style={styles.noReviewsContainer}>
                <Ionicons name="star-outline" size={64} color="#64748b" />
                <Text style={styles.noReviewsText}>No Reviews Yet</Text>
                <Text style={styles.noReviewsSubtext}>
                  Be the first to review this gym!
                </Text>
              </View>
            ) : (
              gymReviews.map(renderReviewItem)
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderTimeSlotInfo = (slot: TimeSlot) => {
    const count = timeSlotCounts[slot];
    const color = getTimeSlotColor(slot);

    return (
      <View key={slot} style={styles.timeSlotCard}>
        <View style={styles.timeSlotHeader}>
          <View
            style={[styles.timeSlotIcon, { backgroundColor: color + "20" }]}
          >
            <Ionicons name={getTimeSlotIcon(slot)} size={20} color={color} />
          </View>
          <View style={styles.timeSlotInfo}>
            <Text style={styles.timeSlotTitle}>{slot}</Text>
            <Text style={styles.timeSlotTime}>
              {slot === "Morning"
                ? "6 AM - 4 PM"
                : slot === "Evening"
                  ? "4 PM - 9 PM"
                  : "9 PM - 6 AM"}
            </Text>
          </View>
        </View>

        <View style={styles.memberCountBadge}>
          <Ionicons name="people-outline" size={16} color={color} />
          <Text style={[styles.memberCountText, { color }]}>
            {count} {count === 1 ? "member" : "members"}
          </Text>
        </View>
      </View>
    );
  };

  // Join Modal Components
  const getPriceForPlan = (planType: PlanType) => {
    if (!gym) return 0;

    switch (planType) {
      case "monthly":
        return gym.monthlyFee;
      case "3months":
        return gym.quarterlyFee || gym.monthlyFee * 3;
      case "6months":
        return gym.annualFee ? gym.annualFee / 2 : gym.monthlyFee * 6;
      case "12months":
        return gym.annualFee || gym.monthlyFee * 12;
      default:
        return gym.monthlyFee;
    }
  };

  const renderPlanSelection = () => (
    <View style={styles.modalStepContent}>
      <Text style={styles.modalStepTitle}>Select Your Plan</Text>
      <View style={styles.plansContainer}>
        {[
          { type: "monthly" as PlanType, name: "Monthly", desc: "Pay monthly" },
          {
            type: "3months" as PlanType,
            name: "3 Months",
            desc: "Most popular",
          },
          {
            type: "6months" as PlanType,
            name: "6 Months",
            desc: "Great value",
          },
          {
            type: "12months" as PlanType,
            name: "Annual",
            desc: "Best savings",
          },
        ].map((plan) => {
          const price = getPriceForPlan(plan.type);

          return (
            <TouchableOpacity
              key={plan.type}
              style={[
                styles.planOption,
                selectedPlan === plan.type && styles.planOptionSelected,
              ]}
              onPress={() => setSelectedPlan(plan.type)}
            >
              <View style={styles.planOptionLeft}>
                <Ionicons
                  name="calendar"
                  size={22}
                  color={selectedPlan === plan.type ? "#4ade80" : "#64748b"}
                />
                <View>
                  <Text style={styles.planName}>{plan.name}</Text>
                  <Text style={styles.planDesc}>{plan.desc}</Text>
                </View>
              </View>
              <View style={styles.planPriceContainer}>
                <Text style={styles.planPrice}>₹{price}</Text>
                {plan.type !== "monthly" && (
                  <Text style={styles.monthlyEquivalent}>
                    ₹
                    {(
                      price /
                      (plan.type === "3months"
                        ? 3
                        : plan.type === "6months"
                          ? 6
                          : 12)
                    ).toFixed(0)}
                    /month
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderTimeSlotSelection = () => (
    <View style={styles.modalStepContent}>
      <Text style={styles.modalStepTitle}>Select Time Slot</Text>
      <Text style={styles.modalStepSubtitle}>
        Choose your preferred workout time
      </Text>
      <View style={styles.timeSlotsModalContainer}>
        {(["Morning", "Evening", "Night"] as TimeSlot[]).map((slot) => (
          <TouchableOpacity
            key={slot}
            style={[
              styles.timeSlotOption,
              selectedTimeSlot === slot && styles.timeSlotOptionSelected,
            ]}
            onPress={() => setSelectedTimeSlot(slot)}
          >
            <View style={styles.timeSlotModalIcon}>
              <Ionicons
                name={getTimeSlotIcon(slot)}
                size={24}
                color={selectedTimeSlot === slot ? "#4ade80" : "#64748b"}
              />
            </View>
            <View style={styles.timeSlotModalInfo}>
              <Text style={styles.timeSlotModalName}>{slot}</Text>
              <Text style={styles.timeSlotHours}>
                {slot === "Morning"
                  ? "6 AM - 4 PM"
                  : slot === "Evening"
                    ? "4 PM - 9 PM"
                    : "9 PM - 6 AM"}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderReviewAndPay = () => (
    <View style={styles.modalStepContent}>
      <Text style={styles.modalStepTitle}>Review & Payment</Text>
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Gym</Text>
          <Text style={styles.summaryValue}>{gym?.name}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Plan</Text>
          <Text style={styles.summaryValue}>{getPlanName()}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Duration</Text>
          <Text style={styles.summaryValue}>
            {getPlanDuration()} month{getPlanDuration() > 1 ? "s" : ""}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Time Slot</Text>
          <Text style={styles.summaryValue}>{selectedTimeSlot}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total Amount</Text>
          <Text style={styles.totalAmount}>₹{calculatePrice()}</Text>
        </View>
      </View>
      <View style={styles.instructionsCard}>
        <Ionicons name="information-circle" size={20} color="#3b82f6" />
        <Text style={styles.instructionsText}>
          After submitting your request, visit {gym?.name} to complete payment.
          Show your bill to the gym staff.
        </Text>
      </View>
    </View>
  );

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

  // Calculate plan prices for display
  const monthlyPrice = gym.monthlyFee;
  const quarterlyPrice = gym.quarterlyFee || gym.monthlyFee * 3;
  const sixMonthPrice = gym.annualFee ? gym.annualFee / 2 : gym.monthlyFee * 6;
  const annualPrice = gym.annualFee || gym.monthlyFee * 12;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0f1a" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#e9eef7" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gym Details</Text>
        <View style={styles.favoriteButton}>
          <Ionicons name="heart-outline" size={24} color="#e9eef7" />
        </View>
      </View>

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
        {/* Gym Hero */}
        <View style={styles.heroCard}>
          <View style={styles.gymIconLarge}>
            <Ionicons name="barbell" size={40} color="#0a0f1a" />
          </View>
          <Text style={styles.gymName}>{gym.name}</Text>

          {/* ⭐ ADDED: Reviews Section */}
          <View style={styles.reviewsSection}>
            <View style={styles.ratingDisplay}>
              {renderStars(averageRating)}
              <Text style={styles.averageRating}>
                {averageRating.toFixed(1)}
              </Text>
            </View>
            <Text style={styles.totalReviewsCount}>
              ({totalReviews} {totalReviews === 1 ? "review" : "reviews"})
            </Text>
          </View>

          {/* ⭐ ADDED: View Reviews Button */}
          <TouchableOpacity
            style={styles.viewReviewsButton}
            onPress={() => setShowReviewsModal(true)}
            disabled={totalReviews === 0}
          >
            <Text style={styles.viewReviewsButtonText}>
              {totalReviews === 0 ? "No Reviews Yet" : "View Reviews"}
            </Text>
            {totalReviews > 0 && (
              <Ionicons name="chevron-forward" size={16} color="#fbbf24" />
            )}
          </TouchableOpacity>
        </View>

        {/* Enrolled Members Banner */}
        <View style={styles.liveStatusCard}>
          <View style={styles.liveStatusHeader}>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Total Enrolled</Text>
            </View>
            <View style={styles.totalMembersContainer}>
              <Ionicons name="people" size={16} color="#4ade80" />
              <Text style={styles.totalMembersText}>
                {totalEnrolledMembers}{" "}
                {totalEnrolledMembers === 1 ? "member" : "members"}
              </Text>
            </View>
          </View>
        </View>

        {/* Enrollment Status Banner */}
        {userData?.gymId === id &&
          userData?.enrollmentStatus === "approved" && (
            <View style={styles.statusBanner}>
              <Ionicons name="checkmark-circle" size={20} color="#4ade80" />
              <Text style={styles.statusBannerText}>
                You are a member of this gym
              </Text>
            </View>
          )}
        {userData?.gymId === id && userData?.enrollmentStatus === "pending" && (
          <View style={styles.pendingBanner}>
            <View style={styles.pendingBannerContent}>
              <Ionicons name="time" size={20} color="#fbbf24" />
              <View style={styles.pendingTextContainer}>
                <Text style={styles.statusBannerText}>
                  Enrollment pending approval
                </Text>
                <Text style={styles.pendingSubtext}>
                  Please visit the gym to complete payment
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.cancelRequestButton}
              onPress={handleCancelEnrollment}
            >
              <Ionicons name="close-circle" size={16} color="#f87171" />
              <Text style={styles.cancelRequestText}>Cancel Request</Text>
            </TouchableOpacity>
          </View>
        )}
        {userData?.gymId &&
          userData?.gymId !== id &&
          userData?.enrollmentStatus !== "none" && (
            <View style={[styles.statusBanner, styles.statusBannerWarning]}>
              <Ionicons name="information-circle" size={20} color="#f97316" />
              <Text style={[styles.statusBannerText, { color: "#f97316" }]}>
                {`You're enrolled at another gym`}
              </Text>
            </View>
          )}

        {/* Contact Info with Copy Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="location" size={18} color="#4ade80" />
              <Text style={styles.infoText}>{gym.address}</Text>
            </View>

            {/* Phone with copy/call options */}
            <TouchableOpacity style={styles.contactRow} onPress={callGym}>
              <Ionicons name="call" size={18} color="#3b82f6" />
              <Text style={styles.contactText}>{gym.phone}</Text>
              <TouchableOpacity
                onPress={() => copyToClipboard(gym.phone, "Phone number")}
                style={styles.copyButton}
              >
                <Ionicons name="copy-outline" size={18} color="#64748b" />
              </TouchableOpacity>
            </TouchableOpacity>

            {/* Email with copy options */}
            {gym.email && (
              <TouchableOpacity style={styles.contactRow} onPress={emailGym}>
                <Ionicons name="mail" size={18} color="#f97316" />
                <Text style={styles.contactText}>{gym.email}</Text>
                <TouchableOpacity
                  onPress={() => copyToClipboard(gym.email!, "Email address")}
                  style={styles.copyButton}
                >
                  <Ionicons name="copy-outline" size={18} color="#64748b" />
                </TouchableOpacity>
              </TouchableOpacity>
            )}

            {/* Opening Hours */}
            {gym.openingHours && (
              <View style={styles.infoRow}>
                <Ionicons name="time" size={18} color="#a855f7" />
                <Text style={styles.infoText}>{gym.openingHours}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Enrolled Members by Time Slot */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Enrolled Members by Time Slot</Text>
          <View style={styles.timeSlotsContainer}>
            {(["Morning", "Evening", "Night"] as TimeSlot[]).map(
              renderTimeSlotInfo,
            )}
          </View>
        </View>

        {/* Minimalistic Membership Plans */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Membership Plans</Text>
          <View style={styles.minimalPlansContainer}>
            <View style={styles.minimalPlanRow}>
              <View style={styles.minimalPlanLeft}>
                <Ionicons name="calendar-outline" size={16} color="#4ade80" />
                <Text style={styles.minimalPlanName}>Monthly</Text>
              </View>
              <Text style={styles.minimalPlanPrice}>₹{monthlyPrice}</Text>
            </View>

            <View style={styles.planDivider} />

            <View style={styles.minimalPlanRow}>
              <View style={styles.minimalPlanLeft}>
                <Ionicons name="calendar" size={16} color="#fbbf24" />
                <Text style={styles.minimalPlanName}>3 Months</Text>
                <Text style={styles.savingsBadge}>
                  Save ₹{monthlyPrice * 3 - quarterlyPrice}
                </Text>
              </View>
              <Text style={styles.minimalPlanPrice}>₹{quarterlyPrice}</Text>
            </View>

            <View style={styles.planDivider} />

            <View style={styles.minimalPlanRow}>
              <View style={styles.minimalPlanLeft}>
                <Ionicons name="calendar" size={16} color="#8b5cf6" />
                <Text style={styles.minimalPlanName}>6 Months</Text>
                <Text style={styles.savingsBadge}>
                  Save ₹{monthlyPrice * 6 - sixMonthPrice}
                </Text>
              </View>
              <Text style={styles.minimalPlanPrice}>₹{sixMonthPrice}</Text>
            </View>

            <View style={styles.planDivider} />

            <View style={styles.minimalPlanRow}>
              <View style={styles.minimalPlanLeft}>
                <Ionicons name="calendar" size={16} color="#10b981" />
                <Text style={styles.minimalPlanName}>Annual</Text>
                <Text style={styles.savingsBadge}>
                  Save ₹{monthlyPrice * 12 - annualPrice}
                </Text>
              </View>
              <Text style={styles.minimalPlanPrice}>₹{annualPrice}</Text>
            </View>
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

        {/* Amenities */}
        {gym.amenities && gym.amenities.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Amenities</Text>
            <View style={styles.amenitiesContainer}>
              {gym.amenities.map((amenity, index) => (
                <View key={index} style={styles.amenityChip}>
                  <Ionicons name="checkmark-circle" size={14} color="#4ade80" />
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
          <Text style={styles.footerPrice}>₹{monthlyPrice}/month</Text>
        </View>
        <TouchableOpacity
          style={[
            styles.joinButton,
            !canJoinGym() && styles.joinButtonDisabled,
          ]}
          onPress={handleJoinNow}
          disabled={!canJoinGym()}
        >
          <Text style={styles.joinButtonText}>{getJoinButtonText()}</Text>
          {canJoinGym() && (
            <Ionicons name="arrow-forward" size={18} color="#0a0f1a" />
          )}
        </TouchableOpacity>
      </View>

      {/* ⭐ ADDED: Reviews Modal */}
      {renderReviewsModal()}

      {/* Join Modal */}
      <Modal
        visible={showJoinModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowJoinModal(false)}
      >
        <View style={styles.modalContainer}>
          <StatusBar barStyle="light-content" backgroundColor="#0a0f1a" />

          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalBackButton}
              onPress={() => {
                if (step > 1) {
                  setStep((step - 1) as 1 | 2 | 3);
                } else {
                  setShowJoinModal(false);
                }
              }}
            >
              <Ionicons name="arrow-back" size={24} color="#e9eef7" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Join {gym.name}</Text>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowJoinModal(false)}
            >
              <Ionicons name="close" size={24} color="#e9eef7" />
            </TouchableOpacity>
          </View>

          {/* Progress Steps */}
          <View style={styles.progressContainer}>
            {[1, 2, 3].map((num) => (
              <React.Fragment key={num}>
                <View style={styles.progressStep}>
                  <View
                    style={[
                      styles.progressCircle,
                      step >= num && styles.progressCircleActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.progressText,
                        step >= num && styles.progressTextActive,
                      ]}
                    >
                      {num}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.progressLabel,
                      step >= num && styles.progressLabelActive,
                    ]}
                  >
                    {num === 1 ? "Plan" : num === 2 ? "Time Slot" : "Payment"}
                  </Text>
                </View>
                {num < 3 && (
                  <View
                    style={[
                      styles.progressLine,
                      step > num && styles.progressLineActive,
                    ]}
                  />
                )}
              </React.Fragment>
            ))}
          </View>

          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            {/* Current Step Content */}
            {step === 1 && renderPlanSelection()}
            {step === 2 && renderTimeSlotSelection()}
            {step === 3 && renderReviewAndPay()}
          </ScrollView>

          {/* Modal Footer Buttons */}
          <View style={styles.modalFooter}>
            {step > 1 && (
              <TouchableOpacity
                style={styles.modalBackButtonFooter}
                onPress={() => setStep((step - 1) as 1 | 2 | 3)}
              >
                <Ionicons name="arrow-back" size={18} color="#e9eef7" />
                <Text style={styles.modalBackButtonText}>Back</Text>
              </TouchableOpacity>
            )}

            {step < 3 ? (
              <TouchableOpacity
                style={[
                  styles.modalNextButton,
                  step === 2 &&
                    !selectedTimeSlot &&
                    styles.modalNextButtonDisabled,
                ]}
                onPress={() => {
                  if (step === 2 && !selectedTimeSlot) return;
                  setStep((step + 1) as 1 | 2 | 3);
                }}
                disabled={step === 2 && !selectedTimeSlot}
              >
                <Text style={styles.modalNextButtonText}>Next</Text>
                <Ionicons name="arrow-forward" size={18} color="#0a0f1a" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  styles.modalSubmitButton,
                  submitting && styles.modalSubmitButtonDisabled,
                ]}
                onPress={handleSubmitEnrollment}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#0a0f1a" size="small" />
                ) : (
                  <>
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color="#0a0f1a"
                    />
                    <Text style={styles.modalSubmitButtonText}>
                      Submit Request
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default GymDetails;

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
  loadingText: {
    color: "#94a3b8",
    marginTop: 16,
    fontSize: 16,
  },
  errorText: {
    color: "#94a3b8",
    marginTop: 16,
    fontSize: 18,
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: width * 0.05,
    paddingVertical: 16,
    paddingTop: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#e9eef7",
  },
  favoriteButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  scrollContent: {
    paddingHorizontal: width * 0.05,
    paddingBottom: 120,
    paddingTop: 8,
  },
  heroCard: {
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  gymIconLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#4ade80",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  gymName: {
    fontSize: 24,
    fontWeight: "800",
    color: "#e9eef7",
    textAlign: "center",
    marginBottom: 12,
  },
  // ⭐ ADDED: Reviews Section Styles
  reviewsSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    flexWrap: "wrap",
  },
  ratingDisplay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  averageRating: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fbbf24",
    marginLeft: 4,
  },
  totalReviewsCount: {
    fontSize: 13,
    color: "#94a3b8",
    marginLeft: 8,
  },
  viewReviewsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(251, 191, 36, 0.1)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.2)",
  },
  viewReviewsButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fbbf24",
  },
  liveStatusCard: {
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(74, 222, 128, 0.3)",
  },
  liveStatusHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4ade80",
  },
  liveText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4ade80",
  },
  totalMembersContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(74, 222, 128, 0.1)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  totalMembersText: {
    fontSize: 13,
    color: "#4ade80",
    fontWeight: "600",
  },
  statusBanner: {
    backgroundColor: "rgba(74, 222, 128, 0.15)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(74, 222, 128, 0.3)",
  },
  pendingBanner: {
    backgroundColor: "rgba(251, 191, 36, 0.15)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.3)",
  },
  pendingBannerContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 8,
  },
  pendingTextContainer: {
    flex: 1,
  },
  pendingSubtext: {
    fontSize: 12,
    color: "#fbbf24",
    opacity: 0.8,
    marginTop: 2,
  },
  cancelRequestButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(248, 113, 113, 0.1)",
  },
  cancelRequestText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#f87171",
  },
  statusBannerWarning: {
    backgroundColor: "rgba(249, 115, 22, 0.15)",
    borderColor: "rgba(249, 115, 22, 0.3)",
  },
  statusBannerText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4ade80",
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#e9eef7",
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    gap: 14,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: "#e9eef7",
    lineHeight: 22,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  contactText: {
    flex: 1,
    fontSize: 14,
    color: "#e9eef7",
  },
  copyButton: {
    padding: 6,
  },
  timeSlotsContainer: {
    gap: 12,
  },
  timeSlotCard: {
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timeSlotHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  timeSlotIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  timeSlotInfo: {
    flex: 1,
  },
  timeSlotTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#e9eef7",
  },
  timeSlotTime: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 2,
  },
  memberCountBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  memberCountText: {
    fontSize: 14,
    fontWeight: "600",
  },
  minimalPlansContainer: {
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  minimalPlanRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  minimalPlanLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  minimalPlanName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#e9eef7",
    flex: 1,
  },
  minimalPlanPrice: {
    fontSize: 17,
    fontWeight: "700",
    color: "#4ade80",
  },
  savingsBadge: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fbbf24",
    backgroundColor: "rgba(251, 191, 36, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  planDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginVertical: 6,
  },
  descriptionCard: {
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  descriptionText: {
    fontSize: 14,
    color: "#94a3b8",
    lineHeight: 22,
  },
  amenitiesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  amenityChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(74, 222, 128, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  amenityText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4ade80",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    paddingHorizontal: width * 0.05,
    paddingVertical: 16,
    paddingBottom: Platform.OS === "ios" ? 32 : 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  priceFooter: {
    flex: 1,
  },
  footerLabel: {
    fontSize: 12,
    color: "#64748b",
  },
  footerPrice: {
    fontSize: 20,
    fontWeight: "800",
    color: "#4ade80",
  },
  joinButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#4ade80",
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 14,
  },
  joinButtonDisabled: {
    backgroundColor: "#64748b",
    opacity: 0.6,
  },
  joinButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0a0f1a",
  },

  // ⭐ ADDED: Reviews Modal Styles
  reviewsModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  reviewsModalContent: {
    backgroundColor: "#0a0f1a",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.85,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
  },
  reviewsModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  reviewsHeaderLeft: {
    flex: 1,
  },
  reviewsModalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#e9eef7",
    marginBottom: 12,
  },
  reviewsSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  averageRatingLarge: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fbbf24",
  },
  ratingStarsLarge: {
    flexDirection: "row",
    alignItems: "center",
  },
  totalReviewsText: {
    fontSize: 14,
    color: "#94a3b8",
    marginLeft: 8,
  },
  reviewsCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  reviewsList: {
    maxHeight: height * 0.6,
    paddingHorizontal: 20,
  },
  reviewsLoading: {
    paddingVertical: 40,
    alignItems: "center",
  },
  loadingReviewsText: {
    fontSize: 14,
    color: "#94a3b8",
    marginTop: 12,
  },
  noReviewsContainer: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  noReviewsText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#e9eef7",
    marginTop: 16,
  },
  noReviewsSubtext: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 8,
    textAlign: "center",
  },
  reviewItem: {
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(74, 222, 128, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  userInitial: {
    fontSize: 18,
    fontWeight: "700",
    color: "#4ade80",
  },
  reviewUserInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#e9eef7",
    marginBottom: 2,
  },
  reviewDate: {
    fontSize: 12,
    color: "#64748b",
  },
  ratingContainerSmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingTextSmall: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fbbf24",
  },
  reviewComment: {
    fontSize: 14,
    color: "#94a3b8",
    lineHeight: 20,
  },
  noCommentText: {
    fontSize: 13,
    color: "#64748b",
    fontStyle: "italic",
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: "#0a0f1a",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: width * 0.05,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  modalBackButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  modalHeaderTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#e9eef7",
  },
  modalScrollContent: {
    paddingHorizontal: width * 0.05,
    paddingBottom: 120,
  },
  modalStepContent: {
    marginBottom: 20,
  },
  modalStepTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#e9eef7",
    marginBottom: 8,
  },
  modalStepSubtitle: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 20,
  },
  plansContainer: {
    gap: 12,
  },
  planOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 16,
    padding: 18,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.06)",
  },
  planOptionSelected: {
    borderColor: "#4ade80",
    backgroundColor: "rgba(74, 222, 128, 0.1)",
  },
  planOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },
  planName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#e9eef7",
  },
  planDesc: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  planPriceContainer: {
    alignItems: "flex-end",
  },
  planPrice: {
    fontSize: 20,
    fontWeight: "800",
    color: "#4ade80",
  },
  monthlyEquivalent: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },
  timeSlotsModalContainer: {
    gap: 12,
  },
  timeSlotOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 16,
    padding: 18,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.06)",
  },
  timeSlotOptionSelected: {
    borderColor: "#4ade80",
    backgroundColor: "rgba(74, 222, 128, 0.1)",
  },
  timeSlotModalIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  timeSlotModalInfo: {
    flex: 1,
  },
  timeSlotModalName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#e9eef7",
  },
  timeSlotHours: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 2,
  },
  summaryCard: {
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  summaryLabel: {
    fontSize: 15,
    color: "#94a3b8",
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#e9eef7",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginVertical: 14,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 17,
    fontWeight: "700",
    color: "#e9eef7",
  },
  totalAmount: {
    fontSize: 26,
    fontWeight: "900",
    color: "#4ade80",
  },
  instructionsCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    borderRadius: 16,
    padding: 18,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.2)",
  },
  instructionsText: {
    flex: 1,
    fontSize: 14,
    color: "#94a3b8",
    lineHeight: 20,
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: width * 0.05,
    marginVertical: 24,
  },
  progressStep: {
    alignItems: "center",
  },
  progressCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.1)",
  },
  progressCircleActive: {
    backgroundColor: "#4ade80",
    borderColor: "#4ade80",
  },
  progressText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#64748b",
  },
  progressTextActive: {
    color: "#0a0f1a",
  },
  progressLabel: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 8,
  },
  progressLabelActive: {
    color: "#e9eef7",
    fontWeight: "600",
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginHorizontal: 10,
  },
  progressLineActive: {
    backgroundColor: "#4ade80",
  },
  modalFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    paddingHorizontal: width * 0.05,
    paddingVertical: 18,
    paddingBottom: Platform.OS === "ios" ? 32 : 18,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  modalBackButtonFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "rgba(30, 41, 59, 0.8)",
  },
  modalBackButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#e9eef7",
  },
  modalNextButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#4ade80",
    paddingVertical: 16,
    borderRadius: 14,
  },
  modalNextButtonDisabled: {
    opacity: 0.5,
  },
  modalNextButtonText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0a0f1a",
  },
  modalSubmitButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#4ade80",
    paddingVertical: 16,
    borderRadius: 14,
  },
  modalSubmitButtonDisabled: {
    opacity: 0.6,
  },
  modalSubmitButtonText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0a0f1a",
  },
});
