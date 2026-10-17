import { IsIn, IsUUID } from 'class-validator';

export const ENROLLMENT_STATUSES = [
  'enrolled',
  'dropped',
  'completed',
  'withdrawn',
] as const;

export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

export class CreateEnrollmentDto {
  @IsUUID()
  studentId!: string;

  @IsUUID()
  courseOfferingId!: string;

  @IsIn(ENROLLMENT_STATUSES)
  status: EnrollmentStatus = 'enrolled';
}
