const logger = require('../logger');
const metrics = require('../metrics');

const JOB_FAILURE_RATE = parseFloat(process.env.JOB_FAILURE_RATE || '0.0');
const PROCESS_LATENCY_MS = parseInt(process.env.PROCESS_LATENCY_MS || '0', 10);
const MEMORY_LEAK_ENABLED = (process.env.MEMORY_LEAK_ENABLED || 'false') === 'true';
const RETRY_MAX = parseInt(process.env.RETRY_MAX || '3', 10);

// Simple in-memory leak store (if enabled)
const leakStore = [];

class Worker {
  constructor(queue) {
    this.queue = queue;
    this.running = false;
    this.workerName = process.env.WORKER_NAME || 'worker-1';
  }

  start() {
    logger.info({ message: 'Worker starting', worker: this.workerName });
    this.running = true;
    this.loop();
    // Periodically update memory metric
    this.memoryInterval = setInterval(() => {
      metrics.memoryUsageGauge.set({ worker: this.workerName }, process.memoryUsage().heapUsed);
    }, 2000).unref();
  }

  stop() {
    logger.info({ message: 'Worker stopping', worker: this.workerName });
    this.running = false;
    if (this.memoryInterval) clearInterval(this.memoryInterval);
  }

  async loop() {
    while (this.running) {
      try {
        const job = await this.queue.poll();
        if (!job) {
          // No job - sleep briefly
          await this.sleep(200);
          continue;
        }
        await this.processWithRetries(job);
      } catch (err) {
        logger.error({ message: 'Unexpected worker loop error', metadata: { err } });
        // Backoff slightly on unexpected errors
        await this.sleep(500);
      }
    }
  }

  async processWithRetries(job) {
    let attempt = 0;
    let lastErr = null;
    while (attempt <= RETRY_MAX) {
      try {
        attempt += 1;
        job.attempts = attempt;
        await this.processJob(job);
        // success
        metrics.jobsProcessed.inc({ worker: this.workerName });
        return;
      } catch (err) {
        lastErr = err;
        logger.warn({ message: 'Job processing failed', jobId: job.id, attempt, metadata: { err: err.message } });
        if (attempt <= RETRY_MAX) {
          // exponential backoff
          const backoff = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await this.sleep(backoff);
          continue;
        } else {
          // record failed metric
          metrics.jobsFailed.inc({ worker: this.workerName });
        }
      }
    }
    // final failure
    logger.error({ message: 'Job failed after retries', jobId: job.id, metadata: { err: lastErr && lastErr.message } });
  }

  async processJob(job) {
    const end = metrics.jobDuration.startTimer({ worker: this.workerName });

    // Simulate processing latency
    if (PROCESS_LATENCY_MS > 0) {
      // apply slowdown randomly with 50% probability
      if (Math.random() < 0.5) {
        await this.sleep(PROCESS_LATENCY_MS);
      }
    }

    // Simulate memory leak by pushing data into leakStore
    if (MEMORY_LEAK_ENABLED) {
      // add a moderate-sized buffer to leakStore to grow memory gradually
      leakStore.push(Buffer.alloc(1024 * 50)); // 50KB per leak
      // Keep leakStore unbounded on purpose
      logger.debug({ message: 'Memory leak step: added buffer', metadata: { leakCount: leakStore.length } });
    }

    // Simulate job failure randomly
    if (Math.random() < JOB_FAILURE_RATE) {
      end();
      throw new Error('simulated_job_failure');
    }

    // Fake work (could be CPU or I/O)
    await this.simulatedWork(job);

    end();
    logger.info({ message: 'Job processed', metadata: { jobId: job.id, attempts: job.attempts } });
  }

  async simulatedWork(job) {
    // Some variable but bounded CPU/busy work
    // Do a small random amount of async work
    const complexity = 5 + Math.floor(Math.random() * 20);
    // Simulate asynchronous operations
    for (let i = 0; i < complexity; i++) {
      // micro-sleep
      await this.sleep(5);
    }
    return true;
  }

  sleep(ms) {
    return new Promise((res) => setTimeout(res, ms));
  }
}

module.exports = Worker;
