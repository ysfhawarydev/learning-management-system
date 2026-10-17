import {
  IsIn,
  IsNumber,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const ASSESSMENT_TYPES = [
  'assignment',
  'quiz',
  'midterm',
  'final',
  'project',
] as const;

export type AssessmentType = (typeof ASSESSMENT_TYPES)[number];

export class CreateAssessmentDto {
  @IsUUID()
  courseOfferingId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  @IsIn(ASSESSMENT_TYPES)
  type!: AssessmentType;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9999.99)
  maxScore!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  weight!: number;
}
