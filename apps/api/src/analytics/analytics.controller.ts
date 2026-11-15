import { Controller, Get, Param, Query, Res, StreamableFile, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AnalyticsService } from './analytics.service';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

function xlsxHeaders(res: Response, filename: string) {
  res.set({
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${filename}"`,
  });
}

@Controller('analytics')
@UseGuards(AdminAuthGuard, PermissionGuard)
@RequirePermission('reports')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('financial')
  async getFinancialReport(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('groupBy') groupBy?: string,
    @Query('productId') productId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('status') status?: string,
    @Query('tierId') tierId?: string,
  ) {
    return this.analyticsService.getFinancialReport({ from, to, groupBy, productId, categoryId, status, tierId });
  }

  @Get('financial/transactions')
  async getFinancialTransactions(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('productId') productId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('status') status?: string,
    @Query('tierId') tierId?: string,
    @Query('buyerUsername') buyerUsername?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
  ) {
    return this.analyticsService.getFinancialTransactions({
      from, to, productId, categoryId, status, tierId, buyerUsername,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      sortBy, sortDir,
    });
  }

  @Get('financial/by-tier')
  async getFinancialByTier(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('productId') productId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('status') status?: string,
  ) {
    return this.analyticsService.getFinancialByTier({ from, to, productId, categoryId, status });
  }

  @Get('financial/export')
  async exportFinancial(
    @Res({ passthrough: true }) res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('productId') productId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('status') status?: string,
  ) {
    const buffer = await this.analyticsService.exportFinancial({ from, to, productId, categoryId, status });
    xlsxHeaders(res, 'financial-report.xlsx');
    return new StreamableFile(buffer);
  }

  @Get('users/export')
  async exportUsers(
    @Res({ passthrough: true }) res: Response,
    @Query('status') status?: string,
    @Query('hasMachineId') hasMachineId?: string,
    @Query('registeredFrom') registeredFrom?: string,
    @Query('registeredTo') registeredTo?: string,
    @Query('search') search?: string,
  ) {
    const buffer = await this.analyticsService.exportUsers({ status, hasMachineId, registeredFrom, registeredTo, search });
    xlsxHeaders(res, 'users-report.xlsx');
    return new StreamableFile(buffer);
  }

  @Get('users')
  async getUsersReport(
    @Query('status') status?: string,
    @Query('hasMachineId') hasMachineId?: string,
    @Query('registeredFrom') registeredFrom?: string,
    @Query('registeredTo') registeredTo?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
  ) {
    return this.analyticsService.getUsersReport({
      status,
      hasMachineId,
      registeredFrom,
      registeredTo,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      sortBy, sortDir,
    });
  }

  @Get('users/:id/export')
  async exportUserDetail(@Res({ passthrough: true }) res: Response, @Param('id') id: string) {
    const buffer = await this.analyticsService.exportUserDetail(id);
    xlsxHeaders(res, 'user-profile.xlsx');
    return new StreamableFile(buffer);
  }

  @Get('users/:id')
  async getUserDetail(@Param('id') id: string) {
    return this.analyticsService.getUserDetail(id);
  }

  @Get('tickets')
  async getTicketsReport(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('groupBy') groupBy?: string,
    @Query('status') status?: string,
    @Query('groupId') groupId?: string,
    @Query('adminId') adminId?: string,
    @Query('userSearch') userSearch?: string,
  ) {
    return this.analyticsService.getTicketsReport({ from, to, groupBy, status, groupId, adminId, userSearch });
  }

  @Get('tickets/by-day')
  async getTicketsByDay(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
    @Query('groupId') groupId?: string,
    @Query('adminId') adminId?: string,
    @Query('userSearch') userSearch?: string,
  ) {
    return this.analyticsService.getTicketsByDay({ from, to, status, groupId, adminId, userSearch });
  }

  @Get('tickets/day/:date')
  async getTicketsDayDetail(
    @Param('date') date: string,
    @Query('status') status?: string,
    @Query('groupId') groupId?: string,
    @Query('adminId') adminId?: string,
    @Query('userSearch') userSearch?: string,
  ) {
    return this.analyticsService.getTicketsDayDetail(date, { status, groupId, adminId, userSearch });
  }

  @Get('tickets/groups')
  async getTicketFilterGroups() {
    return this.analyticsService.getTicketFilterGroups();
  }

  @Get('tickets/admins')
  async getTicketFilterAdmins() {
    return this.analyticsService.getTicketFilterAdmins();
  }

  @Get('tickets/list')
  async getTicketsList(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
    @Query('groupId') groupId?: string,
    @Query('adminId') adminId?: string,
    @Query('userSearch') userSearch?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
  ) {
    return this.analyticsService.getTicketsList({
      from, to, status, groupId, adminId, userSearch, search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      sortBy, sortDir,
    });
  }

  @Get('tickets/export')
  async exportTickets(
    @Res({ passthrough: true }) res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
    @Query('groupId') groupId?: string,
    @Query('adminId') adminId?: string,
    @Query('userSearch') userSearch?: string,
    @Query('search') search?: string,
  ) {
    const buffer = await this.analyticsService.exportTickets({ from, to, status, groupId, adminId, userSearch, search });
    xlsxHeaders(res, 'tickets-report.xlsx');
    return new StreamableFile(buffer);
  }
}
