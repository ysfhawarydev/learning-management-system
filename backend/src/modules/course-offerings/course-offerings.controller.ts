import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CreateCourseOfferingDto } from './dto/create-course-offering.dto.js';
import { UpdateCourseOfferingDto } from './dto/update-course-offering.dto.js';
import { CourseOfferingsService } from './course-offerings.service.js';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.js';

@Controller('course-offerings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class CourseOfferingsController {
  constructor(
    private readonly courseOfferingsService: CourseOfferingsService,
  ) {}

  @Post()
  create(@Body() dto: CreateCourseOfferingDto) {
    return this.courseOfferingsService.create(dto);
  }

  @Get()
  @Roles('admin', 'instructor')
  findAll(
    @Req()
    request: Request & { user: AuthenticatedUser },
  ) {
    return this.courseOfferingsService.findAll(request.user);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.courseOfferingsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCourseOfferingDto,
  ) {
    return this.courseOfferingsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.courseOfferingsService.remove(id);
  }
}
