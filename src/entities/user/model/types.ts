export interface User {
    id: string;
    username: string;
    name: string;
    phone_number: string;
    role: "superadmin" | "admin" | "manager" | "courier" | "client";
    status: "active" | "inactive";
    createdAt: string;
    updatedAt: string;
}

export interface UserState {
    user: User | null;
    isAuthenticated: boolean;
    accessToken: string | null;
    refreshToken: string | null;
    loading: boolean;
    isAppInitializing: boolean;
    error: string | null;
}
