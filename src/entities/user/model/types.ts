export interface User {
    id: number;
    firstName: string;
    lastName: string;
    phone: string;
    role: "admin" | "manager" | "courier" | "client";
}

export interface UserState {
    user: User | null;
    isAuthenticated: boolean;
    token: string | null;
    loading: boolean;
    error: string | null;
}
