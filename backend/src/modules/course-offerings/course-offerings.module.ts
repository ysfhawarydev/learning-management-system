import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CourseOfferingsController } from './course-offerings.controller.js';
import { CourseOfferingsService } from './course-offerings.service.js';

@Module({
  imports: [AuthModule],
  controllers: [CourseOfferingsController],
  providers: [CourseOfferingsService],
})
export class CourseOfferingsModule {}
