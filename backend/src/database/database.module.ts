import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';
import { DRIZZLE } from './database.constants.js';
import { DatabaseService } from './database.service.js';

const DATABASE_POOL = Symbol('DATABASE_POOL');

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_POOL,
      useFactory: () => {
        const connectionString = process.env.DATABASE_URL;

        if (!connectionString)
          throw new Error('DATABASE_URL is not configured');

        return new Pool({ connectionString });
      },
    },

    {
      provide: DRIZZLE,
      inject: [DATABASE_POOL],
      useFactory: (pool: Pool): NodePgDatabase<typeof schema> =>
        drizzle(pool, { schema }),
    },
    DatabaseService,
  ],

  exports: [DRIZZLE, DatabaseService],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
