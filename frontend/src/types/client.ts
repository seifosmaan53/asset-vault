export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface Client {
  id: string;
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  addressJson?: Address;
  notes?: string;
  tags?: string[];
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

