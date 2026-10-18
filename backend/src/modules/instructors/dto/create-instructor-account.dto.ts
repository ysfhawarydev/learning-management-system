import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateInstructorAccountDto {
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password: string;

  @IsUUID()
  departmentId: string;

  @IsString()
  @Matches(/\S/, {
    message: 'This field must contain at least one non-whitespace character',
  })
  @MinLength(1)
  @MaxLength(30)
  employeeNumber: string;

  @IsString()
  @Matches(/\S/, {
    message: 'This field must contain at least one non-whitespace character',
  })
  @MinLength(1)
  @MaxLength(100)
  firstName: string;

  @IsString()
  @Matches(/\S/, {
    message: 'This field must contain at least one non-whitespace character',
  })
  @MinLength(1)
  @MaxLength(100)
  lastName: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;
}
