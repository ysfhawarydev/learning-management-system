import { MODULE_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { AuthModule } from '../auth/auth.module.js';
import { AssessmentsController } from './assessments.controller.js';
import { AssessmentsModule } from './assessments.module.js';
import { AssessmentsService } from './assessments.service.js';

describe('AssessmentsModule', () => {
  it('registers the authentication module', () => {
    const imports = Reflect.getMetadata(
      MODULE_METADATA.IMPORTS,
      AssessmentsModule,
    );
    expect(imports).toContain(AuthModule);
  });

  it('registers the assessments controller', () => {
    const controllers = Reflect.getMetadata(
      MODULE_METADATA.CONTROLLERS,
      AssessmentsModule,
    );
    expect(controllers).toContain(AssessmentsController);
  });

  it('registers the assessments service', () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      AssessmentsModule,
    );
    expect(providers).toContain(AssessmentsService);
  });
});
