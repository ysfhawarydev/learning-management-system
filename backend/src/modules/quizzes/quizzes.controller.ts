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
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.js';
import type { Request } from 'express';
import { CreateQuizDto } from './dto/create-quiz.dto.js';
import { SubmitQuizDto } from './dto/submit-quiz.dto.js';
import { QuizzesService } from './quizzes.service.js';

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

@Controller('quizzes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuizzesController {
  constructor(private readonly quizzesService: QuizzesService) {}

  @Post()
  @Roles('admin', 'instructor')
  create(@Body() dto: CreateQuizDto, @Req() request: AuthenticatedRequest) {
    return this.quizzesService.create(dto, request.user);
  }

  @Get()
  @Roles('admin', 'instructor', 'student')
  findAll(@Req() request: AuthenticatedRequest) {
    return this.quizzesService.findAll(request.user);
  }

  @Get(':id/attempts')
  @Roles('admin', 'instructor')
  findAttempts(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.quizzesService.findAttempts(id, request.user);
  }

  @Get(':id/my-attempt')
  @Roles('student')
  findMyAttempt(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.quizzesService.findMyAttempt(id, request.user);
  }

  @Get(':id')
  @Roles('admin', 'instructor', 'student')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.quizzesService.findOne(id, request.user);
  }

  @Post(':id/attempts')
  @Roles('student')
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitQuizDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.quizzesService.submit(id, dto, request.user);
  }
}
