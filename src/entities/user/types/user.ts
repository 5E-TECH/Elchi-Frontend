export type UserRole = 'admin' | 'manager' | 'marketing' | 'operator' | 'courier' | 'market' | 'superadmin' | 'customer';

export type UserStatus = 'active' | 'inactive' | 'blocked';

export interface OrderItem {
    id: string;
    product_id: string;
    order_id: string;
    quantity: number;
    createdAt: string;
    updatedAt: string;
}

export interface Order {
    id: string;
    market_id: string;
    customer_id: string;
    product_quantity: number;
    where_deliver: 'home' | 'center';
    total_price: number;
    to_be_paid: number;
    paid_amount: number;
    status: string;
    comment: string | null;
    district_id: string;
    region_id: string;
    createdAt: string;
    updatedAt: string;
    items?: OrderItem[];
}

// Backend dan kelgan user ma'lumotlari
export interface User {
    id: string;
    name: string;                    // Backend: name
    phone_number: string;            // Backend: phone_number
    username: string;
    role: UserRole;
    status: UserStatus;
    salary: number;
    payment_day: string | null;
    createdAt: string;
    updatedAt: string;
    is_deleted: boolean;
    tariff_home: number | null;
    tariff_center: number | null;
    default_tariff: 'home' | 'center';
    avatar?: string;
    balance?: number;
    orders?: Order[];
}

export interface UserStats {
    total: number;
    markets: number;
    employees: number;
}

// Backend response strukturasi
export interface UserListResponse {
    success: boolean;
    data: {
        items: User[];
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    };
}

// ==================== CREATE ADMIN ====================

// Admin yaratish uchun request body
export interface CreateAdminRequest {
    name: string;           // Admin ismi
    phone_number: string;   // Telefon raqam (+998...)
    password: string;       // Parol
    salary: number;         // Maosh (so'm)
    payment_day: number;    // To'lov kuni (1-31)
}

// Admin yaratish response
export interface CreateAdminResponse {
    success: boolean;
    data: User;  // Yaratilgan admin ma'lumotlari
}

// ==================== CREATE MARKET ====================

// Market yaratish uchun request body
export interface CreateMarketRequest {
    name: string;                          // Market nomi
    phone_number: string;                  // Telefon (+998...)
    username: string;                      // Username
    password: string;                      // Parol
    tariff_home: number;                   // Uyga tarif (so'm)
    tariff_center: number;                 // Markazga tarif (so'm)
    default_tariff: 'address' | 'center'; // Asosiy tarif turi
}

// Market yaratish response
export interface CreateMarketResponse {
    success: boolean;
    data: User;
}

// ==================== CREATE COURIER ====================

export interface CreateCourierRequest {
    region_id: string;     // Viloyat ID (backenddan olinadi)
    name: string;          // Kuryer ismi
    phone_number: string;  // Telefon (+998...)
    password: string;      // Parol
    tariff_home: number;   // Uyga tarif (so'm)
    tariff_center: number; // Markazga tarif (so'm)
}

// ==================== USER DETAIL ====================

export interface UserDetailResponse {
    success: boolean;
    data: User;
}

// ==================== UPDATE USER ====================

export interface UpdateUserRequest {
    name?: string;
    phone_number?: string;
    username?: string;
    password?: string;
    status?: UserStatus;
    salary?: number;
    payment_day?: number;
    tariff_home?: number;
    tariff_center?: number;
    add_order?: boolean;
    default_tariff?: 'address' | 'center';
    region_id?: string;
}

