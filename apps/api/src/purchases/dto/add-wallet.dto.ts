import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AddWalletDto {
  @IsString()
  @IsNotEmpty()
  network: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsOptional()
  description?: string;
}
