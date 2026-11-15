import { IsBoolean, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAdminDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional() @IsBoolean() purchases?: boolean;
  @IsOptional() @IsBoolean() products?: boolean;
  @IsOptional() @IsBoolean() users?: boolean;
  @IsOptional() @IsBoolean() licenses?: boolean;
  @IsOptional() @IsBoolean() wallets?: boolean;
  @IsOptional() @IsBoolean() logs?: boolean;
  @IsOptional() @IsBoolean() tickets?: boolean;
}
