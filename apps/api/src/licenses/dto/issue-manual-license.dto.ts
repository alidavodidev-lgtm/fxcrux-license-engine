import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class IssueManualLicenseDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsInt()
  @Min(1)
  daysValid: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  paidAmount?: number;
}
