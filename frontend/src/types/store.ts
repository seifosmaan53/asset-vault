import type { Client } from './client';

export interface Store {
  id: string;
  userId: string;
  clientId: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  email?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  // Relations (when loaded)
  client?: Client;
}

export interface StoreItemSettings {
  id: string;
  storeId: string;
  inventoryItemId: string;
  currentStock: number;
  minQty: number;
  targetQty?: number;
  weeklyUsage?: number;
  createdAt: string;
  updatedAt: string;
  // Relations (when loaded)
  store?: Store;
  inventoryItem?: import('./inventory').InventoryItem;
}

