import { IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class CreateGradeDto {
  @IsUUID()
  enrollmentId!: string;

  @IsUUID()
  assessmentId!: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999.99)
  score?: number | null;
}
