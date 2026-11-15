import { IsNotEmpty, IsString } from 'class-validator';

export class ReassignTicketGroupDto {
  @IsString()
  @IsNotEmpty()
  ticketId: string;

  @IsString()
  @IsNotEmpty()
  groupId: string;
}
