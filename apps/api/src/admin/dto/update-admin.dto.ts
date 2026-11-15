import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateAdminDto {
  @IsString()
  @IsNotEmpty()
  adminId: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}
