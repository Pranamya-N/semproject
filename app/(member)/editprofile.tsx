import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { updateProfile } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import React, { useState } from "react";
import {
  Alert,
  Dimensions,
  KeyboardAvoidingView,
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

const { width, height } = Dimensions.get("window");

const EditProfile: React.FC = () => {
  const { user, userData, refreshUserData } = useAuth();
  const router = useRouter();

  const [displayName, setDisplayName] = useState(userData?.displayName || "");
  const [loading, setLoading] = useState(false);

  // Check if there are unsaved changes
  const hasUnsavedChanges = () => {
    return displayName !== userData?.displayName;
  };

  const handleBackPress = () => {
    if (hasUnsavedChanges()) {
      Alert.alert(
        "Discard Changes?",
        "You have unsaved changes. Are you sure you want to leave?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => {
              router.push("/(member)/profile");
            },
          },
        ],
      );
    } else {
      router.push("/(member)/profile");
    }
  };

  const handleSave = async (): Promise<void> => {
    if (!displayName.trim()) {
      Alert.alert("Error", "Display name cannot be empty");
      return;
    }

    if (!user) {
      Alert.alert("Error", "No user logged in");
      return;
    }

    setLoading(true);
    try {
      // Update Firebase Auth profile
      await updateProfile(user, {
        displayName: displayName,
      });

      // Update Firestore document
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        displayName: displayName,
        updatedAt: new Date(),
      });

      // Refresh user data
      await refreshUserData();

      // Show success modal
      Alert.alert(
        "Profile Updated",
        "Your display name has been updated successfully.",
        [
          {
            text: "OK",
            onPress: () => router.push("/(member)/profile"),
          },
        ],
      );
    } catch (error: any) {
      console.error("Update profile error:", error);
      Alert.alert(
        "Error",
        error.message || "Failed to update profile. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    handleBackPress();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0f1a" />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBackPress}
            >
              <Ionicons name="arrow-back" size={24} color="#e9eef7" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Edit Profile</Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Current Username Display */}
          <View style={styles.usernameSection}>
            <View style={styles.usernameCard}>
              <Ionicons
                name="person-circle-outline"
                size={48}
                color="#4ade80"
              />
              <View style={styles.usernameInfo}>
                <Text style={styles.currentUsernameLabel}>
                  Current Username
                </Text>
                <Text style={styles.currentUsername}>
                  {userData?.displayName || "User"}
                </Text>
              </View>
            </View>
          </View>

          {/* Form Section */}
          <View style={styles.formSection}>
            {/* Display Name - Only editable field */}
            <View style={styles.inputGroup}>
              <View style={styles.inputLabelRow}>
                <Ionicons name="create-outline" size={16} color="#94a3b8" />
                <Text style={styles.label}>Change Display Name</Text>
              </View>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder={userData?.displayName || "Enter new display name"}
                placeholderTextColor="#64748b"
                autoCapitalize="words"
              />
              <View style={styles.inputBottomLine} />
              <Text style={styles.helperText}>
                This name will be visible to gym admins
              </Text>
            </View>

            {/* Email (Read-only) */}
            <View style={styles.inputGroup}>
              <View style={styles.inputLabelRow}>
                <Ionicons name="mail-outline" size={16} color="#94a3b8" />
                <Text style={styles.label}>Email Address</Text>
              </View>
              <View style={styles.readOnlyContainer}>
                <Text style={styles.readOnlyText}>
                  {userData?.email || "No email"}
                </Text>
              </View>
              <Text style={styles.helperText}>
                Email cannot be changed for security reasons
              </Text>
            </View>

            {/* Role (Read-only) */}
            <View style={styles.inputGroup}>
              <View style={styles.inputLabelRow}>
                <Ionicons name="shield-outline" size={16} color="#94a3b8" />
                <Text style={styles.label}>Account Role</Text>
              </View>
              <View style={styles.readOnlyContainer}>
                <Text style={styles.readOnlyText}>
                  {userData?.role || "Member"}
                </Text>
              </View>
              <Text style={styles.helperText}>
                Your role is assigned by the system
              </Text>
            </View>

            {/* Member Since */}
            {userData?.createdAt && (
              <View style={styles.inputGroup}>
                <View style={styles.inputLabelRow}>
                  <Ionicons name="calendar-outline" size={16} color="#94a3b8" />
                  <Text style={styles.label}>Member Since</Text>
                </View>
                <View style={styles.readOnlyContainer}>
                  <Text style={styles.readOnlyText}>
                    {userData.createdAt.toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Info Card */}
          <View style={styles.infoCard}>
            <Ionicons
              name="information-circle-outline"
              size={20}
              color="#3b82f6"
            />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>About Display Name</Text>
              <Text style={styles.infoText}>
                {`Your display name is how gym admins will identify you. Use your
                real name or a preferred name that you'd like to be called.`}
              </Text>
            </View>
          </View>

          {/* Single Save Button */}
          <TouchableOpacity
            style={[
              styles.saveButton,
              (!hasUnsavedChanges() || loading) && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={!hasUnsavedChanges() || loading}
          >
            {loading ? (
              <Ionicons name="sync" size={22} color="#64748b" />
            ) : (
              <Ionicons name="checkmark-circle" size={22} color="#0a0f1a" />
            )}
            <Text
              style={[
                styles.saveButtonText,
                (!hasUnsavedChanges() || loading) &&
                  styles.saveButtonTextDisabled,
              ]}
            >
              {loading ? "Saving..." : "Save Changes"}
            </Text>
          </TouchableOpacity>

          {/* Cancel Button */}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancel}
            disabled={loading}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

export default EditProfile;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0f1a",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: width * 0.05,
    paddingTop: height * 0.04,
    paddingBottom: height * 0.05,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: height * 0.04,
  },
  backButton: {
    width: 44,
    height: 44,
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
    flex: 1,
    textAlign: "center",
    marginHorizontal: 12,
  },
  headerSpacer: {
    width: 44,
  },
  usernameSection: {
    alignItems: "center",
    marginBottom: height * 0.04,
  },
  usernameCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    gap: 16,
  },
  usernameInfo: {
    flex: 1,
  },
  currentUsernameLabel: {
    fontSize: 14,
    color: "#94a3b8",
    marginBottom: 6,
  },
  currentUsername: {
    fontSize: 20,
    fontWeight: "700",
    color: "#e9eef7",
  },
  formSection: {
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#94a3b8",
  },
  input: {
    fontSize: 16,
    color: "#e9eef7",
    paddingVertical: 12,
    paddingHorizontal: 0,
  },
  inputBottomLine: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginTop: 4,
  },
  readOnlyContainer: {
    backgroundColor: "rgba(30, 41, 59, 0.3)",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
  },
  readOnlyText: {
    fontSize: 16,
    color: "#94a3b8",
    fontWeight: "500",
  },
  helperText: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 8,
    marginLeft: 4,
    lineHeight: 16,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "rgba(30, 41, 59, 0.5)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.2)",
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3b82f6",
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: "#94a3b8",
    lineHeight: 18,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#4ade80",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#4ade80",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  saveButtonDisabled: {
    backgroundColor: "rgba(74, 222, 128, 0.2)",
    shadowColor: "transparent",
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0a0f1a",
  },
  saveButtonTextDisabled: {
    color: "#64748b",
  },
  cancelButton: {
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.3)",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#94a3b8",
  },
});
