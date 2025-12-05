export type Frequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface RecurringInvoiceItem {
  inventoryItemId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discountRate: number;
}

export interface RecurringInvoice {
  id: string;
  userId: string;
  clientId: string;
  name: string;
  frequency: Frequency;
  interval: number;
  startDate: string;
  endDate?: string;
  nextRunDate: string;
  currency: string;
  items: RecurringInvoiceItem[];
  notes?: string;
  isActive: boolean;
  invoicesGenerated: number;
  createdAt: string;
  updatedAt: string;
}

