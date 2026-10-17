import { MODULE_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { AuthModule } from '../auth/auth.module.js';
import { AttendanceController } from './attendance.controller.js';
import { AttendanceModule } from './attendance.module.js';
import { AttendanceService } from './attendance.service.js';

describe('AttendanceModule', () => {
  it('registers the authentication module', () => {
    const imports = Reflect.getMetadata(
      MODULE_METADATA.IMPORTS,
      AttendanceModule,
    );

    expect(imports).toContain(AuthModule);
  });

  it('registers the attendance controller', () => {
    const controllers = Reflect.getMetadata(
      MODULE_METADATA.CONTROLLERS,
      AttendanceModule,
    );

    expect(controllers).toContain(AttendanceController);
  });

  it('registers the attendance service', () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      AttendanceModule,
    );

    expect(providers).toContain(AttendanceService);
  });
});
