import { apiClient } from './apiClient';
import { User } from '../types/user';

export interface UserSettings {
  invoiceNumberFormat?: string;
  defaultCurrency?: string;
  defaultTaxRate?: number;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
}

export const settingsApi = {
  getSettings: async (): Promise<UserSettings> => {
    const response = await apiClient.get<UserSettings>('/user-settings');
    return response.data;
  },

  updateSettings: async (data: UserSettings): Promise<UserSettings> => {
    const response = await apiClient.patch<UserSettings>('/user-settings', data);
    return response.data;
  },
};

