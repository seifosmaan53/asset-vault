import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { StockMovement } from './stock-movement.entity';

@Entity('inventory_items')
export class InventoryItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ unique: true })
  sku: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  category: string;

  @Column()
  unit: string;

  @Column({ nullable: true })
  barcode: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  costPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  defaultUnitPrice: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  defaultTaxRate: number;

  @Column({ type: 'int', default: 0 })
  currentStock: number;

  @Column({ type: 'int', default: 0 })
  reservedStock: number;

  @Column({ type: 'int', default: 0 })
  reorderLevel: number;

  @Column({ type: 'int', nullable: true })
  maxStockLevel: number;

  @Column({ type: 'varchar', default: 'active' })
  status: 'active' | 'inactive';

  @OneToMany(() => StockMovement, (movement) => movement.inventoryItem)
  movements: StockMovement[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

