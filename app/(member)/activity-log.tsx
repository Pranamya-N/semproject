import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";

const { width, height } = Dimensions.get("window");

interface CheckInRecord {
  id: string;
  date: string; // "YYYY-MM-DD"
  duration: number; // seconds
  checkInTime: Date;
  checkOutTime: Date;
  gymName: string;
}

interface DailySession {
  date: string; // "YYYY-MM-DD"
  totalDuration: number; // Total seconds for the day
  sessions: CheckInRecord[]; // All sessions for that day
  latestCheckOutTime: Date; // Most recent check-out time for sorting
}

const ActivityLog: React.FC = () => {
  const router = useRouter();
  const { userData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [checkInHistory, setCheckInHistory] = useState<CheckInRecord[]>([]);
  const [dailySessions, setDailySessions] = useState<DailySession[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [error, setError] = useState<string | null>(null);
  const [totalDurationFromDB, setTotalDurationFromDB] = useState<number>(0);

  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);

  // Load user's total duration from their user document
  const loadUserTotalDuration = async () => {
    if (!userData?.uid) {
      setTotalDurationFromDB(0);
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, "users", userData.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        const totalDuration = Number(data.totalDuration) || 0;
        setTotalDurationFromDB(totalDuration);
      }
    } catch (error) {
      console.error("Error loading user total duration:", error);
      setTotalDurationFromDB(0);
    }
  };

  const combineDailySessions = (records: CheckInRecord[]): DailySession[] => {
    const dailyMap = new Map<string, DailySession>();

    records.forEach((record) => {
      const date = record.date;

      if (!dailyMap.has(date)) {
        dailyMap.set(date, {
          date,
          totalDuration: 0,
          sessions: [],
          latestCheckOutTime: record.checkOutTime,
        });
      }

      const dailySession = dailyMap.get(date)!;
      dailySession.totalDuration += record.duration;
      dailySession.sessions.push(record);

      if (
        record.checkOutTime.getTime() >
        dailySession.latestCheckOutTime.getTime()
      ) {
        dailySession.latestCheckOutTime = record.checkOutTime;
      }
    });

    return Array.from(dailyMap.values()).sort(
      (a, b) => b.latestCheckOutTime.getTime() - a.latestCheckOutTime.getTime(),
    );
  };

  const loadCheckInHistory = useCallback(async () => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    if (!userData?.uid) {
      setCheckInHistory([]);
      setDailySessions([]);
      setLoading(false);
      setError("Please log in to view your activity history");
      return;
    }

    // Check if user has left the gym (no enrollment or not approved)
    if (
      !userData?.gymId ||
      userData?.enrollmentStatus === "none" ||
      userData?.enrollmentStatus === "rejected"
    ) {
      setCheckInHistory([]);
      setDailySessions([]);
      setTotalDurationFromDB(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Load user's total duration
      await loadUserTotalDuration();

      const checkInHistoryRef = collection(db, "checkInHistory");

      const q = query(
        checkInHistoryRef,
        where("userId", "==", userData.uid),
        orderBy("checkOutTime", "desc"),
        limit(100),
      );

      console.log("📊 Loading check-in history for user:", userData.uid);

      const unsubscribe = onSnapshot(
        q,
        (querySnapshot) => {
          const history: CheckInRecord[] = [];
          querySnapshot.forEach((doc) => {
            const data = doc.data();

            let dateString = "";
            if (data.date && typeof data.date === "string") {
              // Use the date field if it exists (from MyGym's fixed code)
              dateString = data.date;
              console.log("📅 Using stored date field:", dateString);
            } else if (data.checkOutTime) {
              // Fallback: calculate from checkOutTime
              const checkOutDate = data.checkOutTime.toDate();
              // Use LOCAL date
              const localDate = new Date(
                checkOutDate.getFullYear(),
                checkOutDate.getMonth(),
                checkOutDate.getDate(),
              );
              dateString = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, "0")}-${String(localDate.getDate()).padStart(2, "0")}`;
              console.log("🕒 Calculated date from checkOutTime:", dateString);
            }

            const record = {
              id: doc.id,
              date: dateString,
              duration: data.duration || 0,
              checkInTime: data.checkInTime?.toDate() || new Date(),
              checkOutTime: data.checkOutTime?.toDate() || new Date(),
              gymName: data.gymName || "My Gym",
            };

            console.log("📝 Check-in record loaded:", {
              id: doc.id.substring(0, 8),
              date: record.date,
              gymName: record.gymName,
              duration: record.duration,
            });

            history.push(record);
          });

          console.log(`✅ Loaded ${history.length} check-in records`);
          setCheckInHistory(history);
          setDailySessions(combineDailySessions(history));
          setLoading(false);
        },
        (firestoreError: any) => {
          console.error("❌ Firestore listener error:", {
            code: firestoreError.code,
            message: firestoreError.message,
          });

          if (firestoreError.code === "permission-denied") {
            setCheckInHistory([]);
            setDailySessions([]);
            setError("Permission denied. Please contact support.");
            setLoading(false);
            return;
          }

          if (firestoreError.code === "failed-precondition") {
            // Missing index error
            setError(
              "Database index is being created. Please try again in a moment.",
            );
            setLoading(false);
            return;
          }

          setError("Failed to load activity history. Please try again.");
          setLoading(false);
        },
      );

      unsubscribeRef.current = unsubscribe;
    } catch (error: any) {
      console.error("❌ Error in loadCheckInHistory:", error);
      setError(error.message || "Failed to load activity history");
      setLoading(false);
    }
  }, [userData?.uid, userData?.gymId, userData?.enrollmentStatus]);

  useFocusEffect(
    useCallback(() => {
      console.log("🔍 ActivityLog page focused, loading history...");
      loadCheckInHistory();

      return () => {
        if (unsubscribeRef.current) {
          console.log("🔌 Unsubscribing from Firestore listener");
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
      };
    }, [loadCheckInHistory]),
  );

  useEffect(() => {
    // Additional load when month changes
    loadCheckInHistory();
  }, [currentMonth, loadCheckInHistory]);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month, 1).getDay(); // 0 = Sunday
  };

  const formatDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentMonth.getMonth() === today.getMonth() &&
      currentMonth.getFullYear() === today.getFullYear()
    );
  };

  // FIXED: Proper timezone handling for future date check
  const isFutureDate = (day: number) => {
    const today = new Date();
    const todayStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );

    const checkDate = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day,
    );

    return checkDate > todayStart;
  };

  const getCheckInForDay = (day: number) => {
    const dateKey = formatDateKey(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day),
    );
    const hasCheckIn = checkInHistory.some((record) => {
      const match = record.date === dateKey;
      if (match) {
        console.log(`✅ Found check-in for ${dateKey}:`, {
          gymName: record.gymName,
          duration: record.duration,
        });
      }
      return match;
    });

    console.log(
      `📅 Checking day ${day}: dateKey=${dateKey}, hasCheckIn=${hasCheckIn}`,
    );
    return hasCheckIn;
  };

  const previousMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1),
    );
  };

  const nextMonth = () => {
    const next = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
    );
    const today = new Date();

    // Allow navigation to current month and past months only
    if (
      next.getMonth() <= today.getMonth() &&
      next.getFullYear() <= today.getFullYear()
    ) {
      setCurrentMonth(next);
    }
  };

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    } else if (mins > 0) {
      return `${mins}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Handle back button press - navigate to MyGym page
  const handleBackPress = () => {
    router.push("/(member)/mygym");
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
    const days = [];

    console.log(
      `🗓️ Rendering calendar for ${currentMonth.getMonth() + 1}/${currentMonth.getFullYear()}`,
    );
    console.log(`   Days in month: ${daysInMonth}, First day: ${firstDay}`);

    for (let i = 0; i < firstDay; i++) {
      days.push(<View key={`empty-${i}`} style={styles.dayCell} />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const checkIn = getCheckInForDay(day);
      const today = isToday(day);
      const future = isFutureDate(day);

      days.push(
        <View
          key={day}
          style={[
            styles.dayCell,
            checkIn && styles.dayCellPresent,
            !checkIn && !future && styles.dayCellAbsent,
            today && styles.dayCellToday,
            future && styles.dayCellFuture,
          ]}
        >
          <Text
            style={[
              styles.dayText,
              checkIn && styles.dayTextPresent,
              today && styles.dayTextToday,
              future && styles.dayTextFuture,
            ]}
          >
            {day}
          </Text>
          {checkIn && <View style={styles.presentDot} />}
        </View>,
      );
    }

    return days;
  };

  // Get unique days with check-ins in current month
  const getUniqueDaysInMonth = () => {
    const uniqueDates = new Set<string>();

    checkInHistory.forEach((record) => {
      if (!record.date) return;

      const recordDate = new Date(record.date);
      if (
        recordDate.getMonth() === currentMonth.getMonth() &&
        recordDate.getFullYear() === currentMonth.getFullYear()
      ) {
        uniqueDates.add(record.date);
      }
    });

    return Array.from(uniqueDates);
  };

  const uniqueDaysInMonth = getUniqueDaysInMonth();
  const attendedDays = uniqueDaysInMonth.length;
  const totalDays = getDaysInMonth(currentMonth);
  const attendanceRate =
    totalDays > 0 ? Math.round((attendedDays / totalDays) * 100) : 0;

  // Calculate total duration for current month (from daily sessions)
  const monthlyTotalDuration = dailySessions
    .filter((dailySession) => {
      const sessionDate = new Date(dailySession.date);
      return (
        sessionDate.getMonth() === currentMonth.getMonth() &&
        sessionDate.getFullYear() === currentMonth.getFullYear()
      );
    })
    .reduce((sum, dailySession) => sum + dailySession.totalDuration, 0);

  // Check if user has left gym or not enrolled
  const hasNoGym =
    !userData?.gymId ||
    userData?.enrollmentStatus === "none" ||
    userData?.enrollmentStatus === "rejected";

  if (!userData?.uid) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0a0f1a" />
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#e9eef7" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Activity Log</Text>
          <View style={styles.refreshButton} />
        </View>

        <View style={styles.loginPromptContainer}>
          <Ionicons name="log-in-outline" size={80} color="#64748b" />
          <Text style={styles.loginPromptTitle}>Login Required</Text>
          <Text style={styles.loginPromptText}>
            Please log in to view your activity history
          </Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push("/login")}
          >
            <Text style={styles.loginButtonText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (hasNoGym) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0a0f1a" />
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#e9eef7" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Activity Log</Text>
          <View style={styles.refreshButton} />
        </View>

        <View style={styles.loginPromptContainer}>
          <Ionicons name="fitness-outline" size={80} color="#64748b" />
          <Text style={styles.loginPromptTitle}>No Gym Enrolled</Text>
          <Text style={styles.loginPromptText}>
            Join a gym to start tracking your activity and building your workout
            streak!
          </Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push("/(member)/home")}
          >
            <Ionicons
              name="search"
              size={20}
              color="#0a0f1a"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.loginButtonText}>Browse Gyms</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading && checkInHistory.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#0a0f1a" />
        <ActivityIndicator size="large" color="#4ade80" />
        <Text style={styles.loadingText}>Loading activity log...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0f1a" />

      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#e9eef7" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Activity Log</Text>
        <TouchableOpacity
          onPress={() => {
            console.log("🔄 Manual refresh triggered");
            loadCheckInHistory();
          }}
          style={styles.refreshButton}
        >
          <Ionicons name="refresh-outline" size={24} color="#4ade80" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="warning-outline" size={20} color="#f87171" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              onPress={() => {
                setError(null);
                loadCheckInHistory();
              }}
              style={styles.retryButton}
            >
              <Ionicons name="refresh" size={16} color="#f87171" />
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setError(null)}
              style={styles.closeErrorButton}
            >
              <Ionicons name="close" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.monthSelector}>
          <TouchableOpacity onPress={previousMonth} style={styles.monthArrow}>
            <Ionicons name="chevron-back" size={24} color="#e9eef7" />
          </TouchableOpacity>
          <Text style={styles.monthText}>
            {currentMonth.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </Text>
          <TouchableOpacity
            onPress={nextMonth}
            style={[
              styles.monthArrow,
              currentMonth.getMonth() === new Date().getMonth() &&
                currentMonth.getFullYear() === new Date().getFullYear() &&
                styles.monthArrowDisabled,
            ]}
            disabled={
              currentMonth.getMonth() === new Date().getMonth() &&
              currentMonth.getFullYear() === new Date().getFullYear()
            }
          >
            <Ionicons
              name="chevron-forward"
              size={24}
              color={
                currentMonth.getMonth() === new Date().getMonth() &&
                currentMonth.getFullYear() === new Date().getFullYear()
                  ? "#374151"
                  : "#e9eef7"
              }
            />
          </TouchableOpacity>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{attendedDays}</Text>
            <Text style={styles.statLabel}>Days Present</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{attendanceRate}%</Text>
            <Text style={styles.statLabel}>Attendance</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>
              {formatDuration(monthlyTotalDuration)}
            </Text>
            <Text style={styles.statLabel}>Monthly Time</Text>
          </View>
        </View>

        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendBox, styles.legendBoxPresent]} />
            <Text style={styles.legendText}>Present</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendBox, styles.legendBoxAbsent]} />
            <Text style={styles.legendText}>Absent</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendBox, styles.legendBoxToday]} />
            <Text style={styles.legendText}>Today</Text>
          </View>
        </View>

        <View style={styles.calendar}>
          <View style={styles.weekDays}>
            {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
              <Text key={index} style={styles.weekDayText}>
                {day}
              </Text>
            ))}
          </View>
          <View style={styles.daysGrid}>{renderCalendar()}</View>
        </View>

        <View style={styles.recentSessions}>
          <Text style={styles.sectionTitle}>Recent Sessions</Text>
          {dailySessions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color="#64748b" />
              <Text style={styles.emptyStateText}>No check-ins yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Start your fitness journey by checking in at the gym!
              </Text>
              <TouchableOpacity
                style={styles.checkInPromptButton}
                onPress={() => router.push("/(member)/mygym")}
              >
                <Ionicons name="fitness" size={18} color="#0a0f1a" />
                <Text style={styles.checkInPromptButtonText}>Go to My Gym</Text>
              </TouchableOpacity>
            </View>
          ) : (
            dailySessions
              .filter((dailySession) => {
                const sessionDate = new Date(dailySession.date);
                return (
                  sessionDate.getMonth() === currentMonth.getMonth() &&
                  sessionDate.getFullYear() === currentMonth.getFullYear()
                );
              })
              .slice(0, 10)
              .map((dailySession, index) => {
                const sessionDate = new Date(dailySession.date);
                const gymNames = [
                  ...new Set(dailySession.sessions.map((s) => s.gymName)),
                ];
                const sessionCount = dailySession.sessions.length;

                return (
                  <View
                    key={`${dailySession.date}-${index}`}
                    style={styles.sessionCard}
                  >
                    <View style={styles.sessionLeft}>
                      <View style={styles.sessionIconContainer}>
                        <Ionicons name="fitness" size={20} color="#4ade80" />
                        {sessionCount > 1 && (
                          <View style={styles.sessionCountBadge}>
                            <Text style={styles.sessionCountText}>
                              {sessionCount}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.sessionInfo}>
                        <View style={styles.sessionHeader}>
                          <Text style={styles.sessionDate}>
                            {sessionDate.toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}
                          </Text>
                          <Text style={styles.sessionCount}>
                            {sessionCount}{" "}
                            {sessionCount === 1 ? "session" : "sessions"}
                          </Text>
                        </View>
                        <View style={styles.sessionDetails}>
                          <Text style={styles.sessionDuration}>
                            {formatDuration(dailySession.totalDuration)}
                          </Text>
                          <Text style={styles.sessionGym}>
                            {gymNames[0] || "My Gym"}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color="#4ade80"
                    />
                  </View>
                );
              })
          )}
        </View>

        {dailySessions.length > 0 && (
          <View style={styles.totalStats}>
            <Text style={styles.sectionTitle}>All Time Stats</Text>
            <View style={styles.totalStatsGrid}>
              <View style={styles.totalStatCard}>
                <Ionicons name="calendar-outline" size={24} color="#fbbf24" />
                <Text style={styles.totalStatNumber}>
                  {dailySessions.length}
                </Text>
                <Text style={styles.totalStatLabel}>Days Attended</Text>
              </View>
              <View style={styles.totalStatCard}>
                <Ionicons name="time-outline" size={24} color="#a855f7" />
                <Text style={styles.totalStatNumber}>
                  {formatDuration(Math.floor(totalDurationFromDB))}
                </Text>
                <Text style={styles.totalStatLabel}>Total Time</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default ActivityLog;

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
  },
  loadingText: {
    color: "#94a3b8",
    marginTop: 16,
    fontSize: 16,
  },
  loginPromptContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  loginPromptTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#e9eef7",
    marginTop: 20,
  },
  loginPromptText: {
    fontSize: 16,
    color: "#64748b",
    marginTop: 12,
    textAlign: "center",
    lineHeight: 22,
  },
  loginButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4ade80",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0a0f1a",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  refreshButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#e9eef7",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  monthSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 24,
    marginBottom: 20,
  },
  monthArrow: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  monthArrowDisabled: {
    opacity: 0.3,
  },
  monthText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#e9eef7",
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "700",
    color: "#4ade80",
  },
  statLabel: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 4,
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    marginBottom: 20,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendBox: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  legendBoxPresent: {
    backgroundColor: "#4ade80",
  },
  legendBoxAbsent: {
    backgroundColor: "rgba(248, 113, 113, 0.3)",
    borderWidth: 1,
    borderColor: "#f87171",
  },
  legendBoxToday: {
    backgroundColor: "#6366f1",
  },
  legendText: {
    fontSize: 12,
    color: "#94a3b8",
  },
  calendar: {
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    marginBottom: 24,
  },
  weekDays: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 12,
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
    width: (width - 72) / 7,
    textAlign: "center",
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: (width - 72) / 7,
    height: (width - 72) / 7,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    borderRadius: 8,
  },
  dayCellPresent: {
    backgroundColor: "rgba(74, 222, 128, 0.15)",
  },
  dayCellAbsent: {
    backgroundColor: "rgba(248, 113, 113, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.2)",
  },
  dayCellToday: {
    backgroundColor: "#6366f1",
  },
  dayCellFuture: {
    opacity: 0.3,
  },
  dayText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#94a3b8",
  },
  dayTextPresent: {
    color: "#4ade80",
  },
  dayTextToday: {
    color: "#fff",
  },
  dayTextFuture: {
    color: "#374151",
  },
  presentDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#4ade80",
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#e9eef7",
    marginBottom: 16,
  },
  recentSessions: {
    marginTop: 8,
    marginBottom: 24,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#94a3b8",
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 6,
    textAlign: "center",
  },
  checkInPromptButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#4ade80",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  checkInPromptButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0a0f1a",
  },
  sessionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  sessionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  sessionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(74, 222, 128, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  sessionCountBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#3b82f6",
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#0a0f1a",
  },
  sessionCountText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  sessionInfo: {
    flex: 1,
    gap: 4,
  },
  sessionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sessionDate: {
    fontSize: 15,
    fontWeight: "600",
    color: "#e9eef7",
  },
  sessionCount: {
    fontSize: 12,
    color: "#94a3b8",
    fontStyle: "italic",
  },
  sessionDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sessionDuration: {
    fontSize: 13,
    color: "#4ade80",
    fontWeight: "600",
  },
  sessionGym: {
    fontSize: 12,
    color: "#64748b",
  },
  totalStats: {
    marginTop: 8,
  },
  totalStatsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  totalStatCard: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  totalStatNumber: {
    fontSize: 20,
    fontWeight: "700",
    color: "#e9eef7",
    marginTop: 8,
    marginBottom: 4,
  },
  totalStatLabel: {
    fontSize: 12,
    color: "#94a3b8",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(248, 113, 113, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.3)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    marginTop: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: "#f87171",
    marginLeft: 8,
    marginRight: 8,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(248, 113, 113, 0.1)",
    marginRight: 8,
  },
  retryButtonText: {
    fontSize: 12,
    color: "#f87171",
    fontWeight: "600",
  },
  closeErrorButton: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
});
