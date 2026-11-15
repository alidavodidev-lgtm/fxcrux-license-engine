import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { PAYMENT_METHODS } from '../order.entity';

class CartItemDto {
  @IsString()
  @IsNotEmpty()
  tierId: string;
}

export class SubmitCartDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items: CartItemDto[];

  @IsString()
  @IsNotEmpty()
  walletId: string;

  @IsString()
  @IsNotEmpty()
  txId: string;

  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  paymentMethod?: string;
}
