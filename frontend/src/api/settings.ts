import { apiClient } from './apiClient';
import { getErrorMessage } from '../utils/errorHandling';

export interface UserSettings {
  // Existing fields
  invoiceNumberFormat?: string;
  defaultCurrency?: string;
  defaultTaxRate?: number;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
  companyLogo?: string;
  companyTaxId?: string;
  companyRegistrationNumber?: string;
  companyVatNumber?: string;

  // Invoice Defaults
  defaultPaymentTermsDays?: number;
  defaultInvoiceNotes?: string;
  defaultInvoiceTerms?: string;
  autoGenerateInvoiceNumber?: boolean;
  showInvoiceNumberOnPDF?: boolean;
  showPaymentInstructions?: boolean;
  invoiceFooterText?: string;

  // Date & Time Formats
  dateFormat?: string;
  timeFormat?: string;
  timezone?: string;

  // Number & Currency Formats
  decimalSeparator?: string;
  thousandsSeparator?: string;
  currencySymbolPosition?: string;
  showCurrencySymbol?: boolean;

  // Tax Settings
  taxInclusive?: boolean;
  taxRegistrationNumber?: string;

  // Inventory Defaults
  defaultReorderLevel?: number;
  defaultInventoryUnit?: string;
  trackInventory?: boolean;
  allowNegativeStock?: boolean;
  autoReorderEnabled?: boolean;
  stockAlertThreshold?: number;

  // Email/SMTP Settings
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPassword?: string;
  emailFromName?: string;
  emailFromAddress?: string;

  // Notification Settings
  emailInvoiceSent?: boolean;
  emailInvoicePaid?: boolean;
  emailInvoiceOverdue?: boolean;
  emailLowStockAlert?: boolean;
  emailInvoiceReminder?: boolean;
  emailWeeklyReport?: boolean;
  emailMonthlyReport?: boolean;

  // UI/Display Settings
  theme?: string;
  itemsPerPage?: number;
  language?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

export interface BackupResponse {
  message: string;
  timestamp: string;
  backupId: string;
  data?: Record<string, unknown>;
  sqlBackupPath?: string;
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

  createBackup: async (options?: { includeSqlBackup?: boolean }): Promise<BackupResponse> => {
    const response = await apiClient.post<BackupResponse>('/user-settings/backup', options || {});
    return response.data;
  },

  exportData: async (format: 'json' | 'csv' | 'excel' | 'pdf' = 'json'): Promise<Blob> => {
    try {
      const response = await apiClient.post('/user-settings/backup/export', { format }, {
        responseType: 'blob',
      });
      
      // Check if response is an error by checking content type
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('application/json') || response.status >= 400) {
        // Response is JSON error, parse it
        const blob = response.data as Blob;
        const text = await blob.text();
        try {
          const errorData = JSON.parse(text);
          throw new Error(errorData.message || `Failed to export data as ${format}`);
        } catch (parseError) {
          throw new Error(`Failed to export data as ${format}. Server returned status ${response.status}`);
        }
      }
      
      return response.data;
    } catch (error: unknown) {
      // If it's already an Error with a message, rethrow it
      if (error instanceof Error && error.message) {
        throw error;
      }
      // Otherwise wrap it with proper error message extraction
      throw new Error(getErrorMessage(error, `Failed to export data as ${format}`));
    }
  },

  testEmail: async (credentials?: {
    smtpHost?: string;
    smtpPort?: number;
    smtpSecure?: boolean;
    smtpUser?: string;
    smtpPassword?: string;
    emailFromAddress?: string;
    emailFromName?: string;
  }): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post<{ success: boolean; message: string }>(
      '/user-settings/test-email',
      credentials || {}
    );
    return response.data;
  },

};

