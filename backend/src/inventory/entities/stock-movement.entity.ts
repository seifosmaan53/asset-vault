import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { InventoryItem } from './inventory-item.entity';
import { Store } from './store.entity';
import { User } from '../../users/entities/user.entity';
import { InvoiceItem } from '../../invoices/entities/invoice-item.entity';

@Entity('stock_movements')
@Index(['inventoryItemId'])
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

  @Column({ nullable: true })
  storeId?: string;

  @ManyToOne(() => Store)
  @JoinColumn({ name: 'storeId' })
  store?: Store;

  /**
   * Optional link to the specific invoice line item that caused this movement.
   * This is the strongest link for auditing because invoice line items can be
   * traced back to the invoice, client, etc.
   */
  @Column({ nullable: true })
  invoiceItemId?: string;

  @ManyToOne(() => InvoiceItem, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'invoiceItemId' })
  invoiceItem?: InvoiceItem;

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

