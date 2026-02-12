export type UserRole = 'admin' | 'manager' | 'marketing' | 'operator' | 'courier';

export type UserStatus = 'active' | 'inactive' | 'blocked';

export interface User {
    id: string;
    fullName: string;
    phone: string;
    role: UserRole;
    status: UserStatus;
    avatar?: string;
    paymentDate?: string;
    balance?: number;
}

export interface UserStats {
    total: number;
    markets: number;
    employees: number;
}
