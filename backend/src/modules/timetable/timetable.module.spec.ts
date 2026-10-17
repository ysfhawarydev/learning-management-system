import { MODULE_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { AuthModule } from '../auth/auth.module.js';
import { TimetableController } from './timetable.controller.js';
import { TimetableModule } from './timetable.module.js';
import { TimetableService } from './timetable.service.js';

describe('TimetableModule', () => {
  it('registers AuthModule', () => {
    expect(
      Reflect.getMetadata(MODULE_METADATA.IMPORTS, TimetableModule),
    ).toContain(AuthModule);
  });
  it('registers the controller', () => {
    expect(
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, TimetableModule),
    ).toContain(TimetableController);
  });
  it('registers the service', () => {
    expect(
      Reflect.getMetadata(MODULE_METADATA.PROVIDERS, TimetableModule),
    ).toContain(TimetableService);
  });
});
