import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

export class UpdateLicenseDateDto {
  @IsString()
  @IsNotEmpty()
  licenseId: string;

  @IsDateString()
  expiresAt: string;
}
