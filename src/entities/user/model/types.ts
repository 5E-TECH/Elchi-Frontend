export interface User {
    id: string;
    username: string;
    name: string;
    phone_number: string;
    role: "superadmin" | "admin" | "manager" | "registrator" | "courier" | "client" | "market" | "marketing" | "operator" | "customer";
    status: "active" | "inactive" | "blocked";
    createdAt: string;
    updatedAt: string;
    add_order?: boolean;
}

export interface UserState {
    user: User | null;
    isAuthenticated: boolean;
    accessToken: string | null;
    loading: boolean;
    isAppInitializing: boolean;
    error: string | null;
}

export interface IdentityUser {
    id: string;
    fullName: string;
    username: string;
    phone?: string;
    role?: User["role"];
    status?: User["status"];
}
