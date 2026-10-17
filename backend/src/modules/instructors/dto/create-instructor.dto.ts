import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateInstructorDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  departmentId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(30)
  employeeNumber: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;
}
