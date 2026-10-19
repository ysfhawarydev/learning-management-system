import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class ReviewSubmissionDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  score!: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  feedback?: string;
}
