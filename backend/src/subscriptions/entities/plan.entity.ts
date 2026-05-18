// Copyright (c) 2025 Asset Vault. All rights reserved.

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('plans')
export class Plan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ default: 'monthly' })
  billingCycle: 'monthly' | 'yearly';

  @Column({ type: 'jsonb', nullable: true })
  features: {
    maxInvoices?: number;
    maxClients?: number;
    maxInventoryItems?: number;
    maxStorageGB?: number;
    advancedAnalytics?: boolean;
    apiAccess?: boolean;
    whiteLabel?: boolean;
    [key: string]: any;
  };

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

