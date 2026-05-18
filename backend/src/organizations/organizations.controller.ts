import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { OrganizationsService } from './organizations.service';
import { OrganizationRole } from './entities/organization-role.enum';
import { OrganizationOptional } from './organization-optional.decorator';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

interface CreateOrganizationDto {
  name: string;
  companyName?: string;
}

interface UpdateOrganizationDto {
  name?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  website?: string;
  logo?: string;
  branding?: {
    primaryColor?: string;
    secondaryColor?: string;
    customDomain?: string;
  };
  settings?: {
    currency?: string;
    timezone?: string;
    dateFormat?: string;
    invoicePrefix?: string;
    taxEnabled?: boolean;
    defaultTaxRate?: number;
  };
}

interface AddUserToOrganizationDto {
  userId: string;
  role: OrganizationRole;
}

interface UpdateUserRoleDto {
  role: OrganizationRole;
}

@Controller('organizations')
@UseGuards(ClerkAuthGuard)
@OrganizationOptional()
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  async create(@Request() req, @Body() dto: CreateOrganizationDto) {
    try {
      const result = await this.organizationsService.create(dto.name, req.user.userId, dto.companyName);
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Get()
  async findAll(@Request() req) {
    return this.organizationsService.findAll(req.user.userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req) {
    return this.organizationsService.findOne(id, req.user.userId);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER) // FIX Issue #44: Only ADMIN/OWNER can update organizations
  async update(@Param('id') id: string, @Request() req, @Body() dto: UpdateOrganizationDto) {
    try {
      const result = await this.organizationsService.update(id, req.user.userId, dto);
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Delete(':id')
  @Roles(UserRole.OWNER) // FIX Issue #44: Only OWNER can delete organizations
  async remove(@Param('id') id: string, @Request() req) {
    await this.organizationsService.delete(id, req.user.userId);
    return { message: 'Organization deleted successfully' };
  }

  @Get(':id/users')
  @Roles(UserRole.ADMIN, UserRole.OWNER) // FIX Issue #44: Only ADMIN/OWNER can view organization users
  async getUsers(@Param('id') id: string, @Request() req) {
    return this.organizationsService.getOrganizationUsers(id, req.user.userId);
  }

  @Post(':id/users')
  @Roles(UserRole.ADMIN, UserRole.OWNER) // FIX Issue #44: Only ADMIN/OWNER can add users to organizations
  async addUser(@Param('id') id: string, @Request() req, @Body() dto: AddUserToOrganizationDto) {
    try {
      const result = await this.organizationsService.addUserToOrganization(id, dto.userId, dto.role, req.user.userId);
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Patch(':id/users/:userId/role')
  @Roles(UserRole.ADMIN, UserRole.OWNER) // FIX Issue #44: Only ADMIN/OWNER can update user roles in organizations
  async updateUserRole(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Request() req,
    @Body() dto: UpdateUserRoleDto,
  ) {
    try {
      const result = await this.organizationsService.updateUserRole(id, userId, dto.role, req.user.userId);
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Delete(':id/users/:userId')
  @Roles(UserRole.ADMIN, UserRole.OWNER) // FIX Issue #44: Only ADMIN/OWNER can remove users from organizations
  async removeUser(@Param('id') id: string, @Param('userId') userId: string, @Request() req) {
    await this.organizationsService.removeUserFromOrganization(id, userId, req.user.userId);
    return { message: 'User removed from organization successfully' };
  }

  @Get('user/my-organizations')
  async getMyOrganizations(@Request() req) {
    // Ensure user has an organization (creates one if missing)
    // This handles edge cases where guard didn't create it or webhook failed
    await this.organizationsService.ensureUserHasOrganization(req.user.userId);
    
    // Return user's organizations
    return this.organizationsService.getUserOrganizations(req.user.userId);
  }
}

