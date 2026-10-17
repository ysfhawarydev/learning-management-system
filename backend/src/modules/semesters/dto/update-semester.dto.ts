import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateSemesterDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  academicYear?: string;

  @IsOptional()
  @IsIn(['spring', 'summer', 'fall', 'winter'])
  term?: 'spring' | 'summer' | 'fall' | 'winter';

  @IsOptional()
  @IsIn(['planned', 'active', 'completed', 'cancelled'])
  status?: 'planned' | 'active' | 'completed' | 'cancelled';

  @IsOptional()
  @IsDateString({ strict: true })
  startDate?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  endDate?: string;
}
