export interface User {
  userId: string;
  username: string;
  email: string;
  given_name: string;
  family_name: string;
  birthdate: string;
  groups: string[];
  isAdmin: boolean;
}

export interface LoginRequest {
  username: string; // Can be username or email
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  given_name: string;
  family_name: string;
  birthdate: string; // YYYY-MM-DD format
}

export interface AuthResponse {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  user: User;
}