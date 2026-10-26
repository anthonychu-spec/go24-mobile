import 'reflect-metadata';
import { join } from 'node:path';
import { DataSource, DataSourceOptions } from 'typeorm';

// .ts under ts-node/jest, .js once compiled (dist also holds .d.ts files, which must not load)
const ext = __filename.endsWith('.ts') ? 'ts' : 'js';

export const DEFAULT_DATABASE_URL = 'postgresql://go24:go24@postgres:5432/go24';

/** Options shared by the migration runner and the schema test. The Nest app uses DatabaseModule. */
export function dataSourceOptions(url = process.env.DATABASE_URL): DataSourceOptions {
  return {
    type: 'postgres',
    url: url || DEFAULT_DATABASE_URL,
    entities: [join(__dirname, '..', '**', `*.entity.${ext}`)],
    migrations: [join(__dirname, 'migrations', `*.${ext}`)],
    migrationsTableName: 'typeorm_migrations',
    synchronize: false,
    logging: ['error', 'warn'],
  };
}

export default new DataSource(dataSourceOptions());
