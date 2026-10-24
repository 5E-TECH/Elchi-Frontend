export interface User {
    id: string;
    username: string;
    name: string;
    phone_number: string;
    branch_id?: string | null;
    role:
        | "superadmin"
        | "admin"
        | "manager"
        | "registrator"
        | "courier"
        | "client"
        | "market"
        | "marketing"
        | "operator"
        | "customer"
        | "logist"
        | "market_operator"
        | "investor"
        | "branch";
    status: "active" | "inactive" | "blocked";
    createdAt: string;
    updatedAt: string;
    add_order?: boolean;
    cancelled_handover_qr_required?: boolean;
    settings?: Record<string, unknown> | null;
    /** MO-2: market operatorining marketi (`my-profile` → `market_id`) — bosh sahifada o'z marketi qatorini belgilash uchun. */
    market_id?: string | number | null;
    /** XtcEyQjb: market operatori «Ombordagi qoldiq» ni ko'radimi (`my-profile`; market yoqadi, sukut `false`). */
    can_view_warehouse_stock?: boolean;
    /** 6kHnNH9j: market «Ombordan buyurtma yaratish» kaliti (`my-profile`; superadmin/admin yoqadi, sukut `false`). */
    can_order_from_warehouse?: boolean;
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
