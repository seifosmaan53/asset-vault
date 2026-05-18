import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

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
  variables?: Record<string, string>; // Custom template variables
}

@Entity('invoice_templates')
@Index(['userId', 'deletedAt'])
export class InvoiceTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'jsonb' })
  templateData: TemplateData;

  @Column({ type: 'boolean', default: false })
  isDefault: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date | null;
}
