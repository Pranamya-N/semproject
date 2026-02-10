import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
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
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";
import { Gym, IssueType, ReportStatus } from "../types/index";

const { width, height } = Dimensions.get("window");
const isSmall = height < 700;

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

  const [activeCheckInsCount, setActiveCheckInsCount] = useState<number>(0);
  const [currentTimeSlot, setCurrentTimeSlot] = useState<
    "Morning" | "Evening" | "Night"
  >("Morning");

  const [showPlanDetailsModal, setShowPlanDetailsModal] =
    useState<boolean>(false);

  const [initialLoadDone, setInitialLoadDone] = useState<boolean>(false);
  const [checkInStartTime, setCheckInStartTime] = useState<Date | null>(null);

  // 🔔 NOTIFICATION STATE
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<
    {
      id: string;
      title: string;
      message: string;
      date: Date;
      type: "report" | "enrollment" | "payment" | "general";
      read: boolean;
      reportId?: string;
    }[]
  >([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // ⭐ ADDED: RATING STATE
  const [showRatingModal, setShowRatingModal] = useState<boolean>(false);
  const [showLeaveRatingModal, setShowLeaveRatingModal] =
    useState<boolean>(false);
  const [rating, setRating] = useState<number>(0);
  const [reviewComment, setReviewComment] = useState<string>("");
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);
  const [hasGivenReview, setHasGivenReview] = useState<boolean>(false);

  // ⭐ ADDED: SWIPE-TO-REFRESH STATE
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (userData && !initialLoadDone) {
      checkEnrollmentAndFetchGym();
      setInitialLoadDone(true);
    }
  }, [userData]);

  useEffect(() => {
    const now = new Date();
    const currentHour = now.getHours();
    if (currentHour >= 6 && currentHour < 16) {
      setCurrentTimeSlot("Morning");
    } else if (currentHour >= 16 && currentHour < 21) {
      setCurrentTimeSlot("Evening");
    } else {
      setCurrentTimeSlot("Night");
    }
  }, []);

  // 🔔 FETCH NOTIFICATIONS
  useEffect(() => {
    if (userData?.uid) {
      fetchUserNotifications();
      checkIfUserHasReviewed();
    }
  }, [userData?.uid]);

  // ⭐ ADDED: MAIN REFRESH FUNCTION
  const refreshAllData = async () => {
    setRefreshing(true);
    try {
      if (userData?.enrollmentStatus === "approved" && userData?.gymId) {
        await fetchGymData(userData.gymId);
        await loadUserStats();
      } else {
        setLoading(false);
      }
      await refreshUserData();

      // Also refresh notifications
      if (userData?.uid) {
        await fetchUserNotifications();
      }

      console.log("✅ All data refreshed");
    } catch (error) {
      console.error("Error refreshing data:", error);
      Alert.alert(
        "Refresh Failed",
        "Could not refresh data. Please try again.",
      );
    } finally {
      setRefreshing(false);
    }
  };

  const checkEnrollmentAndFetchGym = async () => {
    if (userData?.enrollmentStatus === "approved" && userData?.gymId) {
      await fetchGymData(userData.gymId);
      await loadUserStats();
    } else {
      setLoading(false);
    }
  };

  const fetchGymData = async (gymId: string) => {
    try {
      const gymDoc = await getDoc(doc(db, "gyms", gymId));
      if (gymDoc.exists()) {
        const gymData = {
          id: gymDoc.id,
          ...gymDoc.data(),
          createdAt: gymDoc.data().createdAt?.toDate() || new Date(),
        } as Gym;
        setGym(gymData);
        fetchActiveCheckInsCount(gymId);
      }
    } catch (error) {
      console.error("Error fetching gym:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveCheckInsCount = async (gymId: string) => {
    try {
      const activeCheckInsRef = collection(db, "activeCheckIns");
      const q = query(activeCheckInsRef, where("gymId", "==", gymId));
      const querySnapshot = await getDocs(q);

      setActiveCheckInsCount(querySnapshot.size);

      if (userData?.uid) {
        const userCheckInDoc = querySnapshot.docs.find(
          (doc) => doc.id === userData.uid,
        );

        if (userCheckInDoc) {
          setIsCheckedIn(true);
          const checkInData = userCheckInDoc.data();
          const checkInTime = checkInData.checkInTime?.toDate();

          if (checkInTime) {
            setCheckInStartTime(checkInTime);

            const now = new Date();
            const elapsedSeconds = Math.max(
              0,
              Math.floor((now.getTime() - checkInTime.getTime()) / 1000),
            );

            setTimerSeconds(elapsedSeconds);

            if (!timerRef.current) {
              timerRef.current = setInterval(
                () =>
                  setTimerSeconds((prev) => {
                    return Math.max(0, prev + 1);
                  }),
                1000,
              );
            }
          }
        } else {
          setIsCheckedIn(false);
          setTimerSeconds(0);
          setCheckInStartTime(null);
        }
      }
    } catch (error: any) {
      console.error("Error fetching active check-ins:", error.message);
      setActiveCheckInsCount(0);
    }
  };

  const loadUserStats = async () => {
    try {
      if (!userData?.uid) return;

      const userDoc = await getDoc(doc(db, "users", userData.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        const firebaseStreak = Number(data.streak) || 0;
        const firebaseDuration = Number(data.totalDuration) || 0;

        setStreak(firebaseStreak);
        setTotalDuration(firebaseDuration);
      }
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  // ⭐ ADDED: Check if user has reviewed current gym
  const checkIfUserHasReviewed = async () => {
    try {
      if (!userData?.uid || !userData?.gymId) return;

      const reviewsRef = collection(db, "gymReviews");
      const reviewQuery = query(
        reviewsRef,
        where("userId", "==", userData.uid),
        where("gymId", "==", userData.gymId),
      );

      const querySnapshot = await getDocs(reviewQuery);
      setHasGivenReview(!querySnapshot.empty);
    } catch (error) {
      console.error("Error checking reviews:", error);
    }
  };

  // 🔔 FETCH USER NOTIFICATIONS (UPDATED WITH FIRESTORE READ STATUS)
  const fetchUserNotifications = async () => {
    try {
      if (!userData?.uid) return;

      // Fetch resolved reports for this user
      const reportsRef = collection(db, "gymReports");
      const reportsQuery = query(
        reportsRef,
        where("userId", "==", userData.uid),
        where("status", "in", ["resolved", "reviewed", "rejected"]),
      );

      const snapshot = await getDocs(reportsQuery);
      const reportNotifications = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          title: `Report ${data.status === "resolved" ? "Resolved" : data.status === "reviewed" ? "Reviewed" : "Rejected"}`,
          message:
            data.adminNotes ||
            `Your report has been ${data.status}${data.status === "resolved" ? " and the issue has been addressed." : data.status === "reviewed" ? " and is under review." : " by the admin."}`,
          date: data.reviewedAt?.toDate() || new Date(),
          type: "report" as const,
          // ⭐ FIXED: Use Firestore read status instead of always false
          read: data.userHasRead || false,
          reportId: doc.id,
        };
      });

      // Sort by date (newest first)
      const sortedNotifications = reportNotifications.sort(
        (a, b) => b.date.getTime() - a.date.getTime(),
      );

      setNotifications(sortedNotifications);
      setUnreadCount(sortedNotifications.filter((n) => !n.read).length);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  };

  const updateUserStatsInFirebase = async (
    streakValue: number,
    totalDurationValue: number,
  ) => {
    if (!userData?.uid) return;

    try {
      await updateDoc(doc(db, "users", userData.uid), {
        streak: streakValue,
        totalDuration: totalDurationValue,
        statsUpdatedAt: serverTimestamp(),
      });
      console.log("✅ User stats updated in Firebase:", {
        streak: streakValue,
        totalDuration: totalDurationValue,
      });
    } catch (error) {
      console.error("Error updating user stats in Firebase:", error);
    }
  };

  // FIXED STREAK LOGIC - Handles midnight crossovers correctly
  const calculateStreak = async (): Promise<number> => {
    if (!userData?.uid) return 1;

    try {
      const checkInHistoryRef = collection(db, "checkInHistory");
      const userCheckInsQuery = query(
        checkInHistoryRef,
        where("userId", "==", userData.uid),
      );
      const querySnapshot = await getDocs(userCheckInsQuery);

      if (querySnapshot.empty) return 1;

      // Get ALL unique check-in dates (handles both date field and timestamps)
      const checkInDates = new Set<string>();

      querySnapshot.forEach((doc) => {
        const data = doc.data();

        // Priority 1: Use the date field if it exists
        if (data.date && typeof data.date === "string") {
          checkInDates.add(data.date);
        }
        // Priority 2: Extract date from checkOutTime
        else if (data.checkOutTime) {
          try {
            const checkOutDate = data.checkOutTime.toDate();
            // Convert to LOCAL date (not UTC)
            const localDate = new Date(
              checkOutDate.getFullYear(),
              checkOutDate.getMonth(),
              checkOutDate.getDate(),
            );
            const dateStr = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, "0")}-${String(localDate.getDate()).padStart(2, "0")}`;
            checkInDates.add(dateStr);
          } catch (e) {
            console.warn("Could not parse checkOutTime:", e);
          }
        }
        // Priority 3: Extract date from checkInTime
        else if (data.checkInTime) {
          try {
            const checkInDate = data.checkInTime.toDate();
            const localDate = new Date(
              checkInDate.getFullYear(),
              checkInDate.getMonth(),
              checkInDate.getDate(),
            );
            const dateStr = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, "0")}-${String(localDate.getDate()).padStart(2, "0")}`;
            checkInDates.add(dateStr);
          } catch (e) {
            console.warn("Could not parse checkInTime:", e);
          }
        }
      });

      // Convert to sorted array (newest first)
      const sortedDates = Array.from(checkInDates).sort().reverse();
      console.log("📅 All check-in dates:", sortedDates);

      // Get TODAY'S date in LOCAL timezone
      const now = new Date();
      const todayLocal = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const todayStr = `${todayLocal.getFullYear()}-${String(todayLocal.getMonth() + 1).padStart(2, "0")}-${String(todayLocal.getDate()).padStart(2, "0")}`;

      // Get YESTERDAY'S date
      const yesterday = new Date(todayLocal);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

      console.log("🗓️ Today:", todayStr, "| Yesterday:", yesterdayStr);

      // Check if user already checked in today
      const checkedInToday = sortedDates.includes(todayStr);
      const checkedInYesterday = sortedDates.includes(yesterdayStr);

      console.log("✅ Checked in today?", checkedInToday);
      console.log("✅ Checked in yesterday?", checkedInYesterday);

      // If already checked in today, calculate current streak
      if (checkedInToday) {
        let streakCount = 0;
        let currentDate = new Date(todayLocal);

        // Count consecutive days backwards from today
        while (true) {
          const dateString = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(currentDate.getDate()).padStart(2, "0")}`;
          if (sortedDates.includes(dateString)) {
            streakCount++;
            currentDate.setDate(currentDate.getDate() - 1);
          } else {
            break;
          }
        }

        console.log(
          "🔥 Current streak (already checked in today):",
          streakCount,
        );
        return Math.max(streakCount, 1);
      }

      // If checking in for FIRST TIME today and checked in yesterday
      if (checkedInYesterday) {
        // Calculate streak from yesterday backwards
        let streakCount = 0;
        let currentDate = new Date(yesterday);

        while (true) {
          const dateString = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(currentDate.getDate()).padStart(2, "0")}`;
          if (sortedDates.includes(dateString)) {
            streakCount++;
            currentDate.setDate(currentDate.getDate() - 1);
          } else {
            break;
          }
        }

        // Add 1 for today's new check-in
        const newStreak = streakCount + 1;
        console.log("🔥 New streak (checked in yesterday):", newStreak);
        return newStreak;
      }

      // No check-in yesterday, streak starts at 1
      console.log("🔥 New streak (no check-in yesterday):", 1);
      return 1;
    } catch (error) {
      console.error("❌ Error calculating streak:", error);
      // Fallback: use existing streak + 1
      return Math.max(streak + 1, 1);
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
    setCheckInStartTime(now);

    // DON'T calculate streak here - the record doesn't exist yet!
    // Streak will be calculated during checkout
    console.log("✅ Check-in started, current streak:", streak);

    // Start timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setTimerSeconds(0);
    timerRef.current = setInterval(
      () => setTimerSeconds((prev) => Math.max(0, prev + 1)),
      1000,
    );

    // Track active check-in in Firestore
    if (userData?.uid && userData?.gymId) {
      try {
        const currentHour = now.getHours();
        let currentTimeSlot: "Morning" | "Evening" | "Night";

        if (currentHour >= 6 && currentHour < 16) {
          currentTimeSlot = "Morning";
        } else if (currentHour >= 16 && currentHour < 21) {
          currentTimeSlot = "Evening";
        } else {
          currentTimeSlot = "Night";
        }

        await setDoc(doc(db, "activeCheckIns", userData.uid), {
          userId: userData.uid,
          userName: userData.displayName || "User",
          gymId: userData.gymId,
          gymName: gym?.name || "Unknown Gym",
          timeSlot: currentTimeSlot,
          checkInTime: serverTimestamp(),
          createdAt: serverTimestamp(),
        });

        if (gym?.id) {
          fetchActiveCheckInsCount(gym.id);
        }
      } catch (error: any) {
        console.error("Error tracking check-in:", error.message);
        Alert.alert("Error", "Failed to check in. Please try again.");
        setIsCheckedIn(false);
        setCheckInStartTime(null);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        return;
      }
    }
  };

  const performCheckOut = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const duration = timerSeconds;
    const now = new Date();

    // CRITICAL: Get LOCAL date (not UTC) for correct date tracking
    const todayLocal = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const dateKey = `${todayLocal.getFullYear()}-${String(todayLocal.getMonth() + 1).padStart(2, "0")}-${String(todayLocal.getDate()).padStart(2, "0")}`;

    console.log("🕒 Check-out time:", now.toLocaleString());
    console.log("📅 Check-out date key (LOCAL):", dateKey);

    const newTotalDuration = totalDuration + duration;
    setTotalDuration(newTotalDuration);
    setIsCheckedIn(false);
    setCheckoutSuccess(true);

    // Save to Firestore FIRST, then calculate streak
    if (userData?.uid && userData?.gymId && checkInStartTime) {
      try {
        const currentHour = now.getHours();
        let currentTimeSlot: "Morning" | "Evening" | "Night";

        if (currentHour >= 6 && currentHour < 16) {
          currentTimeSlot = "Morning";
        } else if (currentHour >= 16 && currentHour < 21) {
          currentTimeSlot = "Evening";
        } else {
          currentTimeSlot = "Night";
        }

        // FIXED: Ensure all required fields are saved
        const checkInRecord = {
          userId: userData.uid,
          userName: userData.displayName || "User",
          userEmail: userData.email || "",
          gymId: userData.gymId,
          gymName: gym?.name || "Unknown Gym", // FIX: Ensure gymName is never undefined
          timeSlot: currentTimeSlot,
          date: dateKey, // LOCAL DATE - This is what streak calculation uses
          checkInTime: serverTimestamp(),
          checkOutTime: serverTimestamp(),
          duration: duration,
          createdAt: serverTimestamp(),
        };

        console.log("💾 Saving check-in record:", {
          ...checkInRecord,
          checkInTime: "serverTimestamp",
          checkOutTime: "serverTimestamp",
          createdAt: "serverTimestamp",
        });

        // Save PERMANENT record with LOCAL date
        await addDoc(collection(db, "checkInHistory"), checkInRecord);

        // NOW calculate streak AFTER the record is saved
        const newStreak = await calculateStreak();
        console.log("🔥 Calculated new streak after checkout:", newStreak);
        setStreak(newStreak);

        // Update Firebase with new stats
        await updateUserStatsInFirebase(newStreak, newTotalDuration);

        // Remove from ACTIVE check-ins
        await deleteDoc(doc(db, "activeCheckIns", userData.uid));

        if (gym?.id) {
          fetchActiveCheckInsCount(gym.id);
        }

        console.log("✅ Check-out completed successfully!");
      } catch (error: any) {
        console.error("❌ Error during check-out:", error.message);
        Alert.alert(
          "Error",
          "Failed to save check-out record. Please try again.",
        );
        setIsCheckedIn(true);
        if (checkInStartTime) {
          timerRef.current = setInterval(
            () => setTimerSeconds((prev) => Math.max(0, prev + 1)),
            1000,
          );
        }
        return;
      }
    }

    setTimerSeconds(0);
    setCheckInStartTime(null);

    setTimeout(() => {
      setCheckoutSuccess(false);
    }, 5000);
  };

  // ⭐ ADDED: Force checkout without streak calculation (for leaving gym)
  const forceCheckOutWithoutStreak = async () => {
    if (!userData?.uid) return;

    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Remove from active check-ins
    try {
      await deleteDoc(doc(db, "activeCheckIns", userData.uid));

      // Update local state
      setIsCheckedIn(false);
      setCheckInStartTime(null);
      setTimerSeconds(0);

      if (gym?.id) {
        fetchActiveCheckInsCount(gym.id);
      }

      console.log("✅ Forced checkout completed (no streak recorded)");
    } catch (error) {
      console.error("Error during forced checkout:", error);
    }
  };

  // ⭐ ADDED: Submit gym review
  const handleSubmitReview = async () => {
    if (rating === 0) {
      Alert.alert("Error", "Please select a rating");
      return;
    }

    setSubmittingReview(true);
    try {
      await addDoc(collection(db, "gymReviews"), {
        gymId: gym?.id,
        userId: userData?.uid,
        userName: userData?.displayName || "User",
        userEmail: userData?.email || "",
        userPhone: userData?.phone || "",
        rating: rating,
        comment: reviewComment.trim(),
        createdAt: serverTimestamp(),
      });

      // Update user's hasReviewedCurrentGym status
      if (userData?.uid) {
        await updateDoc(doc(db, "users", userData.uid), {
          hasReviewedCurrentGym: true,
        });
        await refreshUserData();
      }

      setHasGivenReview(true);
      Alert.alert("Success", "Thank you for your review!");
      setShowRatingModal(false);
      setShowLeaveRatingModal(false);
      setRating(0);
      setReviewComment("");
    } catch (error) {
      console.error("Error submitting review:", error);
      Alert.alert("Error", "Failed to submit review. Please try again.");
    } finally {
      setSubmittingReview(false);
    }
  };

  // ⭐ MODIFIED: Handle leave gym with rating prompt
  const handleLeaveGym = () => {
    // If user hasn't reviewed this gym, show rating modal first
    if (!hasGivenReview) {
      setShowLeaveRatingModal(true);
      return;
    }

    // If already reviewed, proceed with normal leave
    Alert.alert(
      "Leave Gym",
      `Are you sure you want to leave ${gym?.name}?\n\n⚠️ WARNING: Your membership payment is non-refundable.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave Gym",
          style: "destructive",
          onPress: () => performLeaveGym(false),
        },
      ],
    );
  };

  // ⭐ FIXED: Actual leave gym function with proper streak reset
  const performLeaveGym = async (skipRating: boolean = false) => {
    try {
      if (!userData?.uid) return;

      // 1. First, update local state immediately
      setStreak(0);
      setTotalDuration(0);
      setIsCheckedIn(false);
      setTimerSeconds(0);
      setCheckInStartTime(null);

      // 2. Force checkout if checked in (without creating check-in history)
      if (isCheckedIn) {
        await forceCheckOutWithoutStreak();
      }

      // 3. Update Firestore with CLEAR streak reset
      await updateDoc(doc(db, "users", userData.uid), {
        gymId: null,
        enrollmentStatus: "none",
        paymentMethod: null,
        transactionId: null,
        enrolledAt: null,
        streak: 0, // Explicitly set to 0
        totalDuration: 0, // Explicitly set to 0
        hasReviewedCurrentGym: false,
        statsUpdatedAt: serverTimestamp(), // Force update timestamp
      });

      // 4. Clear local gym data
      setGym(null);
      setActiveCheckInsCount(0);

      // 5. Refresh user data and navigate
      await refreshUserData();
      router.replace("/(member)/home");
      Alert.alert(
        "Success",
        "You have left the gym. Your streak has been reset to 0.",
      );
    } catch (error) {
      console.error("Error leaving gym:", error);
      Alert.alert("Error", "Failed to leave gym. Please try again.");
    }
  };

  // ⭐ ADDED: Skip rating and leave gym
  const handleSkipRatingAndLeave = () => {
    setShowLeaveRatingModal(false);
    Alert.alert(
      "Leave Gym",
      `Are you sure you want to leave ${gym?.name}?\n\n⚠️ WARNING: Your membership payment is non-refundable.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave Gym",
          style: "destructive",
          onPress: () => performLeaveGym(true),
        },
      ],
    );
  };

  // ⭐ ADDED: Manual streak reset function (for debugging)
  const resetStreakManually = async () => {
    try {
      if (!userData?.uid) return;

      await updateDoc(doc(db, "users", userData.uid), {
        streak: 0,
        statsUpdatedAt: serverTimestamp(),
      });

      setStreak(0);
      Alert.alert("Success", "Streak has been reset to 0");
    } catch (error) {
      console.error("Error resetting streak:", error);
      Alert.alert("Error", "Failed to reset streak");
    }
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
        gymName: gym?.name || "Unknown Gym",
        userId: userData?.uid,
        userName: userData?.displayName || "User",
        userEmail: userData?.email || "",
        issueTypes: selectedIssues,
        description: reportDescription,
        status: "pending" as ReportStatus,
        createdAt: serverTimestamp(),
        userHasRead: false, // ⭐ ADDED: Initialize read status
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

  // 🔔 NOTIFICATION FUNCTIONS (UPDATED WITH FIRESTORE)
  const markAsRead = async (notificationId: string) => {
    try {
      // Update in Firestore
      await updateDoc(doc(db, "gymReports", notificationId), {
        userHasRead: true,
      });

      // Update local state
      setNotifications((prev) =>
        prev.map((notif) =>
          notificationId === notif.id ? { ...notif, read: true } : notif,
        ),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking as read:", error);
      // Fallback to local update
      setNotifications((prev) =>
        prev.map((notif) =>
          notificationId === notif.id ? { ...notif, read: true } : notif,
        ),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  };

  const markAllAsRead = async () => {
    try {
      // Update all notifications in Firestore
      const updatePromises = notifications
        .filter((notif) => !notif.read)
        .map(async (notif) => {
          if (notif.reportId) {
            await updateDoc(doc(db, "gymReports", notif.reportId), {
              userHasRead: true,
            });
          }
        });

      await Promise.all(updatePromises);
    } catch (error) {
      console.error("Error marking all as read:", error);
    }

    // Update local state
    setNotifications((prev) => prev.map((notif) => ({ ...notif, read: true })));
    setUnreadCount(0);
  };

  const clearAllNotifications = () => {
    Alert.alert(
      "Clear All",
      "Are you sure you want to clear all notifications?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: () => {
            setNotifications([]);
            setUnreadCount(0);
          },
        },
      ],
    );
  };

  const formatNotificationTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    } else if (mins > 0) {
      return `${mins}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const getPlanName = (paymentMethod: string | undefined) => {
    if (!paymentMethod) return "Not selected";
    switch (paymentMethod) {
      case "Quarterly":
        return "3 Month Plan";
      case "6-Month":
        return "6 Month Plan";
      case "online":
        return "Monthly Plan (Online)";
      case "offline":
        return "Offline Payment";
      default:
        return paymentMethod;
    }
  };

  const getTimeSlotDisplay = (timeSlot: string | undefined | null) => {
    if (!timeSlot) return "Not selected";
    switch (timeSlot) {
      case "Morning":
        return "Morning (6 AM - 4 PM)";
      case "Evening":
        return "Evening (4 PM - 9 PM)";
      case "Night":
        return "Night (9 PM - 6 AM)";
      default:
        return timeSlot;
    }
  };

  const getTimeSlotIcon = (timeSlot: string | undefined | null) => {
    if (!timeSlot) return "time-outline";
    switch (timeSlot) {
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

  const getTimeSlotColor = (timeSlot: string | undefined | null) => {
    if (!timeSlot) return "#64748b";
    switch (timeSlot) {
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

  const copyToClipboard = (text: string) => {
    Alert.alert("Copied!", "Details copied to clipboard");
  };

  // ⭐ ADDED: Render star rating
  const renderStars = (count: number, size: number = 32) => {
    return Array(5)
      .fill(0)
      .map((_, index) => (
        <TouchableOpacity
          key={index}
          onPress={() => setRating(index + 1)}
          style={styles.starButton}
        >
          <Ionicons
            name={index < count ? "star" : "star-outline"}
            size={size}
            color="#fbbf24"
          />
        </TouchableOpacity>
      ));
  };

  const renderPlanDetailsModal = () => (
    <Modal
      visible={showPlanDetailsModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowPlanDetailsModal(false)}
    >
      <View style={styles.planModalOverlay}>
        <View style={styles.planModalContent}>
          <View style={styles.planModalHeader}>
            <Text style={styles.planModalTitle}>Your Enrollment Details</Text>
            <TouchableOpacity
              onPress={() => setShowPlanDetailsModal(false)}
              style={styles.planModalCloseButton}
            >
              <Ionicons name="close" size={24} color="#e9eef7" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.planModalScroll}>
            <View style={styles.planSection}>
              <View style={styles.planSectionHeader}>
                <Ionicons name="time-outline" size={20} color="#fbbf24" />
                <Text style={styles.planSectionTitle}>Status</Text>
              </View>
              <View style={styles.statusBadgeContainer}>
                <View style={styles.pendingStatusBadge}>
                  <Ionicons name="time-outline" size={16} color="#fbbf24" />
                  <Text style={styles.pendingStatusText}>Pending Approval</Text>
                </View>
                <Text style={styles.statusDescription}>
                  {`Your enrollment request is under review by gym admin. You'll
                  receive notification once approved.`}
                </Text>
              </View>
            </View>

            {gym && (
              <View style={styles.planSection}>
                <View style={styles.planSectionHeader}>
                  <Ionicons name="barbell-outline" size={20} color="#4ade80" />
                  <Text style={styles.planSectionTitle}>Gym Details</Text>
                </View>
                <View style={styles.detailCard}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Gym Name</Text>
                    <Text style={styles.detailValue}>{gym.name}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Address</Text>
                    <Text style={styles.detailValue}>{gym.address}</Text>
                  </View>
                  {gym.phone && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Phone</Text>
                      <Text style={styles.detailValue}>{gym.phone}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            <View style={styles.planSection}>
              <View style={styles.planSectionHeader}>
                <Ionicons name="card-outline" size={20} color="#3b82f6" />
                <Text style={styles.planSectionTitle}>Plan Details</Text>
              </View>
              <View style={styles.detailCard}>
                <View style={styles.detailRowWithIcon}>
                  <View style={styles.iconCircleSmall}>
                    <Ionicons
                      name="calendar-outline"
                      size={16}
                      color="#4ade80"
                    />
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Plan Type</Text>
                    <Text style={styles.detailValue}>
                      {userData?.paymentMethod
                        ? getPlanName(userData.paymentMethod)
                        : "Not selected"}
                    </Text>
                  </View>
                </View>

                {userData?.planDuration && (
                  <View style={styles.detailRowWithIcon}>
                    <View style={styles.iconCircleSmall}>
                      <Ionicons name="time-outline" size={16} color="#3b82f6" />
                    </View>
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>Duration</Text>
                      <Text style={styles.detailValue}>
                        {userData.planDuration} month
                        {userData.planDuration > 1 ? "s" : ""}
                      </Text>
                    </View>
                  </View>
                )}

                {userData?.timeSlot && (
                  <View style={styles.detailRowWithIcon}>
                    <View
                      style={[
                        styles.iconCircleSmall,
                        {
                          backgroundColor:
                            getTimeSlotColor(userData.timeSlot) + "20",
                        },
                      ]}
                    >
                      <Ionicons
                        name={getTimeSlotIcon(userData.timeSlot)}
                        size={16}
                        color={getTimeSlotColor(userData.timeSlot)}
                      />
                    </View>
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>Time Slot</Text>
                      <Text style={styles.detailValue}>
                        {getTimeSlotDisplay(userData.timeSlot)}
                      </Text>
                    </View>
                  </View>
                )}

                {userData?.paymentMethod && (
                  <View style={styles.detailRowWithIcon}>
                    <View style={styles.iconCircleSmall}>
                      <Ionicons
                        name="wallet-outline"
                        size={16}
                        color="#10b981"
                      />
                    </View>
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>Payment Method</Text>
                      <Text style={styles.detailValue}>
                        {userData.paymentMethod === "offline"
                          ? "Pay at Gym (Offline)"
                          : "Online Payment"}
                      </Text>
                    </View>
                  </View>
                )}

                {userData?.enrolledAt && (
                  <View style={styles.detailRowWithIcon}>
                    <View style={styles.iconCircleSmall}>
                      <Ionicons
                        name="calendar-outline"
                        size={16}
                        color="#a855f7"
                      />
                    </View>
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>Request Date</Text>
                      <Text style={styles.detailValue}>
                        {userData.enrolledAt.toLocaleDateString("en-US", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </View>

            {userData?.transactionId && (
              <View style={styles.planSection}>
                <View style={styles.planSectionHeader}>
                  <Ionicons name="receipt-outline" size={20} color="#f97316" />
                  <Text style={styles.planSectionTitle}>
                    Transaction Details
                  </Text>
                </View>
                <View style={styles.detailCard}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Transaction ID</Text>
                    <TouchableOpacity
                      onPress={() =>
                        copyToClipboard(userData.transactionId || "")
                      }
                      style={styles.copyButton}
                    >
                      <Text style={styles.transactionId}>
                        {userData.transactionId}
                      </Text>
                      <Ionicons name="copy-outline" size={16} color="#64748b" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            <View style={styles.planSection}>
              <View style={styles.planSectionHeader}>
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color="#fbbf24"
                />
                <Text style={styles.planSectionTitle}>Next Steps</Text>
              </View>
              <View style={styles.instructionsCard}>
                <View style={styles.instructionItem}>
                  <View style={styles.instructionNumber}>
                    <Text style={styles.instructionNumberText}>1</Text>
                  </View>
                  <Text style={styles.instructionText}>
                    Visit the gym to complete payment (if not done already)
                  </Text>
                </View>
                <View style={styles.instructionItem}>
                  <View style={styles.instructionNumber}>
                    <Text style={styles.instructionNumberText}>2</Text>
                  </View>
                  <Text style={styles.instructionText}>
                    Show your enrollment details to gym staff
                  </Text>
                </View>
                <View style={styles.instructionItem}>
                  <View style={styles.instructionNumber}>
                    <Text style={styles.instructionNumberText}>3</Text>
                  </View>
                  <Text style={styles.instructionText}>
                    Wait for admin approval (usually within 24 hours)
                  </Text>
                </View>
                <View style={styles.instructionItem}>
                  <View style={styles.instructionNumber}>
                    <Text style={styles.instructionNumberText}>4</Text>
                  </View>
                  <Text style={styles.instructionText}>
                    Once approved, you can start checking in!
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.contactCard}>
              <Ionicons name="help-circle-outline" size={24} color="#3b82f6" />
              <View style={styles.contactContent}>
                <Text style={styles.contactTitle}>Need Help?</Text>
                <Text style={styles.contactText}>
                  If you have questions about your enrollment, contact the gym
                  directly or reach out to support.
                </Text>
              </View>
            </View>
          </ScrollView>

          <View style={styles.planModalFooter}>
            <TouchableOpacity
              style={styles.closePlanModalButton}
              onPress={() => setShowPlanDetailsModal(false)}
            >
              <Text style={styles.closePlanModalText}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.refreshPlanButton}
              onPress={() => {
                setShowPlanDetailsModal(false);
                handleRefreshStatus();
              }}
            >
              <Ionicons name="refresh-outline" size={18} color="#0a0f1a" />
              <Text style={styles.refreshPlanButtonText}>Check Status</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // ⭐ ADDED: Rating modal component
  const renderRatingModal = (isLeaving: boolean = false) => (
    <Modal
      visible={isLeaving ? showLeaveRatingModal : showRatingModal}
      transparent
      animationType="slide"
    >
      <View style={styles.ratingModalOverlay}>
        <View style={styles.ratingModalContent}>
          <View style={styles.ratingModalHeader}>
            <Text style={styles.ratingModalTitle}>
              {isLeaving ? "Rate Your Experience" : "Rate This Gym"}
            </Text>
            {!isLeaving && (
              <TouchableOpacity onPress={() => setShowRatingModal(false)}>
                <Ionicons name="close" size={28} color="#e9eef7" />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView style={styles.ratingModalScroll}>
            <View style={styles.ratingSection}>
              <Text style={styles.ratingSectionTitle}>
                How would you rate {gym?.name}?
              </Text>
              <View style={styles.starsContainer}>{renderStars(rating)}</View>
              <Text style={styles.ratingHint}>
                {rating === 0
                  ? "Tap stars to rate"
                  : `${rating} out of 5 stars`}
              </Text>
            </View>

            <View style={styles.ratingSection}>
              <Text style={styles.ratingSectionTitle}>Optional Comment</Text>
              <TextInput
                style={styles.reviewInput}
                placeholder="Share your experience (optional)..."
                placeholderTextColor="#64748b"
                value={reviewComment}
                onChangeText={setReviewComment}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              <Text style={styles.reviewHint}>
                Your review will be visible to others
              </Text>
            </View>

            {isLeaving && (
              <View style={styles.leavingNote}>
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color="#fbbf24"
                />
                <Text style={styles.leavingNoteText}>
                  {`You're about to leave ${gym?.name}. We'd appreciate your feedback to help improve our services.`}
                </Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.ratingModalFooter}>
            {isLeaving && (
              <TouchableOpacity
                style={styles.skipRatingButton}
                onPress={handleSkipRatingAndLeave}
              >
                <Text style={styles.skipRatingButtonText}>Skip & Leave</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.submitReviewButton,
                rating === 0 && styles.submitReviewButtonDisabled,
              ]}
              onPress={handleSubmitReview}
              disabled={rating === 0 || submittingReview}
            >
              {submittingReview ? (
                <ActivityIndicator color="#0a0f1a" />
              ) : (
                <Text style={styles.submitReviewButtonText}>
                  {isLeaving ? "Submit & Leave Gym" : "Submit Review"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

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
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refreshAllData}
              colors={["#4ade80"]}
              tintColor="#4ade80"
              title="Pull to refresh"
              titleColor="#94a3b8"
            />
          }
        >
          <View style={styles.emptyContainer}>
            <View style={styles.iconContainer}>
              <View style={styles.iconCircle}>
                <Ionicons name="time-outline" size={64} color="#fbbf24" />
              </View>
            </View>
            <Text style={styles.emptyTitle}>Enrollment Pending</Text>
            <Text style={styles.emptySubtext}>
              {`Your enrollment request is being reviewed by the gym admin. You'll
              be able to check-in once approved.`}
            </Text>

            <TouchableOpacity
              style={styles.viewPlanButton}
              onPress={() => setShowPlanDetailsModal(true)}
            >
              <Ionicons name="eye-outline" size={20} color="#0a0f1a" />
              <Text style={styles.viewPlanButtonText}>View Plan Details</Text>
            </TouchableOpacity>

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
                  <View style={styles.quickSummaryRow}>
                    <Ionicons
                      name="calendar-outline"
                      size={18}
                      color="#4ade80"
                    />
                    <Text style={styles.quickSummaryText}>
                      Plan: {getPlanName(userData.paymentMethod)}
                    </Text>
                  </View>
                </>
              )}

              {userData?.timeSlot && (
                <View style={styles.quickSummaryRow}>
                  <Ionicons
                    name={getTimeSlotIcon(userData.timeSlot)}
                    size={18}
                    color={getTimeSlotColor(userData.timeSlot)}
                  />
                  <Text style={styles.quickSummaryText}>
                    Time Slot: {userData.timeSlot}
                  </Text>
                </View>
              )}

              {userData?.transactionId && (
                <>
                  <View style={styles.divider} />
                  <View style={styles.quickSummaryRow}>
                    <Ionicons
                      name="document-text-outline"
                      size={18}
                      color="#a855f7"
                    />
                    <Text style={styles.quickSummaryText}>
                      Transaction ID: {userData.transactionId.substring(0, 8)}
                      ...
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
        </ScrollView>

        {renderPlanDetailsModal()}
      </View>
    );
  }

  if (userData?.enrollmentStatus === "none" || !userData?.gymId) {
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
              onRefresh={refreshAllData}
              colors={["#4ade80"]}
              tintColor="#4ade80"
              title="Pull to refresh"
              titleColor="#94a3b8"
            />
          }
        >
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
        </ScrollView>
      </View>
    );
  }

  if (userData?.enrollmentStatus === "rejected") {
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
              onRefresh={refreshAllData}
              colors={["#4ade80"]}
              tintColor="#4ade80"
              title="Pull to refresh"
              titleColor="#94a3b8"
            />
          }
        >
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
        </ScrollView>
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshAllData}
            colors={["#4ade80"]}
            tintColor="#4ade80"
            title="Pull to refresh"
            titleColor="#94a3b8"
            progressBackgroundColor="#0f172a"
          />
        }
      >
        {/* 🔔 NOTIFICATION HEADER */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.notificationIconContainer}
            onPress={() => setShowNotifications(!showNotifications)}
          >
            <Ionicons name="notifications-outline" size={24} color="#e9eef7" />
            {unreadCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.headerTextContainer}>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.userName}>
              {userData?.displayName || "Member"}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.refreshHeaderButton}
            onPress={refreshAllData}
          >
            <Ionicons
              name="refresh-outline"
              size={22}
              color={refreshing ? "#4ade80" : "#94a3b8"}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.gymCard}>
          <Ionicons name="barbell-outline" size={24} color="#4ade80" />
          <View style={styles.gymInfo}>
            <Text style={styles.gymName}>{gym?.name || "Loading..."}</Text>
            <Text style={styles.gymAddress}>
              {gym?.address || "Loading..."}
            </Text>
            <Text style={styles.activeMembersText}>
              {activeCheckInsCount}{" "}
              {activeCheckInsCount === 1 ? "member" : "members"} currently
              active • {currentTimeSlot} Slot
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

          <View style={styles.statCard}>
            <Ionicons name="people-outline" size={28} color="#3b82f6" />
            <Text style={styles.statNumber}>{activeCheckInsCount}</Text>
            <Text style={styles.statLabel}>Active Now</Text>
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

          {/* ⭐ ADDED: Rate Gym Button */}
          <TouchableOpacity
            style={styles.rateButton}
            onPress={() => setShowRatingModal(true)}
          >
            <View style={styles.buttonInner}>
              <Ionicons name="star-outline" size={22} color="#fbbf24" />
              <Text style={styles.rateButtonText}>Rate Gym</Text>
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

          {/* ⭐ ADDED: Debug button for streak reset (optional - remove in production) */}
          {/* <TouchableOpacity style={styles.debugButton} onPress={resetStreakManually}>
            <View style={styles.buttonInner}>
              <Ionicons name="bug-outline" size={22} color="#ef4444" />
              <Text style={styles.debugButtonText}>Reset Streak (Debug)</Text>
            </View>
          </TouchableOpacity> */}
        </View>

        {/* ⭐ ADDED: Refresh hint text */}
        <View style={styles.refreshHintContainer}>
          <Ionicons name="arrow-down-outline" size={16} color="#64748b" />
          <Text style={styles.refreshHintText}>Pull down to refresh</Text>
        </View>
      </ScrollView>
      {/* 🔔 NOTIFICATIONS MODAL */}
      {showNotifications && (
        <Modal
          transparent={true}
          animationType="fade"
          visible={showNotifications}
          onRequestClose={() => setShowNotifications(false)}
        >
          <TouchableOpacity
            style={styles.notificationOverlay}
            activeOpacity={1}
            onPress={() => setShowNotifications(false)}
          >
            <View style={styles.notificationDropdown}>
              <View style={styles.notificationHeader}>
                <Text style={styles.notificationTitle}>Notifications</Text>
                <View style={styles.notificationHeaderActions}>
                  {unreadCount > 0 && (
                    <TouchableOpacity
                      style={styles.markAllReadButton}
                      onPress={markAllAsRead}
                    >
                      <Text style={styles.markAllReadText}>Mark all read</Text>
                    </TouchableOpacity>
                  )}
                  {notifications.length > 0 && (
                    <TouchableOpacity
                      style={styles.clearAllButton}
                      onPress={clearAllNotifications}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color="#f87171"
                      />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <ScrollView style={styles.notificationList}>
                {notifications.length === 0 ? (
                  <View style={styles.noNotificationsContainer}>
                    <Ionicons
                      name="notifications-off-outline"
                      size={48}
                      color="#64748b"
                    />
                    <Text style={styles.noNotificationsText}>
                      No notifications
                    </Text>
                    <Text style={styles.noNotificationsSubtext}>
                      {`When your reports are resolved or reviewed, you'll see updates here.`}
                    </Text>
                  </View>
                ) : (
                  notifications.map((notif) => (
                    <TouchableOpacity
                      key={notif.id}
                      style={[
                        styles.notificationItem,
                        !notif.read && styles.notificationItemUnread,
                      ]}
                      onPress={() => markAsRead(notif.id)}
                    >
                      <View style={styles.notificationIcon}>
                        <Ionicons
                          name={
                            notif.type === "report"
                              ? "flag-outline"
                              : notif.type === "enrollment"
                                ? "person-add-outline"
                                : notif.type === "payment"
                                  ? "card-outline"
                                  : "information-circle"
                          }
                          size={20}
                          color={
                            notif.type === "report"
                              ? "#fbbf24"
                              : notif.type === "enrollment"
                                ? "#4ade80"
                                : notif.type === "payment"
                                  ? "#3b82f6"
                                  : "#8b5cf6"
                          }
                        />
                      </View>
                      <View style={styles.notificationContent}>
                        <View style={styles.notificationHeaderRow}>
                          <Text style={styles.notificationItemTitle}>
                            {notif.title}
                          </Text>
                          {!notif.read && <View style={styles.unreadDot} />}
                        </View>
                        <Text style={styles.notificationItemMessage}>
                          {notif.message}
                        </Text>
                        <Text style={styles.notificationItemTime}>
                          {formatNotificationTime(notif.date)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>

              <TouchableOpacity
                style={styles.closeNotificationsButton}
                onPress={() => setShowNotifications(false)}
              >
                <Text style={styles.closeNotificationsText}>Close</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
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
      {/* ⭐ ADDED: Rating Modals */}
      {renderRatingModal(false)} {/* Regular rating modal */}
      {renderRatingModal(true)} {/* Leave rating modal */}
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

  viewPlanButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fbbf24",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 20,
    marginBottom: 16,
  },
  viewPlanButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0a0f1a",
  },

  statusCard: {
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 20,
    padding: 20,
    width: "100%",
    marginTop: 12,
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

  quickSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
  },
  quickSummaryText: {
    fontSize: 14,
    color: "#e9eef7",
    fontWeight: "500",
  },

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

  // 🔔 NOTIFICATION STYLES
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: height * 0.025,
  },
  notificationIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(30, 41, 59, 0.8)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  notificationBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#ef4444",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: "#0a0f1a",
  },
  notificationBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  refreshHeaderButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(30, 41, 59, 0.8)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  greeting: { fontSize: 16, color: "#94a3b8" },
  userName: {
    fontSize: isSmall ? 24 : 28,
    fontWeight: "700",
    color: "#e9eef7",
  },
  notificationOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-start",
    paddingTop: Platform.OS === "ios" ? 60 : 40,
  },
  notificationDropdown: {
    marginHorizontal: 16,
    backgroundColor: "#0f172a",
    borderRadius: 20,
    maxHeight: height * 0.7,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  notificationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  notificationTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#e9eef7",
  },
  notificationHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  markAllReadButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(74, 222, 128, 0.1)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(74, 222, 128, 0.2)",
  },
  markAllReadText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4ade80",
  },
  clearAllButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(248, 113, 113, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.2)",
  },
  notificationList: {
    maxHeight: height * 0.5,
  },
  noNotificationsContainer: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  noNotificationsText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#e9eef7",
    marginTop: 12,
  },
  noNotificationsSubtext: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  notificationItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  notificationItemUnread: {
    backgroundColor: "rgba(59, 130, 246, 0.05)",
  },
  notificationIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  notificationItemTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#e9eef7",
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#3b82f6",
    marginLeft: 8,
  },
  notificationItemMessage: {
    fontSize: 14,
    color: "#94a3b8",
    lineHeight: 20,
    marginBottom: 4,
  },
  notificationItemTime: {
    fontSize: 12,
    color: "#64748b",
  },
  closeNotificationsButton: {
    paddingVertical: 16,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  closeNotificationsText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#64748b",
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
  activeMembersText: {
    fontSize: 12,
    color: "#4ade80",
    marginTop: 4,
  },
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
  // ⭐ ADDED: Rate Button Styles
  rateButton: {
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
  rateButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fbbf24",
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
  // ⭐ ADDED: Debug Button Styles (optional)
  debugButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: 14,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
    marginTop: 10,
  },
  debugButtonText: { fontSize: 16, fontWeight: "600", color: "#ef4444" },
  // ⭐ ADDED: Refresh Hint Styles
  refreshHintContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 20,
    paddingVertical: 12,
    opacity: 0.6,
  },
  refreshHintText: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
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

  // ⭐ ADDED: Rating Modal Styles
  ratingModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  ratingModalContent: {
    backgroundColor: "#0a0f1a",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.8,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
  },
  ratingModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  ratingModalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#e9eef7",
    flex: 1,
  },
  ratingModalScroll: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  ratingSection: {
    marginTop: 24,
  },
  ratingSectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#e9eef7",
    marginBottom: 16,
    textAlign: "center",
  },
  starsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  starButton: {
    padding: 4,
  },
  ratingHint: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 8,
  },
  reviewInput: {
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    color: "#e9eef7",
    fontSize: 16,
    minHeight: 100,
    marginBottom: 8,
  },
  reviewHint: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
  },
  leavingNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "rgba(251, 191, 36, 0.1)",
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.2)",
  },
  leavingNoteText: {
    flex: 1,
    fontSize: 14,
    color: "#e9eef7",
    lineHeight: 20,
  },
  ratingModalFooter: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: Platform.OS === "ios" ? 34 : 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    gap: 12,
  },
  skipRatingButton: {
    flex: 1,
    backgroundColor: "rgba(30, 41, 59, 0.8)",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  skipRatingButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#e9eef7",
  },
  submitReviewButton: {
    flex: 2,
    backgroundColor: "#4ade80",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  submitReviewButtonDisabled: {
    backgroundColor: "#374151",
    opacity: 0.5,
  },
  submitReviewButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0a0f1a",
  },

  planModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "flex-end",
  },
  planModalContent: {
    backgroundColor: "#0a0f1a",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.9,
  },
  planModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  planModalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#e9eef7",
    flex: 1,
  },
  planModalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  planModalScroll: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  planSection: {
    marginTop: 24,
  },
  planSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  planSectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#e9eef7",
  },
  statusBadgeContainer: {
    backgroundColor: "rgba(251, 191, 36, 0.1)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.2)",
  },
  pendingStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(251, 191, 36, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  pendingStatusText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fbbf24",
  },
  statusDescription: {
    fontSize: 14,
    color: "#94a3b8",
    lineHeight: 20,
  },
  detailCard: {
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  detailRow: {
    marginBottom: 16,
  },
  detailRowWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  iconCircleSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#e9eef7",
  },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 6,
  },
  transactionId: {
    fontSize: 14,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    color: "#e9eef7",
    flex: 1,
  },
  instructionsCard: {
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  instructionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  instructionNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(74, 222, 128, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  instructionNumberText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4ade80",
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: "#94a3b8",
    lineHeight: 20,
  },
  contactCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.2)",
  },
  contactContent: {
    flex: 1,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#3b82f6",
    marginBottom: 6,
  },
  contactText: {
    fontSize: 14,
    color: "#94a3b8",
    lineHeight: 20,
  },
  planModalFooter: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: Platform.OS === "ios" ? 34 : 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    gap: 12,
  },
  closePlanModalButton: {
    flex: 1,
    backgroundColor: "rgba(30, 41, 59, 0.8)",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  closePlanModalText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#e9eef7",
  },
  refreshPlanButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#4ade80",
    paddingVertical: 16,
    borderRadius: 14,
  },
  refreshPlanButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0a0f1a",
  },
});
