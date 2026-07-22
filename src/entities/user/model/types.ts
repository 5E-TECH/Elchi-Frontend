export interface User {
    id: string;
    username: string;
    name: string;
    phone_number: string;
    branch_id?: string | null;
    role: "superadmin" | "admin" | "manager" | "registrator" | "courier" | "client" | "market" | "marketing" | "operator" | "customer";
    status: "active" | "inactive" | "blocked";
    createdAt: string;
    updatedAt: string;
    add_order?: boolean;
    cancelled_handover_qr_required?: boolean;
    settings?: Record<string, unknown> | null;
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
