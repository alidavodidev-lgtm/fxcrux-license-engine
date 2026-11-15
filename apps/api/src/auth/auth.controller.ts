import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthRegisterDto } from './dto/auth-register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('hardware-login')
  async hardwareLogin(
    @Body('payload') payload: string,
    @Body('key') key: string,
    @Body('iv') iv: string,
  ) {
    return this.authService.hardwareLogin(payload, key, iv);
  }

  @Post('register')
  async register(@Body() body: AuthRegisterDto) {
    return this.authService.register(body.email, body.username, body.password);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('status')
  async checkStatus(@Request() req) {
    return this.authService.checkHardwareStatus(req.user.userId);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  async login(@Body() body: LoginDto) {
    return this.authService.login(body.username, body.password, body.rememberMe);
  }
}