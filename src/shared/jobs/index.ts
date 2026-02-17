import { closeComplianceQueue, isComplianceJobsEnabled } from './queue';
import { registerComplianceSchedules } from './scheduler';
import { startComplianceWorker, stopComplianceWorker } from './workers/compliance.worker';

export async function startComplianceJobs(log?: { info: Function; error: Function }) {
  if (!isComplianceJobsEnabled()) {
    log?.info('Compliance jobs are disabled');
    return;
  }

  startComplianceWorker(log);
  await registerComplianceSchedules(log);
}

export async function stopComplianceJobs() {
  await stopComplianceWorker();
  await closeComplianceQueue();
}
