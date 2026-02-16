// User API Service
import { api } from '../../../shared/api/api';
import type { User } from '../types/user';

// API Response types
export interface UserListResponse {
    success: boolean;
    data: User[];
    pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

// API Request params
export interface GetUsersParams {
    search?: string;
    id?: string;
    status?: string;
    page?: number;
    limit?: number;
}

// Get all users with filters
export const getUsers = async (params?: GetUsersParams): Promise<UserListResponse> => {
    const response = await api.get<UserListResponse>('/users', { params });
    return response.data;
};

// Get single user by ID
export const getUserById = async (id: string): Promise<User> => {
    const response = await api.get<{ success: boolean; data: User }>(`/users/${id}`);
    return response.data.data;
};

// Delete user
export const deleteUser = async (id: string): Promise<void> => {
    await api.delete(`/users/${id}`);
};

// Update user status
export const updateUserStatus = async (id: string, status: string): Promise<User> => {
    const response = await api.patch<{ success: boolean; data: User }>(`/users/${id}/status`, { status });
    return response.data.data;
};
