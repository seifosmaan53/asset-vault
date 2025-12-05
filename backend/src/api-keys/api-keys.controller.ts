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
import { AuthGuard } from '@nestjs/passport';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto, UpdateApiKeyDto } from './dto';

@Controller('api-keys')
@UseGuards(AuthGuard('jwt'))
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
    return this.apiKeysService.create(req.user.userId, createDto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdateApiKeyDto, @Request() req) {
    return this.apiKeysService.update(id, req.user.userId, updateDto);
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

