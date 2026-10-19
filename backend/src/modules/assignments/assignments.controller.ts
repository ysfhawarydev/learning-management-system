import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.js';
import { CreateAssignmentDto } from './dto/create-assignment.dto.js';
import { SubmitAssignmentDto } from './dto/submit-assignment.dto.js';
import { ReviewSubmissionDto } from './dto/review-submission.dto.js';
import { AssignmentsService } from './assignments.service.js';

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

@Controller('assignments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Post()
  @Roles('admin', 'instructor')
  create(
    @Body() dto: CreateAssignmentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.assignmentsService.create(dto, request.user);
  }

  @Get()
  @Roles('admin', 'instructor', 'student')
  findAll(@Req() request: AuthenticatedRequest) {
    return this.assignmentsService.findAll(request.user);
  }

  @Get(':id')
  @Roles('admin', 'instructor', 'student')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.assignmentsService.findOne(id, request.user);
  }

  @Post(':id/submissions')
  @Roles('student')
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitAssignmentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.assignmentsService.submit(id, dto, request.user);
  }

  @Get(':id/my-submission')
  @Roles('student')
  findMySubmission(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.assignmentsService.findMySubmission(id, request.user);
  }

  @Get(':id/submissions')
  @Roles('admin', 'instructor')
  findSubmissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.assignmentsService.findSubmissions(id, request.user);
  }

  @Post(':id/submissions/:submissionId/review')
  @Roles('admin', 'instructor')
  review(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Body() dto: ReviewSubmissionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.assignmentsService.review(id, submissionId, dto, request.user);
  }
}
