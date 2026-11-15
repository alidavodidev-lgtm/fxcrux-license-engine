import { Controller, Post, Get, Body, Param, UseGuards, Request, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { unlink } from 'fs/promises';
import { TicketsService } from './tickets.service';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CreateTicketGroupDto } from './dto/create-ticket-group.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ReplyTicketDto } from './dto/reply-ticket.dto';
import { CloseTicketDto } from './dto/close-ticket.dto';
import { ReassignTicketGroupDto } from './dto/reassign-ticket-group.dto';
import { SetGroupAdminsDto } from './dto/set-group-admins.dto';
import { imageUploadOptions } from '../common/upload/image-upload.options';
import { publicUploadUrl } from '../common/upload/upload-url.util';
import { SettingsService } from '../settings/settings.service';

// Generous hard ceiling for multer itself - the real, admin-configurable
// limit is enforced after upload via SettingsService (see the two upload
// handlers below), since FileInterceptor's own limits.fileSize is fixed at
// decoration time and can't read a live DB value per request.
const TICKET_IMAGE_HARD_CAP_BYTES = 5 * 1024 * 1024;

@Controller('tickets')
export class TicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly configService: ConfigService,
    private readonly settingsService: SettingsService,
  ) {}

  // --- User-facing ---

  @UseGuards(AuthGuard('jwt'))
  @Get('groups')
  async getGroups() {
    return this.ticketsService.getActiveGroups();
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('create')
  async createTicket(@Request() req, @Body() body: CreateTicketDto) {
    return this.ticketsService.createTicket(req.user.userId, body.groupId, body.subject, body.message, body.imageUrl);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('upload')
  @UseInterceptors(FileInterceptor('image', imageUploadOptions('tickets', TICKET_IMAGE_HARD_CAP_BYTES)))
  async uploadUserAttachment(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Image file is required');
    const { ticketAttachmentMaxBytes } = await this.settingsService.getUploadLimits();
    if (file.size > ticketAttachmentMaxBytes) {
      await unlink(file.path).catch(() => {});
      throw new BadRequestException(`Image must be under ${Math.floor(ticketAttachmentMaxBytes / 1024)}KB`);
    }
    return { url: publicUploadUrl(this.configService, 'tickets', file.filename) };
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('my-tickets')
  async getMyTickets(@Request() req) {
    return this.ticketsService.getUserTickets(req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('thread')
  async getThread(@Request() req, @Body('ticketId') ticketId: string) {
    return this.ticketsService.getTicketThread(ticketId, { type: 'USER', id: req.user.userId });
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('reply')
  async reply(@Request() req, @Body() body: ReplyTicketDto) {
    return this.ticketsService.replyToTicket(body.ticketId, body.message, {
      type: 'USER',
      id: req.user.userId,
    }, body.imageUrl);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('close')
  async close(@Request() req, @Body() body: CloseTicketDto) {
    return this.ticketsService.closeTicket(body.ticketId, 'USER', req.user.userId, body.rating);
  }

  // --- Admin-facing ---

  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('tickets')
  @Get('admin/list')
  async getAdminTickets(@Request() req) {
    return this.ticketsService.getAdminTickets(req.admin);
  }

  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('tickets')
  @Post('admin/thread')
  async getAdminThread(@Request() req, @Body('ticketId') ticketId: string) {
    return this.ticketsService.getTicketThread(ticketId, { type: 'ADMIN', id: req.admin.id, admin: req.admin });
  }

  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('tickets')
  @Post('admin/reply')
  async adminReply(@Request() req, @Body() body: ReplyTicketDto) {
    return this.ticketsService.replyToTicket(body.ticketId, body.message, {
      type: 'ADMIN',
      id: req.admin.id,
      name: req.admin.username,
      admin: req.admin,
    }, body.imageUrl);
  }

  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('tickets')
  @Post('admin/upload')
  @UseInterceptors(FileInterceptor('image', imageUploadOptions('tickets', TICKET_IMAGE_HARD_CAP_BYTES)))
  async uploadAdminAttachment(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Image file is required');
    const { ticketAttachmentMaxBytes } = await this.settingsService.getUploadLimits();
    if (file.size > ticketAttachmentMaxBytes) {
      await unlink(file.path).catch(() => {});
      throw new BadRequestException(`Image must be under ${Math.floor(ticketAttachmentMaxBytes / 1024)}KB`);
    }
    return { url: publicUploadUrl(this.configService, 'tickets', file.filename) };
  }

  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('tickets')
  @Post('admin/close')
  async adminClose(@Request() req, @Body('ticketId') ticketId: string) {
    return this.ticketsService.closeTicket(ticketId, 'ADMIN', req.admin.id);
  }

  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('tickets')
  @Get('admin/groups')
  async getAdminGroups() {
    return this.ticketsService.getAllGroups();
  }

  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('tickets')
  @Post('admin/reassign-group')
  async reassignGroup(@Request() req, @Body() body: ReassignTicketGroupDto) {
    return this.ticketsService.reassignTicketGroup(body.ticketId, body.groupId, req.admin);
  }

  @UseGuards(AdminAuthGuard, SuperAdminGuard)
  @Post('admin/groups/create')
  async createGroup(@Request() req, @Body() body: CreateTicketGroupDto) {
    return this.ticketsService.createGroup(body, req.admin);
  }

  @UseGuards(AdminAuthGuard, SuperAdminGuard)
  @Post('admin/groups/toggle')
  async toggleGroup(@Request() req, @Body('groupId') groupId: string) {
    return this.ticketsService.toggleGroupActive(groupId, req.admin);
  }

  @UseGuards(AdminAuthGuard, SuperAdminGuard)
  @Get('admin/groups/:groupId/admins')
  async getGroupAdminAccess(@Param('groupId') groupId: string) {
    return this.ticketsService.getGroupAdminAccess(groupId);
  }

  @UseGuards(AdminAuthGuard, SuperAdminGuard)
  @Post('admin/groups/assign-admins')
  async setGroupAdminAccess(@Request() req, @Body() body: SetGroupAdminsDto) {
    return this.ticketsService.setGroupAdminAccess(body.groupId, body.adminIds, req.admin);
  }

  @UseGuards(AdminAuthGuard, SuperAdminGuard)
  @Get('admin/rating-stats')
  async getRatingStats() {
    return this.ticketsService.getAdminRatingStats();
  }
}
