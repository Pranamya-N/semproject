import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { collection, getDocs, query, where } from "firebase/firestore";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Dimensions,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";
import { Gym } from "../types";

const { width, height } = Dimensions.get("window");
const isSmall = height < 700;

const LOCATIONS = ["Banepa", "Bhaktapur", "Dhulikhel", "Kathmandu", "Lalitpur"];

const MemberHome: React.FC = () => {
  const { userData } = useAuth();
  const router = useRouter();

  const [gyms, setGyms] = useState<Gym[]>([]);
  const [filteredGyms, setFilteredGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [searchText, setSearchText] = useState("");
  const [sortByPrice, setSortByPrice] = useState<"asc" | "desc" | null>(null);
  const [nearMe, setNearMe] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // 🔴 FIXED BACK BUTTON HANDLER - Using subscription pattern
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        Alert.alert("Exit App", "Are you sure you want to exit?", [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => {}, // Do nothing on cancel
          },
          {
            text: "Exit",
            style: "destructive",
            onPress: () => {
              if (BackHandler.exitApp) {
                BackHandler.exitApp();
              }
            },
          },
        ]);
        return true; // This prevents default back action
      };

      // ✅ CORRECT: Use subscription pattern
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress,
      );

      // ✅ CORRECT: Cleanup using subscription.remove()
      return () => subscription.remove();
    }, []),
  );

  useEffect(() => {
    fetchGyms();
  }, []);

  useEffect(() => {
    let list = [...gyms];

    // 🔍 Search
    if (searchText.trim()) {
      list = list.filter((gym) =>
        gym.name.toLowerCase().includes(searchText.toLowerCase()),
      );
    }

    // 📍 Location
    if (nearMe && selectedLocation) {
      list = list.filter((gym) =>
        gym.address?.toLowerCase().includes(selectedLocation.toLowerCase()),
      );
    }

    // 💰 Price
    if (sortByPrice === "asc") {
      list.sort((a, b) => a.monthlyFee - b.monthlyFee);
    }
    if (sortByPrice === "desc") {
      list.sort((a, b) => b.monthlyFee - a.monthlyFee);
    }

    setFilteredGyms(list);
  }, [gyms, searchText, sortByPrice, nearMe, selectedLocation]);

  const fetchGyms = async () => {
    try {
      const gymsQuery = query(
        collection(db, "gyms"),
        where("isActive", "==", true),
      );
      const snapshot = await getDocs(gymsQuery);
      const gymsList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as Gym[];

      setGyms(gymsList);
    } catch (error) {
      console.error("Error fetching gyms:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchGyms();
  }, []);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchGyms();
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const renderGymCard = ({ item }: { item: Gym }) => {
    const isEnrolled = userData?.gymId === item.id;
    const isPending = isEnrolled && userData?.enrollmentStatus === "pending";
    const isApproved = isEnrolled && userData?.enrollmentStatus === "approved";

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => router.push(`/gymdetails/${item.id}`)}
      >
        <View style={[styles.gymCard, isEnrolled && styles.gymCardEnrolled]}>
          <View style={styles.gymIconContainer}>
            <Ionicons name="barbell" size={28} color="#4ade80" />
          </View>

          <View style={styles.gymInfo}>
            <View style={styles.gymNameRow}>
              <Text style={styles.gymName}>{item.name}</Text>
              {isPending && (
                <View style={styles.pendingBadge}>
                  <Text style={styles.badgeText}>Pending</Text>
                </View>
              )}
              {isApproved && (
                <View style={styles.enrolledBadge}>
                  <Text style={styles.badgeText}>Enrolled</Text>
                </View>
              )}
            </View>

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

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="fitness-outline" size={80} color="#64748b" />
      <Text style={styles.emptyTitle}>No Gyms Found</Text>
      <Text style={styles.emptySubtext}>
        {searchText || nearMe || sortByPrice
          ? "Try changing your filters"
          : "No active gyms available at the moment"}
      </Text>
      <TouchableOpacity
        style={styles.refreshEmptyButton}
        onPress={handleManualRefresh}
      >
        <Ionicons name="refresh-outline" size={20} color="#0a0f1a" />
        <Text style={styles.refreshEmptyButtonText}>Refresh</Text>
      </TouchableOpacity>
    </View>
  );

  const renderHeader = () => (
    <View>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>{getGreeting()},</Text>
          <Text style={styles.userName}>
            {userData?.displayName || "Member"}
          </Text>
        </View>

        {/* 🟢 REMOVED: BIG REFRESH BUTTON (kept only pull-to-refresh) */}
      </View>

      <Text style={styles.sectionTitle}>Available Gyms</Text>

      {/* 🔍 SEARCH + FILTER */}
      <View style={styles.filterContainer}>
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color="#94a3b8" />
            <TextInput
              placeholder="Search gym..."
              placeholderTextColor="#64748b"
              value={searchText}
              onChangeText={setSearchText}
              style={styles.searchInput}
            />
            {searchText ? (
              <TouchableOpacity onPress={() => setSearchText("")}>
                <Ionicons name="close-circle" size={18} color="#94a3b8" />
              </TouchableOpacity>
            ) : null}
          </View>

          <TouchableOpacity
            style={styles.filterIconBtn}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Ionicons
              name="options-outline"
              size={22}
              color={showFilters ? "#4ade80" : "#e9eef7"}
            />
          </TouchableOpacity>
        </View>

        {showFilters && (
          <>
            <View style={styles.filterRow}>
              <TouchableOpacity
                style={[
                  styles.filterBtn,
                  sortByPrice === "asc" && styles.activeFilter,
                ]}
                onPress={() =>
                  setSortByPrice(sortByPrice === "asc" ? null : "asc")
                }
              >
                <Text style={styles.filterText}>Price ↑</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterBtn,
                  sortByPrice === "desc" && styles.activeFilter,
                ]}
                onPress={() =>
                  setSortByPrice(sortByPrice === "desc" ? null : "desc")
                }
              >
                <Text style={styles.filterText}>Price ↓</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterBtn, nearMe && styles.activeFilter]}
                onPress={() => {
                  setNearMe(!nearMe);
                  if (nearMe) setSelectedLocation(null);
                }}
              >
                <Text style={styles.filterText}>Gym near me</Text>
              </TouchableOpacity>

              {(sortByPrice || nearMe || selectedLocation) && (
                <TouchableOpacity
                  style={[styles.filterBtn, styles.clearFilterBtn]}
                  onPress={() => {
                    setSortByPrice(null);
                    setNearMe(false);
                    setSelectedLocation(null);
                  }}
                >
                  <Text style={styles.clearFilterText}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>

            {nearMe && (
              <View style={styles.dropdown}>
                <Text style={styles.dropdownTitle}>Select Location:</Text>
                {LOCATIONS.map((loc) => (
                  <TouchableOpacity
                    key={loc}
                    onPress={() => setSelectedLocation(loc)}
                    style={[
                      styles.dropdownItem,
                      selectedLocation === loc && styles.activeDropdownItem,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dropdownText,
                        selectedLocation === loc && styles.activeDropdownText,
                      ]}
                    >
                      {loc}
                    </Text>
                    {selectedLocation === loc && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color="#4ade80"
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4ade80" />
        <Text style={styles.loadingText}>Loading gyms...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0f1a" />

      <FlatList
        data={filteredGyms}
        renderItem={renderGymCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#4ade80"]}
            tintColor="#4ade80"
            title="Pull to refresh"
            titleColor="#94a3b8"
            progressBackgroundColor="#0a0f1a"
          />
        }
      />
    </View>
  );
};

export default MemberHome;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0f1a" },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0a0f1a",
  },
  loadingText: { color: "#94a3b8", marginTop: 16 },

  header: {
    paddingHorizontal: width * 0.05,
    paddingTop: height * 0.06,
  },
  greeting: { fontSize: 16, color: "#94a3b8" },
  userName: {
    fontSize: isSmall ? 24 : 28,
    fontWeight: "700",
    color: "#e9eef7",
    marginTop: 4,
  },

  // 🟢 REMOVED: BIG REFRESH BUTTON STYLES

  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#e9eef7",
    paddingHorizontal: width * 0.05,
    marginVertical: 12,
    marginTop: 20,
  },

  filterContainer: {
    paddingHorizontal: width * 0.05,
    marginBottom: 20,
  },
  searchRow: { flexDirection: "row", gap: 10 },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(30,41,59,0.85)",
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    color: "#e9eef7",
    marginLeft: 8,
    fontSize: 14,
  },
  filterIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(30,41,59,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },

  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    flexWrap: "wrap",
  },
  filterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(30,41,59,0.85)",
  },
  activeFilter: {
    backgroundColor: "#4ade80",
  },
  clearFilterBtn: {
    backgroundColor: "rgba(249, 115, 22, 0.85)",
  },
  filterText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#e9eef7",
  },
  clearFilterText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#e9eef7",
  },

  dropdown: {
    marginTop: 8,
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(74, 222, 128, 0.3)",
  },
  dropdownTitle: {
    padding: 12,
    fontSize: 13,
    fontWeight: "600",
    color: "#94a3b8",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  activeDropdownItem: {
    backgroundColor: "rgba(74,222,128,0.15)",
  },
  dropdownText: {
    color: "#e9eef7",
    fontSize: 14,
  },
  activeDropdownText: {
    color: "#4ade80",
    fontWeight: "600",
  },

  listContent: {
    paddingBottom: 40,
  },

  gymCard: {
    backgroundColor: "rgba(15,23,42,0.8)",
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    marginHorizontal: width * 0.05,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  gymCardEnrolled: {
    borderColor: "#4ade80",
    borderWidth: 1.5,
  },
  gymIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "rgba(74,222,128,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  gymInfo: {
    flex: 1,
    marginLeft: 14,
  },
  gymNameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    flexWrap: "wrap",
  },
  gymName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#e9eef7",
    marginRight: 6,
  },
  pendingBadge: {
    backgroundColor: "rgba(251,191,36,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  enrolledBadge: {
    backgroundColor: "rgba(74,222,128,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#4ade80",
  },
  gymDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
  },
  gymAddress: {
    fontSize: 13,
    color: "#64748b",
    marginLeft: 6,
    flex: 1,
  },
  gymPhone: {
    fontSize: 13,
    color: "#64748b",
    marginLeft: 6,
  },
  gymPriceContainer: {
    alignItems: "flex-end",
  },
  gymPriceLabel: {
    fontSize: 11,
    color: "#64748b",
  },
  gymPrice: {
    fontSize: 20,
    fontWeight: "800",
    color: "#4ade80",
  },

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: width * 0.1,
    marginTop: height * 0.1,
  },
  emptyTitle: {
    fontSize: 22,
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
  refreshEmptyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#4ade80",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 24,
  },
  refreshEmptyButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0a0f1a",
  },
});
