import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class SetGroupAdminsDto {
  @IsString()
  @IsNotEmpty()
  groupId: string;

  @IsArray()
  @IsString({ each: true })
  adminIds: string[];
}
