import { IsArray, IsString } from 'class-validator';

export class AssignVersionUsersDto {
  @IsArray()
  @IsString({ each: true })
  userIds: string[];
}
