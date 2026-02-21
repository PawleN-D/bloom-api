import {
  checkCriticalTaskCompletions,
  checkExpiringCertifications,
  checkOverdueIncidents,
  checkStaleCarePlans,
} from '../compliance-jobs';
import { isBullMQAvailable, isComplianceJobsEnabled, setComplianceJobRunner } from '../queue';

let started = false;
let bullWorker: any | null = null;

export function startComplianceWorker(log?: { info: Function; error: Function }) {
  if (!isComplianceJobsEnabled()) {
    log?.info('Compliance worker disabled');
    return;
  }

  if (started) {
    return;
  }

  if (isBullMQAvailable() && process.env.REDIS_URL) {
    const { Worker } = require('bullmq');
    const Redis = require('ioredis');
    const connection = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
    });

    bullWorker = new Worker(
      'compliance',
      async (job: any) => {
        switch (job.name) {
          case 'check-overdue-incidents':
            return checkOverdueIncidents(job.data?.organizationId);
          case 'check-expiring-certifications':
            return checkExpiringCertifications(job.data?.organizationId);
          case 'check-stale-care-plans':
            return checkStaleCarePlans(job.data?.organizationId);
          case 'check-critical-task-completions':
            return checkCriticalTaskCompletions(job.data?.organizationId);
          default:
            throw new Error(`Unknown compliance job: ${job.name}`);
        }
      },
      { connection }
    );

    bullWorker.on('failed', (job: any, error: Error) => {
      log?.error({ jobName: job?.name, jobId: job?.id, err: error }, 'Compliance job failed');
    });

    bullWorker.on('completed', (job: any) => {
      log?.info({ jobName: job.name, jobId: job.id }, 'Compliance job completed');
    });

    started = true;
    log?.info('Compliance worker started (BullMQ)');
    return;
  }

  setComplianceJobRunner(async (job) => {
    switch (job.name) {
      case 'check-overdue-incidents':
        return checkOverdueIncidents(job.data?.organizationId);
      case 'check-expiring-certifications':
        return checkExpiringCertifications(job.data?.organizationId);
      case 'check-stale-care-plans':
        return checkStaleCarePlans(job.data?.organizationId);
      case 'check-critical-task-completions':
        return checkCriticalTaskCompletions(job.data?.organizationId);
      default:
        throw new Error(`Unknown compliance job: ${job.name}`);
    }
  });

  started = true;
  log?.info('Compliance worker started (in-process fallback)');
}

export async function stopComplianceWorker() {
  if (bullWorker) {
    await bullWorker.close();
    bullWorker = null;
  }
  started = false;
}
