import {
  IsDateString,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateStudentDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  departmentId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(30)
  number: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName: string;

  @IsDateString()
  birth: string;
}
