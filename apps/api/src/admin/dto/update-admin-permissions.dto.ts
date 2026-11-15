import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateAdminPermissionsDto {
  @IsString()
  @IsNotEmpty()
  adminId: string;

  @IsOptional() @IsBoolean() purchases?: boolean;
  @IsOptional() @IsBoolean() products?: boolean;
  @IsOptional() @IsBoolean() users?: boolean;
  @IsOptional() @IsBoolean() licenses?: boolean;
  @IsOptional() @IsBoolean() wallets?: boolean;
  @IsOptional() @IsBoolean() logs?: boolean;
  @IsOptional() @IsBoolean() tickets?: boolean;
  @IsOptional() @IsBoolean() reports?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ticketGroupIds?: string[];
}
