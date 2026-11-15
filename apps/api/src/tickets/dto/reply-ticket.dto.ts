import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ReplyTicketDto {
  @IsString()
  @IsNotEmpty()
  ticketId: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}
