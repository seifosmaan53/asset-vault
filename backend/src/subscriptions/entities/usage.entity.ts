// Copyright (c) 2025 Asset Vault. All rights reserved.

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum UsageMetric {
  INVOICES_CREATED = 'invoices_created',
  CLIENTS_CREATED = 'clients_created',
  INVENTORY_ITEMS_CREATED = 'inventory_items_created',
  STORAGE_USED_MB = 'storage_used_mb',
  API_REQUESTS = 'api_requests',
}

@Entity('usage_tracking')
@Index(['userId', 'metric', 'periodStart'], { unique: true })
@Index(['userId'])
@Index(['metric'])
export class Usage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'enum',
    enum: UsageMetric,
  })
  metric: UsageMetric;

  @Column({ type: 'int', default: 0 })
  count: number;

  @Column({ type: 'date' })
  periodStart: Date;

  @Column({ type: 'date' })
  periodEnd: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

