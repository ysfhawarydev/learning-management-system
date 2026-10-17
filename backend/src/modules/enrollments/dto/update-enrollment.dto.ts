import { IsIn } from 'class-validator';
import {
  ENROLLMENT_STATUSES,
  type EnrollmentStatus,
} from './create-enrollment.dto.js';

export class UpdateEnrollmentDto {
  @IsIn(ENROLLMENT_STATUSES)
  status!: EnrollmentStatus;
}
