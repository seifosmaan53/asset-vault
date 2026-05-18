export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

import type { Store } from './store';

export interface Client {
  id: string;
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  addressJson?: Address;
  notes?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  // Relations (when loaded)
  stores?: Store[];
}

