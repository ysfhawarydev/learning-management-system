import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { AttendanceStatus } from './create-attendance.dto.js';

export class UpdateAttendanceDto {
  @IsOptional()
  @IsDateString({ strict: true })
  sessionDate?: string;

  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}
