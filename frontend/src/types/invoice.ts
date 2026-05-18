import type { Client } from './client';
import type { Store } from './store';

export type InvoiceType = 'invoice'; // Only invoices, no estimates
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  inventoryItemId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discountRate: number;
  lineTotal: number;
  createdAt: string;
}

export interface Invoice {
  id: string;
  userId: string;
  clientId: string;
  type: InvoiceType;
  number: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate?: string;
  currency: string;
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  total: number;
  notes?: string;
  metadataJson?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  paidAt?: string;
  paymentMethodNote?: string;
  storeId?: string;
  store?: Store;
  client?: Client;
  items?: InvoiceItem[];
}

