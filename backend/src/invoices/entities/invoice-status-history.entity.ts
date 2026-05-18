// Copyright (c) 2025 Asset Vault. All rights reserved.

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Invoice } from './invoice.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Invoice Status History Entity
 * Tracks all status changes for audit trail and compliance
 */
@Entity('invoice_status_history')
@Index('idx_invoice_status_history_invoice_id', ['invoiceId'])
@Index('idx_invoice_status_history_user_id', ['userId'])
export class InvoiceStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  invoiceId: string;

  @ManyToOne(() => Invoice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoiceId' })
  invoice: Invoice;

  @Column({ type: 'varchar' })
  fromStatus: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

  @Column({ type: 'varchar' })
  toStatus: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

  @Column()
  userId: string; // Who made the change

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'text', nullable: true })
  note: string; // Optional note explaining the status change
}

