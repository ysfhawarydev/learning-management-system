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
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { SemestersService } from './semesters.service.js';
import { CreateSemesterDto } from './dto/create-semester.dto.js';
import { UpdateSemesterDto } from './dto/update-semester.dto.js';

@Controller('semesters')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class SemestersController {
  constructor(private readonly semestersService: SemestersService) {}

  @Post()
  create(@Body() dto: CreateSemesterDto) {
    return this.semestersService.create(dto);
  }

  @Get()
  @Roles('admin', 'instructor')
  findAll() {
    return this.semestersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.semestersService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSemesterDto,
  ) {
    return this.semestersService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.semestersService.remove(id);
  }
}
