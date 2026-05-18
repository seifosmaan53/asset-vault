export type UserRole = 'owner' | 'admin' | 'staff';

export interface User {
  id: string;
  email: string;
  name: string;
  companyName?: string;
  phone?: string;
  address?: string;
  timezone?: string;
  bio?: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

