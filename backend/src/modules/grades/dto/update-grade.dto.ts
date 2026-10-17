import { IsNumber, IsOptional, Min, Max } from 'class-validator';

export class UpdateGradeDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999.99)
  score?: number | null;
}
