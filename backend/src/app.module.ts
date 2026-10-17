import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { StudentsModule } from './modules/students/students.module.js';
import { DepartmentsModule } from './modules/departments/departments.module.js';
import { CoursesModule } from './modules/courses/courses.module.js';
import { InstructorsModule } from './modules/instructors/instructors.module.js';
import { SemestersModule } from './modules/semesters/semesters.module.js';
import { CourseOfferingsModule } from './modules/course-offerings/course-offerings.module.js';
import { EnrollmentsModule } from './modules/enrollments/enrollments.module.js';
import { AssessmentsModule } from './modules/assessments/assessments.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ObserveModule.forRoot({
      appKey: 'YOUR_APP_KEY',
      appSecret: 'YOUR_APP_SECRET',
      serviceId: 'student-management-system',
    }),
    DatabaseModule,
    AuthModule,
    StudentsModule,
    DepartmentsModule,
    CoursesModule,
    InstructorsModule,
    SemestersModule,
    CourseOfferingsModule,
    EnrollmentsModule,
    AssessmentsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
