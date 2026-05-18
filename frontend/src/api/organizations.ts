import { apiClient } from './apiClient';

export type OrganizationRole = 'owner' | 'admin' | 'staff';

export interface Organization {
  id: string;
  name: string;
  companyName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserOrganization {
  id: string;
  userId: string;
  organizationId: string;
  role: OrganizationRole;
  isActive: boolean;
  joinedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  organization?: Organization;
}

export const organizationsApi = {
  getMyOrganizations: async (): Promise<UserOrganization[]> => {
    const res = await apiClient.get<UserOrganization[]>('/organizations/user/my-organizations');
    if (!Array.isArray(res.data)) {
      // Backend error payload (401/403/etc) can land here if client config changes.
      throw new Error('Failed to load organizations');
    }
    return res.data;
  },
};


