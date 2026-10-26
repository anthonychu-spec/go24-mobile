/**
 * Cron jobs that call PGM or send push notifications only run when
 * BACKGROUND_JOBS_ENABLED=true. Default is off so a local or freshly
 * provisioned instance never writes to the live PGM tenant on its own.
 */
export function backgroundJobsEnabled(): boolean {
  return process.env.BACKGROUND_JOBS_ENABLED === 'true';
}
