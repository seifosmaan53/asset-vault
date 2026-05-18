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

@Entity('store_item_settings')
@Index(['storeId', 'inventoryItemId'], { unique: true })
export class StoreItemSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  storeId: string;

  @ManyToOne(() => Store, (store) => store.itemSettings)
  @JoinColumn({ name: 'storeId' })
  store: Store;

  @Column()
  inventoryItemId: string;

  @ManyToOne(() => InventoryItem)
  @JoinColumn({ name: 'inventoryItemId' })
  inventoryItem: InventoryItem;

  @Column({ type: 'int', default: 0 })
  currentStock: number;

  @Column({ type: 'int', default: 0 })
  minQty: number;

  @Column({ type: 'int', nullable: true })
  targetQty: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  weeklyUsage: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

