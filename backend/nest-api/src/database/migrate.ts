import dataSource from './data-source';

/**
 * Applies pending migrations, one transaction each. Runs before the API starts
 * (Dockerfile CMD) and as its own deploy step, so a failed migration stops the
 * deploy before the running container is replaced.
 */
async function main(): Promise<void> {
  await dataSource.initialize();
  try {
    const ran = await dataSource.runMigrations({ transaction: 'each' });
    console.log(ran.length ? `Applied migrations: ${ran.map(m => m.name).join(', ')}` : 'No pending migrations');
  } finally {
    await dataSource.destroy();
  }
}

main().catch(err => {
  console.error('Migration failed', err);
  process.exit(1);
});
