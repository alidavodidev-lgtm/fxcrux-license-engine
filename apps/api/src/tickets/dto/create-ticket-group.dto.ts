import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateTicketGroupDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}
