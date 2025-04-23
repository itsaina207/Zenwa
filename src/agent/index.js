/**
 * Agent module exports
 */

const { getAgent } = require('./hedera-agent');
const { processNaturalLanguageCommand } = require('./nlp-processor');

module.exports = {
  getAgent,
  processNaturalLanguageCommand
};