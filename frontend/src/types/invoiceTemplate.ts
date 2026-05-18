export interface TemplateData {
  header?: {
    logo?: string;
    companyName?: string;
    companyAddress?: string;
    companyPhone?: string;
    companyEmail?: string;
  };
  footer?: {
    text?: string;
    showPageNumbers?: boolean;
  };
  styles?: {
    primaryColor?: string;
    secondaryColor?: string;
    fontFamily?: string;
    fontSize?: number;
  };
  sections?: {
    showClientInfo?: boolean;
    showStoreInfo?: boolean;
    showItemsTable?: boolean;
    showTotals?: boolean;
    showNotes?: boolean;
  };
  variables?: Record<string, string>;
}

export interface InvoiceTemplate {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  templateData: TemplateData;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateInvoiceTemplateDto {
  name: string;
  description?: string;
  templateData: TemplateData;
  isDefault?: boolean;
}

export interface UpdateInvoiceTemplateDto {
  name?: string;
  description?: string;
  templateData?: TemplateData;
  isDefault?: boolean;
}
