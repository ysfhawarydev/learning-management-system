import { Test, TestingModule } from '@nestjs/testing';
import { InstructorsController } from './instructors.controller.js';
import { InstructorsService } from './instructors.service.js';
import { CreateInstructorDto } from './dto/create-instructor.dto.js';
import { UpdateInstructorDto } from './dto/update-instructor.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';

describe('InstructorsController', () => {
  let controller: InstructorsController;

  const instructorsService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  const instructorId = 'a3a7c1e2-5d6b-4f80-9a1b-2c3d4e5f6789';

  const instructor = {
    id: instructorId,
    userId: 'b3a7c1e2-5d6b-4f80-9a1b-2c3d4e5f6789',
    departmentId: 'c3a7c1e2-5d6b-4f80-9a1b-2c3d4e5f6789',
    employeeNumber: 'EMP001',
    firstName: 'John',
    lastName: 'Doe',
    phone: null,
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InstructorsController],
      providers: [
        {
          provide: InstructorsService,
          useValue: instructorsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: vi.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: vi.fn(() => true) })
      .compile();

    controller = module.get<InstructorsController>(InstructorsController);
  });

  describe('create', () => {
    it('creates an instructor', async () => {
      const dto: CreateInstructorDto = {
        userId: instructor.userId,
        departmentId: instructor.departmentId,
        employeeNumber: instructor.employeeNumber,
        firstName: instructor.firstName,
        lastName: instructor.lastName,
        phone: '123456789',
      };

      instructorsService.create.mockResolvedValue(instructor);

      await expect(controller.create(dto)).resolves.toEqual(instructor);

      expect(instructorsService.create).toHaveBeenCalledWith(dto);
      expect(instructorsService.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('findAll', () => {
    it('returns all instructors', async () => {
      const instructors = [instructor];

      instructorsService.findAll.mockResolvedValue(instructors);

      await expect(controller.findAll()).resolves.toEqual(instructors);

      expect(instructorsService.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('findOne', () => {
    it('returns an instructor by ID', async () => {
      instructorsService.findOne.mockResolvedValue(instructor);

      await expect(controller.findOne(instructorId)).resolves.toEqual(
        instructor,
      );

      expect(instructorsService.findOne).toHaveBeenCalledWith(instructorId);
      expect(instructorsService.findOne).toHaveBeenCalledTimes(1);
    });
  });

  describe('update', () => {
    it('updates an instructor by ID', async () => {
      const dto: UpdateInstructorDto = {
        firstName: 'Jane',
        lastName: 'Smith',
      };

      const updatedInstructor = {
        ...instructor,
        firstName: 'Jane',
        lastName: 'Smith',
      };

      instructorsService.update.mockResolvedValue(updatedInstructor);

      await expect(controller.update(instructorId, dto)).resolves.toEqual(
        updatedInstructor,
      );

      expect(instructorsService.update).toHaveBeenCalledWith(instructorId, dto);
      expect(instructorsService.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('remove', () => {
    it('deletes an instructor by ID', async () => {
      const result = { message: 'Instructor deleted successfully' };

      instructorsService.remove.mockResolvedValue(result);

      await expect(controller.remove(instructorId)).resolves.toEqual(result);

      expect(instructorsService.remove).toHaveBeenCalledWith(instructorId);
      expect(instructorsService.remove).toHaveBeenCalledTimes(1);
    });
  });
});
