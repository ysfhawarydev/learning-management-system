import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateSemesterDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  academicYear!: string;

  @IsIn(['spring', 'summer', 'fall', 'winter'])
  term!: 'spring' | 'summer' | 'fall' | 'winter';

  @IsOptional()
  @IsIn(['planned', 'active', 'completed', 'cancelled'])
  status?: 'planned' | 'active' | 'completed' | 'cancelled';

  @IsDateString({ strict: true })
  startDate!: string;

  @IsDateString({ strict: true })
  endDate!: string;
}
