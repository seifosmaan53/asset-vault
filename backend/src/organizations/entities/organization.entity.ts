import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { UserOrganization } from './user-organization.entity';
export { OrganizationRole } from './organization-role.enum';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  companyName: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  state: string;

  @Column({ nullable: true })
  zip: string;

  @Column({ nullable: true })
  country: string;

  @Column({ nullable: true })
  website: string;

  @Column({ nullable: true })
  logo: string;

  @Column({ type: 'jsonb', nullable: true })
  branding: {
    primaryColor?: string;
    secondaryColor?: string;
    customDomain?: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  settings: {
    currency?: string;
    timezone?: string;
    dateFormat?: string;
    invoicePrefix?: string;
    taxEnabled?: boolean;
    defaultTaxRate?: number;
  };

  @OneToMany(() => UserOrganization, (userOrg) => userOrg.organization)
  userOrganizations: UserOrganization[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

