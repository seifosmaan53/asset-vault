import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Client } from '../../clients/entities/client.entity';
import { Store } from '../../inventory/entities/store.entity';
import { InvoiceItem } from './invoice-item.entity';

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  clientId: string;

  // Issue #46: Explicit cascade rules for relationships
  @ManyToOne(() => Client, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column({ nullable: true })
  storeId?: string;

  @ManyToOne(() => Store, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'storeId' })
  store?: Store;

  @Column({ type: 'varchar' })
  type: 'invoice' | 'estimate';

  @Column()
  number: string;

  @Column({ type: 'varchar' })
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

  @Column({ type: 'date' })
  issueDate: Date;

  @Column({ type: 'date', nullable: true })
  dueDate: Date;

  @Column({ default: 'USD' })
  currency: string;

  @Column({ type: 'decimal', precision: 12, scale: 4, default: 0 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 4, default: 0 })
  taxTotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 4, default: 0 })
  discountTotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 4, default: 0 })
  total: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'jsonb', nullable: true })
  metadataJson: any;

  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date;

  @Column({ type: 'text', nullable: true })
  paymentMethodNote: string;

  @Column({ type: 'varchar', nullable: true })
  paymentMethod: 'cash' | 'card' | 'bank_transfer' | 'check' | 'paypal' | 'stripe' | 'other' | null;

  @Column({ type: 'decimal', precision: 12, scale: 4, nullable: true, default: 0 })
  amountPaid: number; // For partial payments

  @Column({ type: 'timestamp', nullable: true })
  lastReminderSentAt: Date;

  @OneToMany(() => InvoiceItem, (item) => item.invoice, { cascade: true })
  items: InvoiceItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}

