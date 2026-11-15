import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class IssueLicenseDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsInt()
  @Min(1)
  daysValid: number;
}
