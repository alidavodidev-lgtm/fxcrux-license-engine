import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class UpdateVersionDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsOptional()
  version?: string;

  @IsString()
  @IsOptional()
  platform?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
