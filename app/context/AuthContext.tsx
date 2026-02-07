import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../lib/firebase";
import { EnrollmentStatus, PaymentMethod, UserData, UserRole } from "../types";

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  logout: async () => {},
  refreshUserData: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeListeners, setActiveListeners] = useState<Set<() => void>>(
    new Set(),
  );

  // Function to register listeners (optional but good practice)
  const registerListener = (unsubscribe: () => void) => {
    setActiveListeners((prev) => new Set(prev).add(unsubscribe));
  };

  // Function to unregister listeners
  const unregisterListener = (unsubscribe: () => void) => {
    setActiveListeners((prev) => {
      const newSet = new Set(prev);
      newSet.delete(unsubscribe);
      return newSet;
    });
  };

  const fetchUserData = async (firebaseUser: User): Promise<void> => {
    try {
      const userDocRef = doc(db, "users", firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const data = userDoc.data();

        // Use planDuration from Firestore if it exists, otherwise derive from paymentMethod
        let planDuration = data.planDuration ?? 1;
        if (!data.planDuration) {
          if (data.paymentMethod === "Quarterly") planDuration = 3;
          else if (data.paymentMethod === "6-Month") planDuration = 6;
        }

        setUserData({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || data.displayName,
          role: data.role || "member",
          gymId: data.gymId || null,
          enrollmentStatus: data.enrollmentStatus || "none",
          paymentMethod: data.paymentMethod || null,
          transactionId: data.transactionId || null,
          enrolledAt: data.enrolledAt?.toDate() || null,
          createdAt: data.createdAt?.toDate() || new Date(),
          planDuration,
          timeSlot: data.timeSlot || null, // ADDED: Time slot field
        });
      } else {
        // Create new user document
        const newUserData = {
          displayName: firebaseUser.displayName,
          email: firebaseUser.email,
          role: "member" as UserRole,
          gymId: null,
          enrollmentStatus: "none" as EnrollmentStatus,
          paymentMethod: null as PaymentMethod | null,
          transactionId: null,
          enrolledAt: null,
          createdAt: serverTimestamp(),
          planDuration: 1, // default
          timeSlot: null, // ADDED: Default no time slot
        };

        await setDoc(userDocRef, newUserData);

        setUserData({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          role: "member",
          gymId: null,
          enrollmentStatus: "none",
          paymentMethod: null,
          transactionId: null,
          enrolledAt: null,
          createdAt: new Date(),
          planDuration: 1,
          timeSlot: null, // ADDED: Default no time slot
        });
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      setUserData(null);
    }
  };

  const refreshUserData = async (): Promise<void> => {
    if (user) await fetchUserData(user);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) await fetchUserData(firebaseUser);
      else setUserData(null);

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async (): Promise<void> => {
    try {
      // ⭐⭐ METHOD 1: Clear all active Firestore listeners first
      console.log(`Clearing ${activeListeners.size} active listeners...`);
      activeListeners.forEach((unsubscribe) => {
        try {
          unsubscribe();
        } catch (e) {
          // Ignore errors from already closed listeners
        }
      });
      setActiveListeners(new Set());

      // ⭐⭐ METHOD 2: Small delay to let listeners clean up
      await new Promise((resolve) => setTimeout(resolve, 300));

      // ⭐⭐ METHOD 3: Clear user data BEFORE signOut to prevent rule checks
      setUserData(null);
      setUser(null);

      // ⭐⭐ METHOD 4: Finally sign out from Firebase Auth
      await signOut(auth);
    } catch (error: any) {
      // ⭐⭐ Ignore Firestore permission errors during logout
      if (error.code === "permission-denied") {
        console.log("Firestore listener closed during logout (expected)");
      } else {
        console.error("Error signing out:", error);
        throw error;
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userData,
        loading,
        logout,
        refreshUserData,
        // Optional: Export these if you want to manage listeners from components
        // registerListener,
        // unregisterListener
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
