import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from './database.constants.js';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';

@Injectable()
export class DatabaseService {
  constructor(
    @Inject(DRIZZLE)
    public readonly db: NodePgDatabase<typeof schema>,
  ) {}
}
