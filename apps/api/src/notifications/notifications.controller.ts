import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NotificationsService } from './notifications.service';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // --- User-facing ---

  @UseGuards(AuthGuard('jwt'))
  @Get()
  async getMine(@Request() req) {
    return this.notificationsService.getMyNotifications('USER', req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('unread-count')
  async unreadCount(@Request() req) {
    return this.notificationsService.getUnreadCount('USER', req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/read')
  async markRead(@Request() req, @Param('id') id: string) {
    return this.notificationsService.markRead(id, 'USER', req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('mark-all-read')
  async markAllRead(@Request() req) {
    return this.notificationsService.markAllRead('USER', req.user.userId);
  }

  // --- Admin-facing ---

  @UseGuards(AdminAuthGuard)
  @Get('admin')
  async getMineAdmin(@Request() req) {
    return this.notificationsService.getMyNotifications('ADMIN', req.admin.id);
  }

  @UseGuards(AdminAuthGuard)
  @Get('admin/unread-count')
  async unreadCountAdmin(@Request() req) {
    return this.notificationsService.getUnreadCount('ADMIN', req.admin.id);
  }

  @UseGuards(AdminAuthGuard)
  @Post('admin/:id/read')
  async markReadAdmin(@Request() req, @Param('id') id: string) {
    return this.notificationsService.markRead(id, 'ADMIN', req.admin.id);
  }

  @UseGuards(AdminAuthGuard)
  @Post('admin/mark-all-read')
  async markAllReadAdmin(@Request() req) {
    return this.notificationsService.markAllRead('ADMIN', req.admin.id);
  }
}
