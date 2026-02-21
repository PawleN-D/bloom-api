type ComplianceJobName =
  | 'check-overdue-incidents'
  | 'check-expiring-certifications'
  | 'check-stale-care-plans'
  | 'check-critical-task-completions';

type JobRunner = (job: { name: ComplianceJobName; data?: any }) => Promise<unknown>;

type AddOptions = {
  jobId?: string;
  repeat?: {
    every?: number;
    pattern?: string;
  };
  removeOnComplete?: boolean;
  removeOnFail?: number;
};

const intervalHandles: NodeJS.Timeout[] = [];
const timeoutHandles: NodeJS.Timeout[] = [];
const scheduledJobIds = new Set<string>();
let runner: JobRunner | null = null;
let bullQueue: any | null = null;
let bullConnection: any | null = null;

const loadBullMQ = () => {
  try {
    // Optional runtime dependency. If unavailable, fall back to in-process scheduler.
    const bullmq = require('bullmq');
    const Redis = require('ioredis');
    return { bullmq, Redis };
  } catch {
    return null;
  }
};

export const isBullMQAvailable = () => Boolean(loadBullMQ());

export const isComplianceJobsEnabled = () =>
  process.env.COMPLIANCE_JOBS_ENABLED !== 'false';

export const setComplianceJobRunner = (jobRunner: JobRunner) => {
  runner = jobRunner;
};

const runJob = async (name: ComplianceJobName, data?: any) => {
  if (!runner) {
    throw new Error('Compliance job runner is not configured');
  }
  return runner({ name, data });
};

const scheduleDailyAtSix = (name: ComplianceJobName, data?: any) => {
  const now = new Date();
  const next = new Date(now);
  next.setHours(6, 0, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }

  const delay = next.getTime() - now.getTime();
  const timeout = setTimeout(() => {
    runJob(name, data).catch((error) => {
      console.error('[ComplianceQueue] daily job failed', name, error);
    });

    const interval = setInterval(() => {
      runJob(name, data).catch((error) => {
        console.error('[ComplianceQueue] daily job failed', name, error);
      });
    }, 24 * 60 * 60 * 1000);

    intervalHandles.push(interval);
  }, delay);

  timeoutHandles.push(timeout);
};

export const getComplianceQueue = () => ({
  add: async (name: ComplianceJobName, data: any, options?: AddOptions) => {
    const bull = loadBullMQ();
    if (bull && process.env.REDIS_URL) {
      if (!bullConnection) {
        bullConnection = new bull.Redis(process.env.REDIS_URL, {
          maxRetriesPerRequest: null,
        });
      }

      if (!bullQueue) {
        bullQueue = new bull.bullmq.Queue('compliance', {
          connection: bullConnection,
        });
      }

      return bullQueue.add(name, data || {}, options || {});
    }

    if (!options?.repeat) {
      return runJob(name, data);
    }

    if (options.jobId && scheduledJobIds.has(options.jobId)) {
      return;
    }

    if (options.jobId) {
      scheduledJobIds.add(options.jobId);
    }

    if (options.repeat.every) {
      const interval = setInterval(() => {
        runJob(name, data).catch((error) => {
          console.error('[ComplianceQueue] interval job failed', name, error);
        });
      }, options.repeat.every);
      intervalHandles.push(interval);
      return;
    }

    if (options.repeat.pattern === '0 6 * * *') {
      scheduleDailyAtSix(name, data);
      return;
    }

    throw new Error(`Unsupported repeat pattern: ${options.repeat.pattern || 'unknown'}`);
  },
});

export async function closeComplianceQueue() {
  if (bullQueue) {
    await bullQueue.close();
    bullQueue = null;
  }

  if (bullConnection) {
    await bullConnection.quit();
    bullConnection = null;
  }

  for (const interval of intervalHandles) {
    clearInterval(interval);
  }
  intervalHandles.length = 0;

  for (const timeout of timeoutHandles) {
    clearTimeout(timeout);
  }
  timeoutHandles.length = 0;

  scheduledJobIds.clear();
  runner = null;
}
