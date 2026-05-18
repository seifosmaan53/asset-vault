import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationsService } from './organizations.service';
import { OrganizationsController } from './organizations.controller';
import { OrganizationContextGuard } from './organization-context.guard';
import { Organization } from './entities/organization.entity';
import { UserOrganization } from './entities/user-organization.entity';
import { User } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';

@Global() // Make OrganizationsModule global so OrganizationsService is available to globally provided guards
@Module({
  imports: [
    TypeOrmModule.forFeature([Organization, UserOrganization, User]),
    UsersModule,
  ],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrganizationContextGuard],
  exports: [OrganizationsService, OrganizationContextGuard],
})
export class OrganizationsModule {}

