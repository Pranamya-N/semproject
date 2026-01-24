export type UserRole = 'superAdmin' | 'gymAdmin' | 'member';
export type EnrollmentStatus = 'none' | 'pending' | 'approved' | 'rejected';
export type PaymentMethod = 'online' | 'offline' | 'Quarterly' | '6-Month';

export interface Gym {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  upiId: string;
  monthlyFee: number;
  createdAt: Date;
  adminId: string;
  isActive: boolean;
  description?: string;
  quarterlyFee?: number;
  annualFee?: number;
  amenities?: string[];
  images?: string[];
  rating?: number;
  reviews?: number;
  openingHours?: string;
  capacity?: number;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface UserData {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  gymId: string | null;
  enrollmentStatus: EnrollmentStatus;
  paymentMethod: PaymentMethod | null;
  transactionId: string | null;
  enrolledAt: Date | null;
  createdAt: Date;
  planDuration?: number;
}

export interface Enrollment {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  gymId: string;
  gymName: string;
  paymentMethod: PaymentMethod;
  transactionId: string | null;
  amount: number;
  status: EnrollmentStatus;
  createdAt: Date;
  verifiedAt: Date | null;
  verifiedBy: string | null;
}