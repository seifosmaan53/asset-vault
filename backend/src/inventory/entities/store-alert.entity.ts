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
import { Store } from './store.entity';
import { InventoryItem } from './inventory-item.entity';
import { User } from '../../users/entities/user.entity';

@Entity('store_alerts')
@Index(['userId', 'resolved'])
@Index(['storeId', 'resolved'])
@Index(['inventoryItemId', 'resolved'])
export class StoreAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  storeId: string;

  @ManyToOne(() => Store)
  @JoinColumn({ name: 'storeId' })
  store: Store;

  @Column()
  inventoryItemId: string;

  @ManyToOne(() => InventoryItem)
  @JoinColumn({ name: 'inventoryItemId' })
  inventoryItem: InventoryItem;

  @Column({ type: 'varchar' })
  alertType: 'low_stock' | 'out_of_stock';

  @Column({ type: 'int' })
  currentStock: number;

  @Column({ type: 'int' })
  minQty: number;

  @Column({ default: false })
  resolved: boolean;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

