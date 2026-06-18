/**
 * queryInstant fetches a single scalar/vector result from the Prometheus instant query API.
 * Returns the first result's numeric value, or null if there is no data or the value is NaN.
 * Throws on HTTP errors or Prometheus-level errors.
 *
 * @param {string} baseUrl  e.g. http://prometheus.monitoring.svc.cluster.local:9090
 * @param {string} query    PromQL expression
 * @returns {Promise<number|null>}
 */
async function queryInstant(baseUrl, query) {
  const url = `${baseUrl}/api/v1/query?query=${encodeURIComponent(query)}`;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(10_000)
  });

  if (!response.ok) {
    throw new Error(`Prometheus returned ${response.status} for query: ${query}`);
  }

  const json = await response.json();

  if (json.status !== 'success') {
    throw new Error(`Prometheus query error: ${json.error}`);
  }

  const { resultType, result } = json.data;

  if (!result || result.length === 0) {
    return null;
  }

  const raw = resultType === 'scalar' ? result[1] : result[0]?.value?.[1];

  if (raw === undefined || raw === null) {
    return null;
  }

  const parsed = parseFloat(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

module.exports = { queryInstant };
