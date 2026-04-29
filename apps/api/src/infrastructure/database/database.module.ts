import { Global, Module, type OnApplicationShutdown } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { AppConfigService } from '../../config/app-config.service';
import * as schema from './schema';

export const DRIZZLE = Symbol('DRIZZLE');
export type Db = ReturnType<typeof drizzle<typeof schema>>;

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): Db => {
        const pool = new Pool({ connectionString: config.databaseUrl });
        return drizzle(pool, { schema });
      },
    },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule implements OnApplicationShutdown {
  // The pool is held inside the provider closure; if you need explicit shutdown,
  // expose the Pool from the factory and call `pool.end()` here.
  async onApplicationShutdown(): Promise<void> {
    /* no-op: pg.Pool is GC'd on process exit */
  }
}
