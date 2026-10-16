import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

const studentStatuses = [
  'applicant',
  'enrolled',
  'on_leave',
  'probation',
  'graduated',
  'withdrawn',
] as const;

export class UpdateStudentDto {
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  number?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsDateString()
  birth?: string;

  @IsOptional()
  @IsIn(studentStatuses)
  status?: (typeof studentStatuses)[number];
}
