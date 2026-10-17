import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { InstructorsController } from './instructors.controller.js';
import { InstructorsService } from './instructors.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [InstructorsController],
  providers: [InstructorsService],
  exports: [InstructorsService],
})
export class InstructorsModule {}
