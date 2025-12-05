import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Client } from '../../clients/entities/client.entity';

@Entity('recurring_invoices')
export class RecurringInvoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  clientId: string;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column()
  name: string;

  @Column({ type: 'varchar' })
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

  @Column({ type: 'int' })
  interval: number;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date', nullable: true })
  endDate: Date;

  @Column({ type: 'date' })
  nextRunDate: Date;

  @Column({ default: 'USD' })
  currency: string;

  @Column({ type: 'jsonb' })
  items: Array<{
    inventoryItemId?: string;
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    discountRate: number;
  }>;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  invoicesGenerated: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

