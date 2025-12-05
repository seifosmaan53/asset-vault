import { Controller, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserSettingsService } from './user-settings.service';

@Controller('user-settings')
@UseGuards(AuthGuard('jwt'))
export class UserSettingsController {
  constructor(private readonly settingsService: UserSettingsService) {}

  @Get()
  getSettings(@Request() req) {
    return this.settingsService.getSettings(req.user.userId);
  }

  @Patch()
  updateSettings(@Request() req, @Body() data: any) {
    return this.settingsService.updateSettings(req.user.userId, data);
  }
}

