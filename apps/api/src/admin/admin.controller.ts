import { Controller, Post, Get, Body, UseGuards, Request, Ip } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AdminService } from './admin.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminChangePasswordDto } from './dto/admin-change-password.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminPermissionsDto } from './dto/update-admin-permissions.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  async login(@Body() body: AdminLoginDto, @Ip() ip: string) {
    return this.adminService.login(body.username, body.password, ip);
  }

  @UseGuards(AdminAuthGuard)
  @Post('change-password')
  async changePassword(@Request() req, @Body() body: AdminChangePasswordDto) {
    return this.adminService.changePassword(req.admin.id, body.oldPassword, body.newPassword);
  }

  @UseGuards(AdminAuthGuard)
  @Get('me')
  async getSelf(@Request() req) {
    return this.adminService.getSelf(req.admin.id);
  }

  @UseGuards(AdminAuthGuard, SuperAdminGuard)
  @Get('admins/list')
  async listAdmins() {
    return this.adminService.listAdmins();
  }

  @UseGuards(AdminAuthGuard, SuperAdminGuard)
  @Post('admins/create')
  async createAdmin(@Request() req, @Body() body: CreateAdminDto) {
    return this.adminService.createAdmin(body, req.admin);
  }

  @UseGuards(AdminAuthGuard, SuperAdminGuard)
  @Post('admins/update-permissions')
  async updatePermissions(@Request() req, @Body() body: UpdateAdminPermissionsDto) {
    return this.adminService.updatePermissions(body, req.admin);
  }

  @UseGuards(AdminAuthGuard, SuperAdminGuard)
  @Post('admins/toggle-status')
  async toggleAdminStatus(@Request() req, @Body('adminId') adminId: string) {
    return this.adminService.toggleAdminActive(adminId, req.admin.id, req.admin.username);
  }

  @UseGuards(AdminAuthGuard, SuperAdminGuard)
  @Post('admins/update')
  async updateAdmin(@Request() req, @Body() body: UpdateAdminDto) {
    return this.adminService.updateAdmin(body.adminId, { username: body.username, password: body.password }, req.admin);
  }

  @UseGuards(AdminAuthGuard, SuperAdminGuard)
  @Post('admins/promote')
  async promoteAdmin(@Request() req, @Body('adminId') adminId: string) {
    return this.adminService.promoteToSuperAdmin(adminId, req.admin);
  }

  @UseGuards(AdminAuthGuard, SuperAdminGuard)
  @Post('admins/demote')
  async demoteAdmin(@Request() req, @Body('adminId') adminId: string) {
    return this.adminService.demoteFromSuperAdmin(adminId, req.admin);
  }
}
