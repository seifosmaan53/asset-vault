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
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { UsersService } from './users.service';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Asset Vault is a per-user application: every account owns its own data and there is no
 * team, staff or administrator concept (no invitation flow exists, nothing assigns a role other
 * than OWNER, and organization membership was removed). These routes therefore only ever act on
 * the CALLER'S OWN account. Earlier versions let any signed-in account list, read, modify and
 * delete every other account, because every account is an OWNER and the routes were gated only by
 * @Roles(OWNER, ADMIN).
 *
 * Fields that define identity or privilege (email, role, clerkUserId, password) are not
 * writable here: email and password are managed by Clerk, and role is not user-editable.
 * Profile fields can also be changed through PATCH /auth/profile.
 */
export class UpdateOwnUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  companyName?: string;
}

@ApiTags('users')
@Controller('users')
@UseGuards(ClerkAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** Returns the caller's own account only (kept as an array for client compatibility). */
  @Get()
  async findAll(@Request() req) {
    const me = await this.usersService.findById(req.user.userId);
    return me ? [me] : [];
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req) {
    // The id in the URL is never proof of access. Another account's id gets the same answer as an
    // id that does not exist, so account ids cannot be probed.
    if (id !== req.user.userId) {
      throw new NotFoundException('User not found');
    }
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  @Post()
  create() {
    // Accounts are created by the Clerk sign-up flow (webhook / first authenticated request).
    throw new BadRequestException(
      'User creation is handled by Clerk. Please use the sign-up flow.',
    );
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateOwnUserDto,
    @Request() req,
  ) {
    if (id !== req.user.userId) {
      throw new NotFoundException('User not found');
    }
    // Build the update from an explicit allow-list; never spread the request body into the update.
    const data: { name?: string; companyName?: string } = {};
    if (updateDto.name !== undefined) data.name = updateDto.name.trim();
    if (updateDto.companyName !== undefined) {
      data.companyName = updateDto.companyName.trim();
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No updatable fields supplied');
    }
    return this.usersService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    if (id !== req.user.userId) {
      throw new NotFoundException('User not found');
    }
    // Deleting an account removes the identity row and (via foreign keys) is not supported while
    // data exists; account deletion is a product decision handled through Clerk, not this route.
    throw new ForbiddenException(
      'Account deletion is not available through this endpoint.',
    );
  }
}
