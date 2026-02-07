export type UserRole = "superAdmin" | "gymAdmin" | "member";
export type EnrollmentStatus = "none" | "pending" | "approved" | "rejected";
export type PaymentMethod = "online" | "offline" | "Quarterly" | "6-Month";
export type IssueType =
  | "Equipment"
  | "Cleanliness"
  | "Staff"
  | "Safety"
  | "Other";
export type ReportStatus = "pending" | "reviewed" | "resolved" | "rejected";
export type PlanChangeStatus = "pending" | "approved" | "rejected";

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
  timeSlot?: "Morning" | "Evening" | "Night" | null;
  streak?: number;
  totalDuration?: number;
  statsUpdatedAt?: Date;
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

export interface CheckInRecord {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  gymId: string;
  gymName: string;
  timeSlot: "Morning" | "Evening" | "Night";
  date: string; // "YYYY-MM-DD" local date
  checkInTime: Date;
  checkOutTime: Date;
  duration: number; // seconds
  createdAt: Date;
}

export interface ActiveCheckIn {
  userId: string;
  userName: string;
  gymId: string;
  gymName: string;
  timeSlot: "Morning" | "Evening" | "Night";
  checkInTime: Date;
  createdAt: Date;
}

export interface PlanChangeRequest {
  id: string;
  userId: string;
  gymId: string | null;
  currentDuration: number;
  requestedDuration: number;
  status: PlanChangeStatus;
  createdAt: Date;
  reviewedAt: Date | null;
  reviewedBy: string | null;
}

export interface GymReport {
  id?: string;
  gymId: string;
  gymName: string;
  userId: string;
  userName: string;
  userEmail: string;
  issueTypes: IssueType[];
  description: string;
  status: ReportStatus;
  createdAt: Date;
  reviewedAt?: Date | null;
  reviewedBy?: string | null;
  adminNotes?: string;
}
