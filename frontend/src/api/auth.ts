// Copyright (c) 2025 Asset Vault. All rights reserved.

import { apiClient } from './apiClient';
import type { User } from '../types/user';

export const authApi = {
  getProfile: async (): Promise<User> => {
    const response = await apiClient.get<User>('/auth/profile');
    return response.data;
  },

  updateProfile: async (data: Partial<User>): Promise<User> => {
    const response = await apiClient.patch<User>('/auth/profile', data);
    return response.data;
  },

  changePassword: async (data: { currentPassword: string; newPassword: string }): Promise<void> => {
    await apiClient.post('/auth/change-password', data);
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },
};
