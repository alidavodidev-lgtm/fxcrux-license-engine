import { IsNotEmpty, IsString } from 'class-validator';

export class SubmitPurchaseDto {
  @IsString()
  @IsNotEmpty()
  tierId: string;

  @IsString()
  @IsNotEmpty()
  walletId: string;

  @IsString()
  @IsNotEmpty()
  txId: string;
}
