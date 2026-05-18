import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { StockMovement } from './stock-movement.entity';

@Entity('inventory_items')
@Index(['userId', 'sku'], { unique: true })
export class InventoryItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  sku: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column()
  unit: string;

  @Column({ nullable: true })
  barcode: string;

  @Column({ type: 'decimal', precision: 12, scale: 4, nullable: true })
  costPrice: number;

  @Column({ type: 'decimal', precision: 12, scale: 4 })
  defaultUnitPrice: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  defaultTaxRate: number;

  @Column({ type: 'int', default: 0 })
  currentStock: number;

  @Column({ type: 'int', default: 0 })
  reorderLevel: number;

  @Column({ type: 'int', nullable: true })
  maxStockLevel: number;

  @Column({ type: 'varchar', default: 'active' })
  status: 'active' | 'inactive';

  // Bundle / Pack Information
  @Column({ type: 'int', nullable: true })
  bundleSize: number;

  @Column({ nullable: true })
  bundleUnit: string;

  // Space / Container Planning
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  spacePerBundle: number;

  @Column({ type: 'int', nullable: true })
  bundlesPerContainer: number;

  @Column({ type: 'int', nullable: true })
  targetBundles: number;

  // Pack Size (units per bundle/case)
  @Column({ type: 'int', nullable: true })
  packSize: number;

  // Container Planning
  @Column({ type: 'int', nullable: true })
  unitsPerContainer: number;

  // Planning Fields
  @Column({ type: 'int', nullable: true })
  weeksSupplyTargetOverride: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  averageWeeklyUsage: number;

  @OneToMany(() => StockMovement, (movement) => movement.inventoryItem)
  movements: StockMovement[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

