import { MODULE_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { AuthModule } from '../auth/auth.module.js';
import { GradesController } from './grades.controller.js';
import { GradesModule } from './grades.module.js';
import { GradesService } from './grades.service.js';

describe('GradesModule', () => {
  it('registers the authentication module', () => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, GradesModule);

    expect(imports).toContain(AuthModule);
  });

  it('registers the grades controller', () => {
    const controllers = Reflect.getMetadata(
      MODULE_METADATA.CONTROLLERS,
      GradesModule,
    );

    expect(controllers).toContain(GradesController);
  });

  it('registers the grades service', () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      GradesModule,
    );

    expect(providers).toContain(GradesService);
  });
});
