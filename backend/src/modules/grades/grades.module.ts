import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { GradesController } from './grades.controller.js';
import { GradesService } from './grades.service.js';

@Module({
  imports: [AuthModule],
  controllers: [GradesController],
  providers: [GradesService],
})
export class GradesModule {}
