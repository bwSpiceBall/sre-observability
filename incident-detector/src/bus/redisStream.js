const Redis  = require('ioredis');
const logger = require('../logger');

const STREAM_KEY = 'incidents';
const MAX_LEN    = 10000;

class RedisStreamBus {
  constructor({ host, port }) {
    this._host   = host;
    this._port   = port;
    this._client = null;
  }

  connect() {
    this._client = new Redis({
      host: this._host,
      port: this._port,
      lazyConnect: false,
      retryStrategy(times) {
        return Math.min(times * 500, 30000);
      },
      maxRetriesPerRequest: null
    });

    this._client.on('connect', () => {
      logger.info({ message: 'Redis connected', metadata: { host: this._host, port: this._port } });
    });

    this._client.on('error', (err) => {
      logger.error({ message: 'Redis error', metadata: { err: err.message } });
    });

    this._client.on('reconnecting', () => {
      logger.warn({ message: 'Redis reconnecting' });
    });
  }

  /**
   * Publish a validated incident to the Redis Stream.
   * The full incident is stored in the 'payload' field as JSON.
   * Flat fields (rule, severity, service) allow consumers to filter without deserialising.
   * @param {object} incident
   * @returns {Promise<string>} Redis stream entry ID
   */
  async publish(incident) {
    if (!this._client) {
      throw new Error('RedisStreamBus not connected');
    }

    return this._client.xadd(
      STREAM_KEY,
      'MAXLEN', '~', String(MAX_LEN),
      '*',
      'payload',  JSON.stringify(incident),
      'rule',     incident.rule_name,
      'severity', incident.severity,
      'service',  incident.service
    );
  }

  async disconnect() {
    if (this._client) {
      await this._client.quit();
      this._client = null;
      logger.info({ message: 'Redis disconnected' });
    }
  }
}

module.exports = RedisStreamBus;
