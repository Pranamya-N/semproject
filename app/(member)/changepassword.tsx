import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import React, { useEffect, useState } from "react";
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

const { width, height } = Dimensions.get("window");

// Password strength checker (same as signup)
const checkPasswordStrength = (password: string) => {
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  };

  const score = Object.values(checks).filter(Boolean).length;
  let strength = "Very Weak";
  let color = "#f87171";

  if (score === 5) {
    strength = "Very Strong";
    color = "#10b981";
  } else if (score >= 4) {
    strength = "Strong";
    color = "#4ade80";
  } else if (score >= 3) {
    strength = "Good";
    color = "#fbbf24";
  } else if (score >= 2) {
    strength = "Weak";
    color = "#f97316";
  }

  return { checks, strength, color, score };
};

const ChangePassword: React.FC = () => {
  const { user } = useAuth();
  const router = useRouter();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Toggle password visibility
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Password strength state
  const [passwordStrength, setPasswordStrength] = useState({
    checks: {
      length: false,
      uppercase: false,
      lowercase: false,
      number: false,
      special: false,
    },
    strength: "Very Weak",
    color: "#f87171",
    score: 0,
  });

  // Update password strength when new password changes
  useEffect(() => {
    if (newPassword) {
      setPasswordStrength(checkPasswordStrength(newPassword));
    } else {
      setPasswordStrength({
        checks: {
          length: false,
          uppercase: false,
          lowercase: false,
          number: false,
          special: false,
        },
        strength: "Very Weak",
        color: "#f87171",
        score: 0,
      });
    }
  }, [newPassword]);

  const handleChangePassword = (): void => {
    // Validation
    if (!oldPassword.trim()) {
      Alert.alert("Error", "Please enter your current password");
      return;
    }

    if (!newPassword.trim()) {
      Alert.alert("Error", "Please enter a new password");
      return;
    }

    // Enhanced password validation
    if (newPassword.length < 8) {
      Alert.alert("Error", "New password must be at least 8 characters long.");
      return;
    }

    if (!/[A-Z]/.test(newPassword)) {
      Alert.alert(
        "Error",
        "New password must contain at least one uppercase letter.",
      );
      return;
    }

    if (!/[a-z]/.test(newPassword)) {
      Alert.alert(
        "Error",
        "New password must contain at least one lowercase letter.",
      );
      return;
    }

    if (!/[0-9]/.test(newPassword)) {
      Alert.alert("Error", "New password must contain at least one number.");
      return;
    }

    // Optional: Require special character
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)) {
      Alert.alert(
        "Error",
        "New password must contain at least one special character (!@#$%^&* etc.).",
      );
      return;
    }

    if (!confirmPassword.trim()) {
      Alert.alert("Error", "Please confirm your new password");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "New password and confirm password do not match");
      return;
    }

    if (oldPassword === newPassword) {
      Alert.alert(
        "Error",
        "New password must be different from the current password",
      );
      return;
    }

    if (!user || !user.email) {
      Alert.alert("Error", "No user logged in");
      return;
    }

    // Show confirmation dialog
    Alert.alert(
      "Confirm Password Change",
      "Are you sure you want to change your password?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Change",
          onPress: async () => {
            setLoading(true);
            try {
              // Re-authenticate user with old password
              const credential = EmailAuthProvider.credential(
                user.email!,
                oldPassword,
              );
              await reauthenticateWithCredential(user, credential);

              // Update to new password
              await updatePassword(user, newPassword);

              Alert.alert(
                "Success",
                "Your password has been changed successfully",
                [
                  {
                    text: "OK",
                    onPress: () => {
                      // Clear fields and go back
                      setOldPassword("");
                      setNewPassword("");
                      setConfirmPassword("");
                      router.push("/(member)/profile");
                    },
                  },
                ],
              );
            } catch (error: any) {
              console.error("Change password error:", error);

              // Handle specific error cases
              if (
                error.code === "auth/wrong-password" ||
                error.code === "auth/invalid-credential"
              ) {
                Alert.alert("Error", "Current password is incorrect");
              } else if (error.code === "auth/too-many-requests") {
                Alert.alert(
                  "Error",
                  "Too many attempts. Please try again later",
                );
              } else {
                Alert.alert(
                  "Error",
                  error.message ||
                    "Failed to change password. Please try again.",
                );
              }
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  const renderPasswordRequirement = (label: string, isMet: boolean) => (
    <View style={styles.requirementRow} key={label}>
      <Ionicons
        name={isMet ? "checkmark-circle" : "close-circle"}
        size={16}
        color={isMet ? "#4ade80" : "#64748b"}
      />
      <Text style={[styles.requirementText, isMet && styles.requirementMet]}>
        {label}
      </Text>
    </View>
  );

  const handleBackPress = () => {
    if (oldPassword || newPassword || confirmPassword) {
      Alert.alert(
        "Discard Changes?",
        "You have entered password information. Are you sure you want to leave?",
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
            <Text style={styles.headerTitle}>Change Password</Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Icon Section */}
          <View style={styles.iconSection}>
            <View style={styles.iconCircle}>
              <Ionicons name="lock-closed" size={36} color="#0a0f1a" />
            </View>
            <Text style={styles.iconTitle}>Password Security</Text>
            <Text style={styles.iconSubtitle}>
              Create a strong new password to protect your account
            </Text>
          </View>

          {/* Form Section */}
          <View style={styles.formSection}>
            {/* Current Password */}
            <View style={styles.inputGroup}>
              <View style={styles.inputLabelRow}>
                <Ionicons
                  name="lock-closed-outline"
                  size={16}
                  color="#94a3b8"
                />
                <Text style={styles.label}>Current Password</Text>
              </View>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  value={oldPassword}
                  onChangeText={setOldPassword}
                  placeholder="Enter your current password"
                  placeholderTextColor="#64748b"
                  secureTextEntry={!showOldPassword}
                  autoCapitalize="none"
                  editable={!loading}
                />
                <TouchableOpacity
                  onPress={() => setShowOldPassword(!showOldPassword)}
                  style={styles.eyeButton}
                >
                  <Ionicons
                    name={showOldPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color="#64748b"
                  />
                </TouchableOpacity>
              </View>
              <View style={styles.inputBottomLine} />
            </View>

            {/* New Password */}
            <View style={styles.inputGroup}>
              <View style={styles.inputLabelRow}>
                <Ionicons name="key-outline" size={16} color="#94a3b8" />
                <Text style={styles.label}>New Password</Text>
              </View>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Create new password"
                  placeholderTextColor="#64748b"
                  secureTextEntry={!showNewPassword}
                  autoCapitalize="none"
                  editable={!loading}
                />
                <TouchableOpacity
                  onPress={() => setShowNewPassword(!showNewPassword)}
                  style={styles.eyeButton}
                >
                  <Ionicons
                    name={showNewPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color="#64748b"
                  />
                </TouchableOpacity>
              </View>
              <View style={styles.inputBottomLine} />

              {/* Password Strength Indicator */}
              {newPassword.length > 0 && (
                <View style={styles.passwordStrengthContainer}>
                  <View style={styles.strengthHeader}>
                    <Text style={styles.strengthLabel}>Password Strength:</Text>
                    <Text
                      style={[
                        styles.strengthValue,
                        { color: passwordStrength.color },
                      ]}
                    >
                      {passwordStrength.strength}
                    </Text>
                  </View>

                  {/* Strength Bar */}
                  <View style={styles.strengthBarContainer}>
                    <View
                      style={[
                        styles.strengthBar,
                        {
                          width: `${(passwordStrength.score / 5) * 100}%`,
                          backgroundColor: passwordStrength.color,
                        },
                      ]}
                    />
                  </View>

                  {/* Requirements List */}
                  <View style={styles.requirementsContainer}>
                    {renderPasswordRequirement(
                      "At least 8 characters",
                      passwordStrength.checks.length,
                    )}
                    {renderPasswordRequirement(
                      "One uppercase letter",
                      passwordStrength.checks.uppercase,
                    )}
                    {renderPasswordRequirement(
                      "One lowercase letter",
                      passwordStrength.checks.lowercase,
                    )}
                    {renderPasswordRequirement(
                      "One number",
                      passwordStrength.checks.number,
                    )}
                    {renderPasswordRequirement(
                      "One special character",
                      passwordStrength.checks.special,
                    )}
                  </View>
                </View>
              )}
            </View>

            {/* Confirm New Password */}
            <View style={styles.inputGroup}>
              <View style={styles.inputLabelRow}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={16}
                  color="#94a3b8"
                />
                <Text style={styles.label}>Confirm New Password</Text>
              </View>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter new password"
                  placeholderTextColor="#64748b"
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  editable={!loading}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeButton}
                >
                  <Ionicons
                    name={
                      showConfirmPassword ? "eye-off-outline" : "eye-outline"
                    }
                    size={20}
                    color="#64748b"
                  />
                </TouchableOpacity>
              </View>
              <View style={styles.inputBottomLine} />

              {/* Password Match Indicator */}
              {confirmPassword.length > 0 && (
                <View style={styles.matchIndicator}>
                  <Ionicons
                    name={
                      newPassword === confirmPassword
                        ? "checkmark-circle"
                        : "close-circle"
                    }
                    size={16}
                    color={
                      newPassword === confirmPassword ? "#4ade80" : "#f87171"
                    }
                  />
                  <Text
                    style={[
                      styles.matchText,
                      {
                        color:
                          newPassword === confirmPassword
                            ? "#4ade80"
                            : "#f87171",
                      },
                    ]}
                  >
                    {newPassword === confirmPassword
                      ? "Passwords match"
                      : "Passwords don't match"}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Password Requirements Info */}
          <View style={styles.infoCard}>
            <Ionicons
              name="shield-checkmark-outline"
              size={20}
              color="#3b82f6"
            />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Password Requirements</Text>
              <Text style={styles.infoText}>
                For your security, your new password must meet all the strength
                requirements listed above. This helps protect your account from
                unauthorized access.
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[
                styles.saveButton,
                (loading ||
                  newPassword !== confirmPassword ||
                  passwordStrength.score < 3) &&
                  styles.saveButtonDisabled,
              ]}
              onPress={handleChangePassword}
              disabled={
                loading ||
                newPassword !== confirmPassword ||
                passwordStrength.score < 3
              }
            >
              <Ionicons
                name={loading ? "sync" : "shield-checkmark"}
                size={22}
                color={
                  loading ||
                  newPassword !== confirmPassword ||
                  passwordStrength.score < 3
                    ? "#94a3b8"
                    : "#0a0f1a"
                }
              />
              <Text
                style={[
                  styles.saveButtonText,
                  (loading ||
                    newPassword !== confirmPassword ||
                    passwordStrength.score < 3) &&
                    styles.saveButtonTextDisabled,
                ]}
              >
                {loading ? "Updating..." : "Change Password"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleBackPress}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

export default ChangePassword;

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
  iconSection: {
    alignItems: "center",
    marginBottom: height * 0.04,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#4ade80",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 3,
    borderColor: "rgba(74, 222, 128, 0.3)",
    shadowColor: "#4ade80",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  iconTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#e9eef7",
    marginBottom: 8,
  },
  iconSubtitle: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 20,
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
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#e9eef7",
    paddingVertical: 12,
    paddingHorizontal: 0,
  },
  eyeButton: {
    padding: 8,
    marginLeft: 8,
  },
  inputBottomLine: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginTop: 4,
  },
  passwordStrengthContainer: {
    backgroundColor: "rgba(30, 41, 59, 0.5)",
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  strengthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  strengthLabel: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "500",
  },
  strengthValue: {
    fontSize: 13,
    fontWeight: "700",
  },
  strengthBarContainer: {
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 2,
    marginBottom: 12,
    overflow: "hidden",
  },
  strengthBar: {
    height: "100%",
    borderRadius: 2,
  },
  requirementsContainer: {
    gap: 8,
  },
  requirementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  requirementText: {
    color: "#64748b",
    fontSize: 12,
  },
  requirementMet: {
    color: "#94a3b8",
  },
  matchIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  matchText: {
    fontSize: 13,
    fontWeight: "500",
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
  actionsContainer: {
    gap: 12,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#4ade80",
    borderRadius: 14,
    padding: 16,
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
