import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.js';

import { CreateStudentDto } from './dto/create-student.dto.js';
import { CreateStudentAccountDto } from './dto/create-student-account.dto.js';
import { UpdateStudentDto } from './dto/update-student.dto.js';
import { StudentsService } from './students.service.js';
import { UpdateMyStudentProfileDto } from './dto/update-my-student-profile.dto.js';

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get('me')
  @Roles('student')
  getMyProfile(@Req() request: Request & { user: AuthenticatedUser }) {
    return this.studentsService.findMyProfile(request.user.sub);
  }

  @Get('me/courses')
  @Roles('student')
  getMyCourses(@Req() request: Request & { user: AuthenticatedUser }) {
    return this.studentsService.findMyCourses(request.user.sub);
  }

  @Get('me/attendance')
  @Roles('student')
  getMyAttendance(@Req() request: Request & { user: AuthenticatedUser }) {
    return this.studentsService.findMyAttendance(request.user.sub);
  }

  @Get('me/grades')
  @Roles('student')
  getMyGrades(@Req() request: Request & { user: AuthenticatedUser }) {
    return this.studentsService.findMyGrades(request.user.sub);
  }

  @Patch('me')
  @Roles('student')
  updateMyProfile(
    @Req() request: Request & { user: AuthenticatedUser },
    @Body() dto: UpdateMyStudentProfileDto,
  ) {
    return this.studentsService.updateMyProfile(request.user.sub, dto);
  }

  @Get('departments')
  @Roles('admin')
  findDepartments() {
    return this.studentsService.findDepartments();
  }

  @Get()
  @Roles('admin')
  findAll() {
    return this.studentsService.findAll();
  }

  @Post('with-account')
  @Roles('admin')
  createAccount(@Body() dto: CreateStudentAccountDto) {
    return this.studentsService.createAccount(dto);
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateStudentDto) {
    return this.studentsService.create(dto);
  }

  @Patch(':id')
  @Roles('admin')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStudentDto,
  ) {
    return this.studentsService.update(id, dto);
  }

  @Get('pending-registrations')
  @Roles('admin')
  findPendingRegistrations() {
    return this.studentsService.findPendingRegistrations();
  }

  @Post(':id/approve')
  @Roles('admin')
  approveRegistration(@Param('id', ParseUUIDPipe) id: string) {
    return this.studentsService.approveRegistration(id);
  }

  @Get(':id')
  @Roles('admin')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.studentsService.findOne(id);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.studentsService.remove(id);
  }
}
