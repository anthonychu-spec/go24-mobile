import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source';

/**
 * Migrates an empty database and checks that every entity's tables and columns
 * exist with matching type and nullability.
 *
 * Needs a throwaway Postgres: set TEST_DATABASE_URL (database name must contain
 * "test" — the public schema is dropped). Skipped when unset.
 *
 * Differences that are only about naming or DB-side extras (partial/extra
 * indexes, CHECK constraints, defaults the entity doesn't declare) are allowed;
 * TypeORM would "fix" those by renaming or dropping them, which we don't want.
 */
const url = process.env.TEST_DATABASE_URL;
const describeDb = url ? describe : describe.skip;

// Schema-builder statements that mean an entity and the migrated schema really disagree
const STRUCTURAL = [
  /^CREATE TABLE/i,
  /^DROP TABLE/i,
  /ADD "\w+" /i, // add column
  /DROP COLUMN/i,
  /ALTER COLUMN "\w+" TYPE/i,
  /SET NOT NULL/i,
  /DROP NOT NULL/i,
];

describeDb('database schema', () => {
  let ds: DataSource;

  beforeAll(async () => {
    const dbName = new URL(url!).pathname.slice(1);
    if (!dbName.includes('test')) {
      throw new Error(`TEST_DATABASE_URL must point at a test database (got "${dbName}")`);
    }
    ds = new DataSource(dataSourceOptions(url));
    await ds.initialize();
    await ds.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  }, 60_000);

  afterAll(async () => {
    await ds?.destroy();
  });

  it('applies every migration on an empty database, then has nothing pending', async () => {
    const ran = await ds.runMigrations({ transaction: 'each' });
    expect(ran.length).toBe(ds.migrations.length);
    expect(await ds.showMigrations()).toBe(false);
  }, 60_000);

  it('matches every entity table and column', async () => {
    const log = await ds.driver.createSchemaBuilder().log();
    const mismatches = log.upQueries
      .map(q => q.query.trim())
      .filter(q => STRUCTURAL.some(re => re.test(q)));
    expect(mismatches).toEqual([]);
  }, 60_000);
});
