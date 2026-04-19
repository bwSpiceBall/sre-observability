/**
 * Simple in-memory queue that produces fake jobs for the worker to consume.
 * The queue will continuously add jobs at intervals.
 */

const { v4: uuidv4 } = require('uuid');

class InMemoryQueue {
  constructor(logger) {
    this.store = [];
    this.logger = logger;
    this.produceInterval = null;
  }

  startProducing(rateMs = 500) {
    if (this.produceInterval) return;
    this.produceInterval = setInterval(() => {
      const job = { id: uuidv4(), payload: { work: 'do-something', createdAt: Date.now() }, attempts: 0 };
      this.store.push(job);
      this.logger.debug({ message: 'Enqueued job', metadata: { jobId: job.id } });
    }, rateMs);
  }

  stopProducing() {
    if (this.produceInterval) {
      clearInterval(this.produceInterval);
      this.produceInterval = null;
    }
  }

  async poll() {
    // Return one job if available (FIFO)
    if (this.store.length === 0) return null;
    return this.store.shift();
  }

  size() {
    return this.store.length;
  }
}

module.exports = InMemoryQueue;
