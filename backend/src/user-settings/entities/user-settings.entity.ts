import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('user_settings')
@Index(['userId'], { unique: true })
export class UserSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @OneToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true, default: 'INV-{YYYY}-{NUM}' })
  invoiceNumberFormat: string;

  @Column({ default: 'USD' })
  defaultCurrency: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  defaultTaxRate: number;

  @Column({ nullable: true })
  companyName: string;

  @Column({ type: 'text', nullable: true })
  companyAddress: string;

  @Column({ nullable: true })
  companyPhone: string;

  @Column({ nullable: true })
  companyEmail: string;

  @Column({ nullable: true })
  companyWebsite: string;

  @Column({ nullable: true, type: 'text' })
  companyLogo: string;

  @Column({ nullable: true })
  companyTaxId: string;

  @Column({ nullable: true })
  companyRegistrationNumber: string;

  @Column({ nullable: true })
  companyVatNumber: string;

  // Invoice Defaults
  @Column({ type: 'int', default: 30 })
  defaultPaymentTermsDays: number;

  @Column({ nullable: true, type: 'text' })
  defaultInvoiceNotes: string;

  @Column({ nullable: true, type: 'text' })
  defaultInvoiceTerms: string;

  @Column({ default: true })
  autoGenerateInvoiceNumber: boolean;

  @Column({ default: true })
  showInvoiceNumberOnPDF: boolean;

  @Column({ default: true })
  showPaymentInstructions: boolean;

  @Column({ nullable: true, type: 'text' })
  invoiceFooterText: string;

  // Date & Time Formats
  @Column({ default: 'MM/DD/YYYY' })
  dateFormat: string;

  @Column({ default: '12' })
  timeFormat: string; // '12' or '24'

  @Column({ default: 'America/New_York' })
  timezone: string;

  // Number & Currency Formats
  @Column({ default: '.' })
  decimalSeparator: string;

  @Column({ default: ',' })
  thousandsSeparator: string;

  @Column({ default: 'left' })
  currencySymbolPosition: string; // 'left' or 'right'

  @Column({ default: true })
  showCurrencySymbol: boolean;

  // Tax Settings
  @Column({ default: false })
  taxInclusive: boolean;

  @Column({ nullable: true, type: 'text' })
  taxRegistrationNumber: string;

  // Inventory Defaults
  @Column({ default: 0 })
  defaultReorderLevel: number;

  @Column({ nullable: true })
  defaultInventoryUnit: string;

  @Column({ default: true })
  trackInventory: boolean;

  @Column({ default: true })
  allowNegativeStock: boolean;

  @Column({ default: false })
  autoReorderEnabled: boolean;

  @Column({ type: 'int', default: 10 })
  stockAlertThreshold: number;

  // Email/SMTP Settings
  @Column({ nullable: true })
  smtpHost: string;

  @Column({ nullable: true, type: 'int' })
  smtpPort: number;

  @Column({ default: false })
  smtpSecure: boolean;

  @Column({ nullable: true })
  smtpUser: string;

  @Column({ nullable: true })
  smtpPassword: string;

  @Column({ nullable: true })
  emailFromName: string;

  @Column({ nullable: true })
  emailFromAddress: string;

  // Notification Settings
  @Column({ default: true })
  emailInvoiceSent: boolean;

  @Column({ default: true })
  emailInvoicePaid: boolean;

  @Column({ default: true })
  emailInvoiceOverdue: boolean;

  @Column({ default: true })
  emailLowStockAlert: boolean;

  @Column({ default: true })
  emailInvoiceReminder: boolean;

  @Column({ default: true })
  emailWeeklyReport: boolean;

  @Column({ default: true })
  emailMonthlyReport: boolean;

  // UI/Display Settings
  @Column({ default: 'light' })
  theme: string; // 'light' or 'dark'

  @Column({ default: 10 })
  itemsPerPage: number;

  @Column({ default: 'en' })
  language: string;

  @Column({ nullable: true })
  primaryColor: string;

  @Column({ nullable: true })
  secondaryColor: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

