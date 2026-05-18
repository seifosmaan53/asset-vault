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
} from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto, UpdateApiKeyDto } from './dto';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
@Controller('api-keys')
@UseGuards(ClerkAuthGuard)
@Roles(UserRole.ADMIN, UserRole.OWNER)
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get()
  findAll(@Request() req) {
    return this.apiKeysService.findAll(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.apiKeysService.findOne(id, req.user.userId);
  }

  @Post()
  create(@Body() createDto: CreateApiKeyDto, @Request() req) {
    try {
      const result = this.apiKeysService.create(req.user.userId, createDto);
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdateApiKeyDto, @Request() req) {
    try {
      const result = this.apiKeysService.update(id, req.user.userId, updateDto);
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.apiKeysService.remove(id, req.user.userId);
  }

  @Get(':id/usage')
  getUsage(@Param('id') id: string, @Request() req) {
    return this.apiKeysService.findOne(id, req.user.userId);
  }
}

