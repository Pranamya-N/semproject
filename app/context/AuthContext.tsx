import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../lib/firebase';
import { EnrollmentStatus, UserData, UserRole, PaymentMethod } from '../types';

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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchUserData = async (firebaseUser: User): Promise<void> => {
    try {
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const data = userDoc.data();

        // Set dynamic planDuration based on paymentMethod
        let planDuration = 1; // default 1 month
        if (data.paymentMethod === 'Quarterly') planDuration = 3;
        else if (data.paymentMethod === '6-Month') planDuration = 6;

        setUserData({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || data.displayName,
          role: data.role || 'member',
          gymId: data.gymId || null,
          enrollmentStatus: data.enrollmentStatus || 'none',
          paymentMethod: data.paymentMethod || null,
          transactionId: data.transactionId || null,
          enrolledAt: data.enrolledAt?.toDate() || null,
          createdAt: data.createdAt?.toDate() || new Date(),
          planDuration,
        });
      } else {
        // Create new user document
        const newUserData = {
          displayName: firebaseUser.displayName,
          email: firebaseUser.email,
          role: 'member' as UserRole,
          gymId: null,
          enrollmentStatus: 'none' as EnrollmentStatus,
          paymentMethod: null as PaymentMethod | null,
          transactionId: null,
          enrolledAt: null,
          createdAt: serverTimestamp(),
          planDuration: 1, // default
        };

        await setDoc(userDocRef, newUserData);

        setUserData({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          role: 'member',
          gymId: null,
          enrollmentStatus: 'none',
          paymentMethod: null,
          transactionId: null,
          enrolledAt: null,
          createdAt: new Date(),
          planDuration: 1,
        });
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
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
      await signOut(auth);
      setUser(null);
      setUserData(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading, logout, refreshUserData }}>
      {children}
    </AuthContext.Provider>
  );
};
