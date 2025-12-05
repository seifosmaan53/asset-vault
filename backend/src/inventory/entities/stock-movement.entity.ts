import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { InventoryItem } from './inventory-item.entity';
import { User } from '../../users/entities/user.entity';

@Entity('stock_movements')
export class StockMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  inventoryItemId: string;

  @ManyToOne(() => InventoryItem, (item) => item.movements)
  @JoinColumn({ name: 'inventoryItemId' })
  inventoryItem: InventoryItem;

  @Column({ type: 'varchar' })
  type: 'purchase' | 'sale' | 'adjustment';

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'varchar' })
  sourceType: 'invoice' | 'manual' | 'import';

  @Column({ nullable: true })
  sourceId: string;

  @Column({ type: 'text', nullable: true })
  note: string;

  @CreateDateColumn()
  createdAt: Date;
}

