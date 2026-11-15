import { IsNotEmpty, IsString, IsUUID, ValidateIf } from 'class-validator';

export class ValidateLicenseDto {
  @IsString()
  @IsNotEmpty()
  licenseKey: string;

  @IsString()
  @IsNotEmpty()
  machineId: string;

  @ValidateIf((_body, value) => value !== undefined)
  @IsUUID()
  productId?: string;
}
