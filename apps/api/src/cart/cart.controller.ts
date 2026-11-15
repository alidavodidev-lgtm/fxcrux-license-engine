import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CartService } from './cart.service';

@Controller('cart')
@UseGuards(AuthGuard('jwt'))
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  async getCart(@Request() req) {
    return this.cartService.getCart(req.user.userId);
  }

  @Post('add')
  async addItem(@Request() req, @Body('tierId') tierId: string) {
    return this.cartService.addItem(req.user.userId, tierId);
  }

  @Post('remove')
  async removeItem(@Request() req, @Body('itemId') itemId: string) {
    return this.cartService.removeItem(req.user.userId, itemId);
  }

  @Post('clear')
  async clearCart(@Request() req) {
    await this.cartService.clearCart(req.user.userId);
    return { success: true };
  }
}
