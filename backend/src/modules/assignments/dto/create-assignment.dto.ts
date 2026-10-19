import {
  IsBoolean,
  IsDateString,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAssignmentDto {
  @IsUUID()
  assessmentId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  instructions!: string;

  @IsDateString()
  dueAt!: string;

  @IsBoolean()
  allowLateSubmissions = false;
}
