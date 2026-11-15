import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { AuthGuard } from '@nestjs/passport';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { SubmitPurchaseDto } from './dto/submit-purchase.dto';
import { SubmitCartDto } from './dto/submit-cart.dto';
import { UpdateWalletDto } from './dto/update-wallet.dto';
import { AddWalletDto } from './dto/add-wallet.dto';

@Controller('purchases')
export class PurchasesController {
  constructor(
    private readonly purchasesService: PurchasesService,
  ) {}

  @Get('wallets')
  async getWallets() {
    return this.purchasesService.getActiveWallets();
  }

  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('purchases')
  @Get('pending')
  async getPendingRequests() {
    return this.purchasesService.getPendingPurchases();
  }

  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('wallets')
  @Post('wallets/update')
  async updateWallet(@Request() req, @Body() body: UpdateWalletDto) {
    const { id, ...updateData } = body;
    return this.purchasesService.updateWallet(id, updateData, req.admin);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('submit')
  async submitTx(
    @Request() req,
    @Body() body: SubmitPurchaseDto
  ) {
    return this.purchasesService.submitPurchase(req.user.userId, body.tierId, body.walletId, body.txId);
  }

  // Cart checkout - one or more items paid for together with a single txid.
  @UseGuards(AuthGuard('jwt'))
  @Post('submit-cart')
  async submitCart(@Request() req, @Body() body: SubmitCartDto) {
    return this.purchasesService.submitCart(req.user.userId, body);
  }

  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('purchases')
  @Post('reject')
  async rejectTx(@Request() req, @Body('purchaseId') purchaseId: string, @Body('reason') reason?: string) {
    return this.purchasesService.rejectTransaction(purchaseId, req.admin, reason);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('my-purchases')
  async getMyPurchases(@Request() req) {
    return this.purchasesService.getUserPurchases(req.user.userId);
  }

  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('purchases')
  @Post('approve')
  async approveTx(@Request() req, @Body('purchaseId') purchaseId: string) {
    return this.purchasesService.approveTransaction(purchaseId, req.admin);
  }

  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('wallets')
  @Post('wallets/add')
  async addWallet(@Request() req, @Body() body: AddWalletDto) {
    return this.purchasesService.addWallet(body.network, body.address, body.description ?? '', req.admin);
  }

  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('purchases')
  @Get('stats')
  async getStats() {
    return this.purchasesService.getRevenueStats();
  }
}