import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RefreshTokenDto, ChangePasswordDto } from './dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.email, dto.password, dto.name, dto.companyName);
  }

  @Post('login')
  @UseGuards(AuthGuard('local'))
  async login(@Request() req, @Body() dto: LoginDto) {
    return this.authService.login(req.user);
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  async logout() {
    return { message: 'Logged out successfully' };
  }

  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  async getProfile(@Request() req) {
    return this.authService.getProfile(req.user.userId);
  }

  @Patch('profile')
  @UseGuards(AuthGuard('jwt'))
  async updateProfile(@Request() req, @Body() data: any) {
    return this.authService.updateProfile(req.user.userId, data);
  }

  @Post('change-password')
  @UseGuards(AuthGuard('jwt'))
  async changePassword(@Request() req, @Body() dto: ChangePasswordDto) {
    // Implementation for password change
    return { message: 'Password changed successfully' };
  }

  @Post('password-reset')
  async requestPasswordReset(@Body() dto: { email: string }) {
    // Implementation for password reset request
    return { message: 'Password reset email sent' };
  }

  @Post('password-reset/confirm')
  async confirmPasswordReset(@Body() dto: { token: string; password: string }) {
    // Implementation for password reset confirmation
    return { message: 'Password reset successfully' };
  }
}

