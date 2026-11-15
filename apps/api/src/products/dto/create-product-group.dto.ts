import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateProductGroupDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}
