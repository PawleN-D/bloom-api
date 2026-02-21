import {
  getComplianceQueue,
  isBullMQAvailable,
  isComplianceJobsEnabled,
} from './queue';

export async function registerComplianceSchedules(log?: { info: Function }) {
  if (!isComplianceJobsEnabled()) {
    log?.info('Compliance scheduler disabled (REDIS_URL not configured)');
    return;
  }

  const queue = getComplianceQueue();
  const isBull = isBullMQAvailable() && Boolean(process.env.REDIS_URL);

  if (isBull) {
    await queue.add(
      'check-overdue-incidents',
      {},
      {
        jobId: 'compliance:check-overdue-incidents',
        repeat: { every: 60 * 60 * 1000 },
        removeOnComplete: true,
        removeOnFail: 20,
      } as any
    );

    await queue.add(
      'check-expiring-certifications',
      {},
      {
        jobId: 'compliance:check-expiring-certifications',
        repeat: { pattern: '0 6 * * *' },
        removeOnComplete: true,
        removeOnFail: 20,
      } as any
    );

    await queue.add(
      'check-stale-care-plans',
      {},
      {
        jobId: 'compliance:check-stale-care-plans',
        repeat: { pattern: '0 6 * * *' },
        removeOnComplete: true,
        removeOnFail: 20,
      } as any
    );

    await queue.add(
      'check-critical-task-completions',
      {},
      {
        jobId: 'compliance:check-critical-task-completions',
        repeat: { every: 15 * 60 * 1000 },
        removeOnComplete: true,
        removeOnFail: 20,
      } as any
    );
  } else {
    await queue.add('check-overdue-incidents', {}, {
      jobId: 'compliance:check-overdue-incidents',
      repeat: { every: 60 * 60 * 1000 },
      removeOnComplete: true,
      removeOnFail: 20,
    });

    await queue.add('check-expiring-certifications', {}, {
      jobId: 'compliance:check-expiring-certifications',
      repeat: { pattern: '0 6 * * *' },
      removeOnComplete: true,
      removeOnFail: 20,
    });

    await queue.add('check-stale-care-plans', {}, {
      jobId: 'compliance:check-stale-care-plans',
      repeat: { pattern: '0 6 * * *' },
      removeOnComplete: true,
      removeOnFail: 20,
    });

    await queue.add('check-critical-task-completions', {}, {
      jobId: 'compliance:check-critical-task-completions',
      repeat: { every: 15 * 60 * 1000 },
      removeOnComplete: true,
      removeOnFail: 20,
    });
  }

  log?.info('Compliance schedules registered');
}
