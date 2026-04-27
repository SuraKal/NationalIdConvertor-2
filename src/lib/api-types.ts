export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  wallet_balance: number;
  total_downloads: number;
  created_at: string;
}

export interface DashboardResponse {
  profile: AuthUser;
  downloadCount: number;
}

export interface PaymentMethod {
  id: string;
  name: string;
  account_holder_name: string;
  account_number: string;
  created_at?: string;
}

export interface PackageItem {
  id: string;
  name: string;
  credits: number;
  price: number;
  currency: string;
  is_active: boolean;
  created_at?: string;
}

export interface PaymentRequest {
  id: string;
  user_id: string;
  payment_method_id: string;
  payment_method_name?: string;
  package_id: string | null;
  transaction_number: string;
  amount: number;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  user_name?: string;
  user_email?: string;
}
