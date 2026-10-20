/**
 * The one place that knows which database is production.
 *
 * Three guards refused it independently by matching the literal
 * `ep-wandering-hall`: this preload, `apply-migration.mjs`, and the
 * integration test setup. Three copies of one fact means that if the endpoint
 * ever moves, all three stop protecting at the same moment and none of them
 * says so — the scripts keep running, just against the wrong database.
 *
 * Overridable, because an endpoint is deployment configuration rather than
 * something source should pin forever:
 *
 *   LERNIQO_PRODUCTION_HOST=ep-something-else
 */
const PRODUCTION_HOST =
  process.env.LERNIQO_PRODUCTION_HOST || 'ep-wandering-hall';

/** True when this connection string names the production database. */
function isProduction(connectionString) {
  return new RegExp(PRODUCTION_HOST).test(String(connectionString || ''));
}

/** The host part of a connection string, for logging without the credentials. */
function hostOf(connectionString) {
  const match = String(connectionString || '').match(/@([^/]+)\//);
  return match ? match[1] : '(none)';
}

module.exports = { PRODUCTION_HOST, isProduction, hostOf };
