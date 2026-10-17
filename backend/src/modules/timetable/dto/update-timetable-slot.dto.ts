import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { DayOfWeek } from './create-timetable-slot.dto.js';

export class UpdateTimetableSlotDto {
  @IsOptional()
  @IsUUID()
  courseOfferingId?: string;

  @IsOptional()
  @IsEnum(DayOfWeek)
  dayOfWeek?: DayOfWeek;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'startTime must use HH:mm format',
  })
  startTime?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'endTime must use HH:mm format',
  })
  endTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  room?: string | null;
}
