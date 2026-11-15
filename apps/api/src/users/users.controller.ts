import { Controller, Post, Body, ValidationPipe, Get, UseGuards, Request, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AuthGuard } from '@nestjs/passport';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  async register(@Body(ValidationPipe) createUserDto: CreateUserDto) {
    return this.usersService.register(createUserDto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  getProfile(@Request() req) {
    return req.user;
  }

  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('users')
  @Post('update')
  async updateUser(@Request() req, @Body() body: UpdateUserDto) {
    const { id, ...updateData } = body;
    return this.usersService.updateUser(id, updateData, req.admin);
  }

  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('users')
  @Post('toggle-status')
  async toggleUserStatus(@Request() req, @Body('userId') userId: string) {
    // Calling the service instead of repository directly
    const user = await this.usersService.toggleStatus(userId, req.admin);

    return {
      message: `User status changed to ${user.status}`,
      status: user.status
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('change-password')
  async changeUserPassword(@Request() req, @Body() body: ChangePasswordDto) {
    await this.usersService.changePassword(req.user.userId, body.newPass);
    return { success: true };
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('me')
  async getMyProfile(@Request() req) {
    return this.usersService.getProfile(req.user.userId);
  }

  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('users')
  @Get('list')
  async getAllUsers() {
    return this.usersService.findAllUsers();
  }
}