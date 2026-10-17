import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export enum DayOfWeek {
  MONDAY = 'monday',
  TUESDAY = 'tuesday',
  WEDNESDAY = 'wednesday',
  THURSDAY = 'thursday',
  FRIDAY = 'friday',
  SATURDAY = 'saturday',
  SUNDAY = 'sunday',
}

export class CreateTimetableSlotDto {
  @IsUUID()
  courseOfferingId!: string;

  @IsEnum(DayOfWeek)
  dayOfWeek!: DayOfWeek;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'startTime must use HH:mm format',
  })
  startTime!: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'endTime must use HH:mm format',
  })
  endTime!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  room?: string | null;
}
