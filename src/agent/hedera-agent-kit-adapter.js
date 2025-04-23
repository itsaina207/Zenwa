/**
 * Hedera Agent Kit Adapter
 * Integrates Hedera Agent Kit with our existing agent infrastructure
 */

const { Client } = require('@hashgraph/sdk');
const HederaAgentKit = require('hedera-agent-kit');
const { createHederaTools } = require('hedera-agent-kit');
const { NodeWithHistory } = require('@langchain/langgraph');
const { ChatOpenAI } = require('@langchain/openai');
const { ChatPromptTemplate } = require('@langchain/core/prompts');
const { config } = require('../config');

// Get Hedera credentials from config
const accountId = config.HEDERA_AI_KIT_ACCOUNT_ID;
const privateKey = config.HEDERA_AI_KIT_PRIVATE_KEY;
const network = config.HEDERA_NETWORK || 'testnet';

// Global instance of the kit
let agentKit = null;

/**
 * Initialize the Hedera Agent Kit
 * @returns {HederaAgentKit} initialized agent kit
 */
function initializeAgentKit() {
  if (agentKit) return agentKit;

  try {
    // Create a new instance of the kit
    agentKit = new HederaAgentKit(accountId, privateKey, network);
    console.log('Hedera Agent Kit initialized successfully');
    return agentKit;
  } catch (error) {
    console.error(`Failed to initialize Hedera Agent Kit: ${error.message}`);
    throw error;
  }
}

/**
 * Create a Hedera agent using the Agent Kit and LangChain
 * @returns {Object} Object containing the agent and tools
 */
async function createHederaAgent() {
  try {
    // Initialize the agent kit
    const kit = initializeAgentKit();
    
    // Create LLM using OpenAI
    const llm = new ChatOpenAI({
      openAIApiKey: config.OPENAI_API_KEY,
      temperature: 0,
      model: 'gpt-4o',
    });
    
    // Create Hedera tools using the agent kit
    const hederaTools = createHederaTools({
      hederaClient: Client.forTestnet(),
      operatorId: accountId,
      operatorKey: privateKey,
    });
    
    // Define the system message for the agent
    const systemMessage = `
      You are a helpful financial assistant for the Hedera blockchain.
      
      You can help users with:
      - Creating tokens (both fungible and non-fungible)
      - Transferring tokens and HBAR
      - Checking account balances
      - Viewing transaction history
      
      Always respond to the user's request in the same language they used.
      When reporting financial information, be precise with numbers and units.
      
      The user may reference tokens by name, symbol, or ID. If they use a name or symbol,
      you should attempt to resolve it to the correct token ID.
    `;
    
    // Create the chat prompt
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", systemMessage],
      ["human", "{input}"],
    ]);
    
    // Create a simple agent graph
    const graph = new NodeWithHistory({
      llm,
      tools: hederaTools,
      prompt,
    });
    
    return {
      agent: graph,
      tools: hederaTools,
    };
  } catch (error) {
    console.error(`Failed to create Hedera agent: ${error.message}`);
    throw error;
  }
}

/**
 * Process a natural language command using the Hedera Agent Kit
 * @param {string} userId - User identifier
 * @param {string} message - Natural language command
 * @returns {Promise<object>} Result of command execution
 */
async function processCommand(userId, message) {
  try {
    // Create or get the agent
    const { agent } = await createHederaAgent();
    
    // Call the agent with the message
    const result = await agent.invoke({
      input: message,
      userId: userId,
    });
    
    // Convert the result into our expected format
    const processedResult = {
      success: true,
      message: result.response || result.output,
      action: determineAction(result),
      data: result.data || {},
    };
    
    return processedResult;
  } catch (error) {
    console.error(`Error processing command with Hedera Agent Kit: ${error.message}`);
    return {
      success: false,
      message: `Une erreur est survenue lors du traitement de votre commande: ${error.message}`,
      action: 'error',
      data: {},
    };
  }
}

/**
 * Determine the action type from the agent result
 * @param {object} result - Result from the agent
 * @returns {string} Action type
 */
function determineAction(result) {
  // Default action is 'unknown'
  let action = 'unknown';
  
  // Try to determine the action from the result
  if (result.toolCalls && result.toolCalls.length > 0) {
    const toolName = result.toolCalls[0].name;
    
    // Map tool names to our action types
    const toolToActionMap = {
      'getHbarBalance': 'balance',
      'getHtsBalance': 'balance',
      'getAllTokensBalances': 'balance',
      'transferHbar': 'send_hbar',
      'transferToken': 'send_token',
      'createFT': 'mint_token',
      'createNFT': 'mint_token',
      'getPendingAirdrops': 'history',
      'getTopicMessages': 'history',
      'getTokenHolders': 'token_info',
    };
    
    action = toolToActionMap[toolName] || 'unknown';
  }
  
  return action;
}

/**
 * Get the Hedera Agent Kit instance
 * @returns {HederaAgentKit|null} Kit instance or null if not initialized
 */
function getAgentKit() {
  return agentKit;
}

module.exports = {
  initializeAgentKit,
  createHederaAgent,
  processCommand,
  getAgentKit,
};