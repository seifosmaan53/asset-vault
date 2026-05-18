import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { User } from '../users/entities/user.entity';
import { RolesGuard } from './roles.guard';
import { ClerkAuthGuard } from './clerk-auth.guard';

@Module({
  imports: [
    UsersModule,
    OrganizationsModule,
    forwardRef(() => SubscriptionsModule),
    TypeOrmModule.forFeature([User]),
  ],
  controllers: [AuthController],
  providers: [AuthService, ClerkAuthGuard, RolesGuard],
  exports: [AuthService, ClerkAuthGuard, RolesGuard],
})
export class AuthModule {}

