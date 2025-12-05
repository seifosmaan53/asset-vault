export interface InvoiceTemplate {
  id: string;
  userId: string;
  name: string;
  description?: string;
  templateData: {
    header?: any;
    footer?: any;
    styles?: any;
    fields?: any;
  };
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

