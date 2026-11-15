import { IsInt, IsOptional, Min } from 'class-validator';

export class UpdateSettingsDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  product_image_max_kb?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  ticket_attachment_max_kb?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  product_file_max_mb?: number;
}
