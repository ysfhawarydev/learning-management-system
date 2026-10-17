import { describe, expect, it } from 'vitest';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { AuthModule } from '../auth/auth.module.js';
import { EnrollmentsController } from './enrollments.controller.js';
import { EnrollmentsModule } from './enrollments.module.js';
import { EnrollmentsService } from './enrollments.service.js';

describe('EnrollmentsModule', () => {
  it('registers the authentication module', () => {
    const imports = Reflect.getMetadata(
      MODULE_METADATA.IMPORTS,
      EnrollmentsModule,
    );

    expect(imports).toContain(AuthModule);
  });

  it('registers the enrollments controller', () => {
    const controllers = Reflect.getMetadata(
      MODULE_METADATA.CONTROLLERS,
      EnrollmentsModule,
    );

    expect(controllers).toContain(EnrollmentsController);
  });

  it('registers the enrollments service', () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      EnrollmentsModule,
    );

    expect(providers).toContain(EnrollmentsService);
  });
});
