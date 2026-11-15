import { Controller, Post, Body, HttpCode, HttpStatus, NotFoundException, UnauthorizedException, Ip, Get, UseGuards, Request } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { LicensesService } from './licenses.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Product } from '../products/product.entity';
import { AuthGuard } from '@nestjs/passport';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { RsaHybridService } from '../common/crypto/rsa-hybrid.service';
import { ValidateLicenseDto } from './dto/validate-license.dto';
import { IssueLicenseDto } from './dto/issue-license.dto';
import { IssueManualLicenseDto } from './dto/issue-manual-license.dto';
import { UpdateLicenseDateDto } from './dto/update-license-date.dto';

@Controller('licenses')
export class LicensesController {
  constructor(
    private readonly licensesService: LicensesService,
    private readonly rsaHybrid: RsaHybridService,
    @InjectRepository(User) private usersRepository: Repository<User>,
    @InjectRepository(Product) private productsRepository: Repository<Product>,
  ) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @Post('validate')
  async validateLicense(
    @Body() body: ValidateLicenseDto,
    @Ip() ip: string
  ) {
    return this.licensesService.validateLicense(body.licenseKey, body.machineId, ip, body.productId);
  }

  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('licenses')
  @Post('issue')
  async issueLicense(@Body() body: IssueLicenseDto) {
    const user = await this.usersRepository.findOne({ where: { id: body.userId } });
    const product = await this.productsRepository.findOne({ where: { id: body.productId } });

    if (!user || !product) {
      throw new NotFoundException('User or Product not found');
    }

    return this.licensesService.issueOrExtendLicense(user, product, body.daysValid);
  }

  // Lives here (hardware/license internals) but surfaced from the admin Users
  // page, so it's gated on 'users' rather than 'licenses'.
  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('users')
  @Post('reset-hardware')
  async resetHardware(@Request() req, @Body('userId') userId: string) {
    return this.licensesService.resetMachineId(userId, req.admin);
  }

  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('licenses')
  @Post('issue-manual')
  async issueManual(@Request() req, @Body() body: IssueManualLicenseDto) {
    const { userId, productId, daysValid, paidAmount } = body;
    return this.licensesService.issueManualLicense(userId, productId, daysValid, paidAmount || 0, req.admin);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('my-licenses')
  async getMyLicenses(@Request() req) {
    return this.licensesService.getUserLicenses(req.user.userId);
  }

  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('licenses')
  @Post('update-date')
  async updateDate(@Request() req, @Body() body: UpdateLicenseDateDto) {
    return this.licensesService.updateLicenseDate(body.licenseId, body.expiresAt, req.admin);
  }

  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('licenses')
  @Post('toggle-status')
  async toggleLicenseStatus(@Request() req, @Body('licenseId') licenseId: string) {
    return this.licensesService.toggleLicenseStatus(licenseId, req.admin);
  }

  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('licenses')
  @Get('list')
  async getAllLicenses() {
    return this.licensesService.getAllLicenses();
  }

  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('logs')
  @Get('logs')
  async getLogs() {
    return this.licensesService.getRecentLogs();
  }

  // Called by the Engine on behalf of a trading terminal (MT5/NinjaTrader).
  // Same RSA+AES envelope as /auth/hardware-login — no DTO since the body is opaque ciphertext.
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @Post('check-by-machine')
  async checkByMachine(
    @Body('payload') payload: string,
    @Body('key') key: string,
    @Body('iv') iv: string,
  ) {
    if (!payload || !key || !iv) {
      throw new UnauthorizedException('Missing secure payload');
    }

    const { data } = this.rsaHybrid.decryptPayload(payload, key, iv);
    const { MachineID, ProductName, Timestamp } = data;

    if (!MachineID || !ProductName || !Timestamp) {
      throw new UnauthorizedException('Invalid payload structure');
    }

    this.rsaHybrid.validateTimestamp(Timestamp);

    return this.licensesService.checkActiveLicenseByMachine(MachineID, ProductName);
  }

  // Same envelope/auth model as check-by-machine, but returns every active
  // license for the machine's bound user - powers the Engine's App Hub list
  // and heartbeat instead of a single-product lookup.
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @Post('list-by-machine')
  async listByMachine(
    @Body('payload') payload: string,
    @Body('key') key: string,
    @Body('iv') iv: string,
  ) {
    if (!payload || !key || !iv) {
      throw new UnauthorizedException('Missing secure payload');
    }

    const { data } = this.rsaHybrid.decryptPayload(payload, key, iv);
    const { MachineID, Timestamp } = data;

    if (!MachineID || !Timestamp) {
      throw new UnauthorizedException('Invalid payload structure');
    }

    this.rsaHybrid.validateTimestamp(Timestamp);

    return this.licensesService.listActiveLicensesByMachine(MachineID);
  }

}
