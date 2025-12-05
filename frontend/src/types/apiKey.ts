export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  permissions: string[];
  expiresAt?: string;
  isActive: boolean;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
  key?: string;
}

