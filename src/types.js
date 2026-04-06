/**
 * @typedef {Object} DebaterConfig
 * @property {string} style - e.g. "aggressive", "analytical", etc.
 * @property {string} model - e.g. "claude-sonnet-4-20250514"
 * @property {string} position - "pro" or "con"
 */

/**
 * @typedef {Object} DebateConfig
 * @property {Object} topic - { id, title, pro, con }
 * @property {DebaterConfig} debaterA
 * @property {DebaterConfig} debaterB
 * @property {string} [debateId] - Optional unique ID for traceability
 */

/**
 * @typedef {Object} RoundScores
 * @property {number} argument - 1-10
 * @property {number} rhetoric - 1-10
 * @property {number} rebuttal - 1-10
 * @property {number} impact - 1-10
 */

export {};
