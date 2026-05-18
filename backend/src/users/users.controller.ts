import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { UsersService } from './users.service';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from './entities/user.entity';

interface CreateUserDto {
  email: string;
  password: string;
  name: string;
  companyName?: string;
  role: UserRole;
}

interface UpdateUserDto {
  email?: string;
  name?: string;
  companyName?: string;
  role?: UserRole;
  password?: string;
}

@Controller('users')
@UseGuards(ClerkAuthGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN) // Allow both OWNER and ADMIN to see user list
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll(@Request() req) {
    const users = await this.usersService.findAll();
    return users;
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req) {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    return user;
  }

  @Post()
  async create(@Body() createDto: CreateUserDto, @Request() req) {
    // Note: User creation is now handled by Clerk webhooks
    // This endpoint is kept for backward compatibility but should not be used
    // Users should be created through Clerk sign-up flow
    throw new BadRequestException('User creation is now handled by Clerk. Please use the sign-up flow.');
  }

  @Patch(':id')
  @Roles(UserRole.OWNER) // FIX Issue #44: Only OWNER can update users
  async update(@Param('id') id: string, @Body() updateDto: UpdateUserDto, @Request() req) {
    try {
      if (updateDto.email) {
        const existingUser = await this.usersService.findByEmail(updateDto.email);
        if (existingUser && existingUser.id !== id) {
          throw new BadRequestException('User with this email already exists');
        }
      }

      // Remove password from update - Clerk handles password management
      const updateData: any = { ...updateDto };
      delete updateData.password;

      const user = await this.usersService.update(id, updateData);
      return user;
    } catch (error: any) {
      throw error;
    }
  }

  @Delete(':id')
  @Roles(UserRole.OWNER) // FIX Issue #44: Only OWNER can delete users
  async remove(@Param('id') id: string, @Request() req) {
    // Prevent deleting yourself
    if (id === req.user.userId) {
      throw new BadRequestException('Cannot delete your own account');
    }

    const user = await this.usersService.findById(id);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Prevent deleting the last owner
    if (user.role === UserRole.OWNER) {
      const owners = await this.usersService.findAll();
      const ownerCount = owners.filter((u) => u.role === UserRole.OWNER).length;
      if (ownerCount <= 1) {
        throw new BadRequestException('Cannot delete the last owner');
      }
    }

    await this.usersService.delete(id);
    return { message: 'User deleted successfully' };
  }
}

