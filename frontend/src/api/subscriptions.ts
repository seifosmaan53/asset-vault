// Copyright (c) 2025 Asset Vault. All rights reserved.

import { apiClient } from './apiClient';

export interface Subscription {
  id: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'incomplete_expired' | 'pending';
  plan: {
    id: string;
    name: string;
    price: number;
    billingCycle: 'monthly' | 'yearly';
    features: Record<string, any>;
  };
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: string | null;
}

export interface Usage {
  invoices_created: number;
  clients_created: number;
  inventory_items_created: number;
  storage_used_mb: number;
  api_requests: number;
}

export interface BillingInvoice {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created: string;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
}

export const subscriptionsApi = {
  getCurrentSubscription: async (): Promise<{ subscription: Subscription | null; status: string }> => {
    const response = await apiClient.get<{ subscription: Subscription | null; status: string }>('/subscriptions/current');
    return response.data;
  },

  createCheckoutSession: async (): Promise<{ sessionId: string; url: string }> => {
    const response = await apiClient.post<{ sessionId: string; url: string }>('/subscriptions/create-checkout');
    return response.data;
  },

  createPortalSession: async (): Promise<{ url: string }> => {
    const response = await apiClient.post<{ url: string }>('/subscriptions/create-portal');
    return response.data;
  },

  cancelSubscription: async (): Promise<{ message: string; subscription: Partial<Subscription> }> => {
    const response = await apiClient.post<{ message: string; subscription: Partial<Subscription> }>('/subscriptions/cancel');
    return response.data;
  },

  reactivateSubscription: async (): Promise<{ message: string; subscription: Partial<Subscription> }> => {
    const response = await apiClient.post<{ message: string; subscription: Partial<Subscription> }>('/subscriptions/reactivate');
    return response.data;
  },

  getUsage: async (): Promise<{ usage: Usage }> => {
    const response = await apiClient.get<{ usage: Usage }>('/subscriptions/usage');
    return response.data;
  },

  getBillingHistory: async (): Promise<{ invoices: BillingInvoice[] }> => {
    const response = await apiClient.get<{ invoices: BillingInvoice[] }>('/subscriptions/billing-history');
    return response.data;
  },

  verifyCheckoutSession: async (sessionId: string): Promise<{ verified: boolean; status?: string; subscription: Subscription | null }> => {
    const response = await apiClient.post<{ verified: boolean; status?: string; subscription: Subscription | null }>('/subscriptions/verify-checkout', { sessionId });
    return response.data;
  },

  syncSubscription: async (): Promise<{ message: string; subscription: Subscription }> => {
    const response = await apiClient.post<{ message: string; subscription: Subscription }>('/subscriptions/sync');
    return response.data;
  },
};

