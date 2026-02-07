import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Dimensions,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useAuth } from "../context/AuthContext";

const { width, height } = Dimensions.get("window");

const Profile: React.FC = () => {
  const { userData, logout } = useAuth();
  const router = useRouter();

  // Modal states
  const [showSupportModal, setShowSupportModal] = useState<boolean>(false);
  const [showAppInfoModal, setShowAppInfoModal] = useState<boolean>(false);
  const [showRateModal, setShowRateModal] = useState<boolean>(false);

  const handleLogout = (): void => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/login");
        },
      },
    ]);
  };

  const handleEditProfile = (): void => {
    router.push("/editprofile");
  };

  const handleChangePassword = (): void => {
    router.push("/changepassword");
  };

  const handleContactSupport = () => {
    Linking.openURL("mailto:support@fitcore.com?subject=FitCore Support");
  };

  const handleVisitWebsite = () => {
    Linking.openURL("https://fitcore.com");
  };

  const handleSubmitFeedback = () => {
    Linking.openURL("mailto:feedback@fitcore.com?subject=FitCore Feedback");
  };

  // Format date for member since
  const formatMemberSince = () => {
    if (!userData?.createdAt) return "";
    return userData.createdAt.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  };

  const renderSupportModal = () => (
    <Modal
      transparent={true}
      animationType="fade"
      visible={showSupportModal}
      onRequestClose={() => setShowSupportModal(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowSupportModal(false)}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Ionicons name="help-circle-outline" size={28} color="#fbbf24" />
            <Text style={styles.modalTitle}>Help & Support</Text>
          </View>

          <View style={styles.modalBody}>
            <View style={styles.supportOption}>
              <Ionicons name="mail-outline" size={24} color="#3b82f6" />
              <View style={styles.supportOptionContent}>
                <Text style={styles.supportOptionTitle}>Email Support</Text>
                <Text style={styles.supportOptionDescription}>
                  Get help from our support team
                </Text>
              </View>
              <TouchableOpacity
                style={styles.supportActionButton}
                onPress={handleContactSupport}
              >
                <Text style={styles.supportActionText}>Contact</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.supportOption}>
              <Ionicons name="globe-outline" size={24} color="#10b981" />
              <View style={styles.supportOptionContent}>
                <Text style={styles.supportOptionTitle}>Visit Website</Text>
                <Text style={styles.supportOptionDescription}>
                  Find guides and tutorials
                </Text>
              </View>
              <TouchableOpacity
                style={styles.supportActionButton}
                onPress={handleVisitWebsite}
              >
                <Text style={styles.supportActionText}>Visit</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.supportOption}>
              <Ionicons name="chatbubble-outline" size={24} color="#8b5cf6" />
              <View style={styles.supportOptionContent}>
                <Text style={styles.supportOptionTitle}>Submit Feedback</Text>
                <Text style={styles.supportOptionDescription}>
                  Share your suggestions
                </Text>
              </View>
              <TouchableOpacity
                style={styles.supportActionButton}
                onPress={handleSubmitFeedback}
              >
                <Text style={styles.supportActionText}>Share</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.supportInfoCard}>
              <Ionicons name="time-outline" size={20} color="#64748b" />
              <Text style={styles.supportInfoText}>
                Response time: Usually within 24 hours
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setShowSupportModal(false)}
          >
            <Text style={styles.modalCloseText}>Close</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const renderAppInfoModal = () => (
    <Modal
      transparent={true}
      animationType="fade"
      visible={showAppInfoModal}
      onRequestClose={() => setShowAppInfoModal(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowAppInfoModal(false)}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View style={styles.appLogo}>
              <Ionicons name="fitness-outline" size={32} color="#4ade80" />
            </View>
            <Text style={styles.modalTitle}>FitCore</Text>
          </View>

          <View style={styles.modalBody}>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Version</Text>
                <Text style={styles.infoValue}>1.0.0</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Build</Text>
                <Text style={styles.infoValue}>2024.01.01</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Developer</Text>
                <Text style={styles.infoValue}>FitCore Team</Text>
              </View>
            </View>

            <View style={styles.descriptionCard}>
              <Text style={styles.descriptionTitle}>About FitCore</Text>
              <Text style={styles.descriptionText}>
                Your ultimate fitness companion. Track workouts, manage gym
                memberships, and achieve your fitness goals with ease.
              </Text>
            </View>

            <View style={styles.featuresGrid}>
              <View style={styles.featureItem}>
                <Ionicons name="barbell-outline" size={20} color="#4ade80" />
                <Text style={styles.featureText}>Gym Check-ins</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons
                  name="stats-chart-outline"
                  size={20}
                  color="#3b82f6"
                />
                <Text style={styles.featureText}>Progress Tracking</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="time-outline" size={20} color="#f97316" />
                <Text style={styles.featureText}>Time Slots</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons
                  name="notifications-outline"
                  size={20}
                  color="#8b5cf6"
                />
                <Text style={styles.featureText}>Notifications</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setShowAppInfoModal(false)}
          >
            <Text style={styles.modalCloseText}>Close</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const renderRateModal = () => (
    <Modal
      transparent={true}
      animationType="fade"
      visible={showRateModal}
      onRequestClose={() => setShowRateModal(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowRateModal(false)}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View style={styles.rateIcon}>
              <Ionicons name="star" size={32} color="#fbbf24" />
            </View>
            <Text style={styles.modalTitle}>Enjoying FitCore?</Text>
          </View>

          <View style={styles.modalBody}>
            <View style={styles.rateContent}>
              <Ionicons name="heart-outline" size={48} color="#ef4444" />
              <Text style={styles.rateTitle}>Rate Our App</Text>
              <Text style={styles.rateDescription}>
                Your feedback helps us improve and motivates us to keep building
                great features for you!
              </Text>

              <View style={styles.starsContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity key={star} style={styles.starButton}>
                    <Ionicons name="star-outline" size={32} color="#fbbf24" />
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.rateButton}>
                <Text style={styles.rateButtonText}>Submit Rating</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.laterButton}
                onPress={() => setShowRateModal(false)}
              >
                <Text style={styles.laterButtonText}>Maybe Later</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0f1a" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.headerTitle}>Profile</Text>

        {/* Profile Header Card */}
        <View style={styles.profileHeaderCard}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarText}>
              {userData?.displayName?.charAt(0)?.toUpperCase() || "U"}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>
              {userData?.displayName || "User"}
            </Text>
            <Text style={styles.userEmail}>{userData?.email}</Text>
            <View style={styles.userMeta}>
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>
                  {userData?.role || "Member"}
                </Text>
              </View>
              {userData?.createdAt && (
                <View style={styles.memberSince}>
                  <Ionicons name="calendar-outline" size={12} color="#64748b" />
                  <Text style={styles.memberSinceText}>
                    Member since {formatMemberSince()}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.sectionCard}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleEditProfile}
            >
              <View
                style={[
                  styles.menuIcon,
                  { backgroundColor: "rgba(74, 222, 128, 0.1)" },
                ]}
              >
                <Ionicons name="person-outline" size={20} color="#4ade80" />
              </View>
              <Text style={styles.menuText}>Edit Profile</Text>
              <Ionicons name="chevron-forward" size={20} color="#64748b" />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleChangePassword}
            >
              <View
                style={[
                  styles.menuIcon,
                  { backgroundColor: "rgba(59, 130, 246, 0.1)" },
                ]}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color="#3b82f6"
                />
              </View>
              <Text style={styles.menuText}>Change Password</Text>
              <Ionicons name="chevron-forward" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>
        </View>

        {/* App Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App</Text>
          <View style={styles.sectionCard}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setShowRateModal(true)}
            >
              <View
                style={[
                  styles.menuIcon,
                  { backgroundColor: "rgba(251, 191, 36, 0.1)" },
                ]}
              >
                <Ionicons name="star-outline" size={20} color="#fbbf24" />
              </View>
              <Text style={styles.menuText}>Rate FitCore</Text>
              <Ionicons name="chevron-forward" size={20} color="#64748b" />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setShowAppInfoModal(true)}
            >
              <View
                style={[
                  styles.menuIcon,
                  { backgroundColor: "rgba(59, 130, 246, 0.1)" },
                ]}
              >
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color="#3b82f6"
                />
              </View>
              <Text style={styles.menuText}>App Info</Text>
              <Ionicons name="chevron-forward" size={20} color="#64748b" />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setShowSupportModal(true)}
            >
              <View
                style={[
                  styles.menuIcon,
                  { backgroundColor: "rgba(168, 85, 247, 0.1)" },
                ]}
              >
                <Ionicons
                  name="help-circle-outline"
                  size={20}
                  color="#a855f7"
                />
              </View>
              <Text style={styles.menuText}>Help & Support</Text>
              <Ionicons name="chevron-forward" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#f87171" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>FitCore • v1.0.0</Text>
          <Text style={styles.footerSubtext}>© 2024 All rights reserved</Text>
        </View>
      </ScrollView>

      {/* Modals */}
      {renderSupportModal()}
      {renderAppInfoModal()}
      {renderRateModal()}
    </View>
  );
};

export default Profile;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0f1a",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  scrollContent: {
    paddingHorizontal: width * 0.05,
    paddingTop: height * 0.06,
    paddingBottom: height * 0.05,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#e9eef7",
    marginBottom: height * 0.04,
    letterSpacing: -0.5,
  },
  profileHeaderCard: {
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 20,
    padding: 20,
    marginBottom: height * 0.035,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    flexDirection: "row",
    alignItems: "center",
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#4ade80",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "700",
    color: "#0a0f1a",
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#e9eef7",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: "#94a3b8",
    marginBottom: 12,
  },
  userMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  roleBadge: {
    backgroundColor: "rgba(74, 222, 128, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(74, 222, 128, 0.2)",
  },
  roleText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4ade80",
    textTransform: "capitalize",
  },
  memberSince: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  memberSinceText: {
    fontSize: 11,
    color: "#64748b",
  },
  section: {
    marginBottom: height * 0.03,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#94a3b8",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  sectionCard: {
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  menuText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: "#e9eef7",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginHorizontal: 16,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(248, 113, 113, 0.1)",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.2)",
    marginTop: 20,
    marginBottom: 24,
    gap: 8,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#f87171",
  },
  footer: {
    alignItems: "center",
    paddingVertical: 16,
  },
  footerText: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 4,
    fontWeight: "500",
  },
  footerSubtext: {
    fontSize: 11,
    color: "#475569",
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: "#0f172a",
    borderRadius: 20,
    width: "100%",
    maxWidth: 400,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  modalHeader: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#e9eef7",
    marginTop: 12,
  },
  modalBody: {
    padding: 20,
  },
  modalCloseButton: {
    paddingVertical: 18,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#64748b",
  },
  // Support Modal Styles
  supportOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(30, 41, 59, 0.5)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
  },
  supportOptionContent: {
    flex: 1,
    marginLeft: 12,
  },
  supportOptionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#e9eef7",
    marginBottom: 2,
  },
  supportOptionDescription: {
    fontSize: 13,
    color: "#94a3b8",
  },
  supportActionButton: {
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.2)",
  },
  supportActionText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#3b82f6",
  },
  supportInfoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(30, 41, 59, 0.3)",
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  supportInfoText: {
    fontSize: 12,
    color: "#94a3b8",
  },
  // App Info Modal Styles
  appLogo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(74, 222, 128, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(74, 222, 128, 0.2)",
  },
  infoCard: {
    backgroundColor: "rgba(30, 41, 59, 0.5)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: "#94a3b8",
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#e9eef7",
  },
  descriptionCard: {
    backgroundColor: "rgba(30, 41, 59, 0.5)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
  },
  descriptionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#e9eef7",
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 14,
    color: "#94a3b8",
    lineHeight: 20,
  },
  featuresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(30, 41, 59, 0.5)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
    flex: 1,
    minWidth: "45%",
  },
  featureText: {
    fontSize: 12,
    color: "#94a3b8",
  },
  // Rate Modal Styles
  rateIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(251, 191, 36, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.2)",
  },
  rateContent: {
    alignItems: "center",
    paddingVertical: 8,
  },
  rateTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#e9eef7",
    marginTop: 16,
    marginBottom: 8,
  },
  rateDescription: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  starsContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 24,
  },
  starButton: {
    padding: 4,
  },
  rateButton: {
    backgroundColor: "#fbbf24",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
    marginBottom: 12,
  },
  rateButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0a0f1a",
  },
  laterButton: {
    paddingVertical: 12,
  },
  laterButtonText: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
  },
});
