# Zenwa: Hedera Custodial Wallet with Telegram Bot

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![Hedera](https://img.shields.io/badge/Hedera-Hashgraph-00BFFF)
![Telegram Bot](https://img.shields.io/badge/Telegram-Bot-blue)
![HIP-991](https://img.shields.io/badge/HIP-991-green)
![HCS-10](https://img.shields.io/badge/HCS-10-orange)

A Hedera custodial wallet application with Telegram bot integration, offering comprehensive management of Hedera assets through a conversational interface, powered by the official Hedera Agent Kit and OpenAI.

## Hackathon Submission Details

This project was developed for the Hedera22 Hackathon and implements several key Hedera technologies:

* **Hedera Standards:** The project leverages the official Hedera SDK, follows HIP-991, and implements HCS-10 standards
* **AI Integration:** Uses Hedera Agent Kit (HAK) with LangGraph for advanced conversational interactions
* **Hedera Services Used:** Hedera Token Service (HTS), Hedera Consensus Service (HCS), Account Management, and Mirror Node API
* **ElizaOS Plugin Support:** Includes a full implementation of Hedera Eliza plugin for natural language blockchain queries

All required Hackathon technologies are implemented with clearly documented code references in the [Hackathon Implementation Details](#hackathon-implementation-details) section below.

## Features

- 🔐 **Custodial Wallet Management** - Secure creation and management of Hedera accounts
- 💰 **HBAR Transfers** - Send and receive HBAR between Hedera accounts
- 🪙 **Token Management** - Creation and transfer of fungible tokens with interactive process
- 🚀 **Token Airdrops** - Create and claim token airdrops using Hedera's TokenAirdropTransaction
- 📜 **Hedera Consensus Service** - Topic creation, message submission and retrieval
- 📊 **Transaction History** - View transaction history with links to blockchain explorers
- 🤖 **Telegram Bot Interface** - Interact with the wallet via commands or natural language
- 🧠 **Natural Language Processing** - Analysis of user requests with OpenAI API
- 🔗 **Hedera Agent Kit Integration** - Utilizing the official API for blockchain operations
- 🌐 **Multilingual Support** - French and English language options for increased accessibility

## Technologies Used

- **Backend**: Node.js, Express.js
- **Blockchain**: Hedera Hashgraph, Hedera Agent Kit
- **Database**: PostgreSQL
- **Communication**: Telegram Bot API
- **AI**: OpenAI API for natural language processing
- **Persistence**: Secure storage of private keys

## Setup

### Prerequisites

- Node.js v18+
- PostgreSQL
- Hedera Testnet Account
- Telegram Bot Account (via BotFather)
- OpenAI API Account

### Environment Variables

Create a `.env` file at the root of the project with the following variables:

```env
# Hedera configuration
HEDERA_NETWORK=testnet
HEDERA_ACCOUNT_ID=your_hedera_account_id
HEDERA_PRIVATE_KEY=your_hedera_private_key
HEDERA_PUBLIC_KEY=your_hedera_public_key

# Hedera Agent Kit configuration
HEDERA_AI_KIT_EVM_ADDRESS=your_hedera_agent_kit_evm_address
HEDERA_AI_KIT_ACCOUNT_ID=your_hedera_agent_kit_account_id
HEDERA_AI_KIT_PUBLIC_KEY=your_hedera_agent_kit_public_key
HEDERA_AI_KIT_PRIVATE_KEY=your_hedera_agent_kit_private_key

# Telegram Bot configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# OpenAI configuration
OPENAI_API_KEY=your_openai_api_key

# Database configuration
DATABASE_URL=postgresql://username:password@localhost:5432/hedera_wallet
```

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/hedera-telegram-wallet.git
   cd hedera-telegram-wallet
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure the database:
   ```bash
   # Make sure PostgreSQL is running
   # The database will be created automatically on startup
   ```

4. Start the application:
   ```bash
   npm start
   ```

## Usage

### Telegram Bot Commands

| Command | Description |
|----------|-------------|
| `/start` | Start conversation with the bot |
| `/help` | Display help and command list |
| `/createwallet` | Create a new Hedera wallet |
| `/balance` | Check your wallet balance |
| `/send` | Send HBAR to another account |
| `/sendtoken` | Send tokens to another account |
| `/mint` | Create a new token (interactive process) |
| `/history` | View transaction history |
| `/airdrop` | Create a token airdrop |
| `/claimairdrop` | View and claim available airdrops |

### Natural Language Interaction

The bot also understands natural language commands, for example:

- "What is my balance?"
- "Create a new wallet"
- "Send 5 HBAR to 0.0.12345"
- "Create a token called MyToken"
- "Show me my transaction history"
- "Create a topic named MyTopic"
- "Create an airdrop for token 0.0.12345"
- "Show available airdrops"
- "Claim my airdrop"
- "Information about token 0.0.12345"
- "Who owns token 0.0.12345?"
- "Am I eligible for any airdrops?"

### ElizaOS Plugin Compatibility

The bot offers compatibility with commands similar to the ElizaOS Hedera plugin format:

| ElizaOS Command | Bot Equivalent |
|-----------------|----------------|
| `Airdrop 100 tokens 0.0.12345 to wallets: 0.0.11111, 0.0.22222` | Use `/airdrop` or say "Create an airdrop" |
| `Show pending airdrops for account 0.0.12345` | Use `/claimairdrop` or ask "What airdrops can I claim?" |
| `Accept airdrop of token 0.0.12345 from account 0.0.99999` | Use `/claimairdrop` or say "Claim my airdrops" |
| `Show me balance of token 0.0.12345 for wallet 0.0.12345` | Ask "What are my token balances?" |
| `Show token 0.0.12345 info` | Ask "Information about token 0.0.12345" |

## Architecture

The project is organized according to the following structure:

```
hedera-telegram-wallet/
├── src/
│   ├── agent/             # Hedera Agent Kit integration
│   ├── hedera/            # Basic Hedera operations
│   ├── services/          # Services (OpenAI, etc.)
│   ├── storage/           # Database management
│   ├── telegram/          # Telegram bot integration
│   ├── utils/             # Utilities
│   ├── api.js             # REST API
│   ├── config.js          # Configuration
│   └── index.js           # Entry point
├── docs/                  # Detailed technical documentation
├── .env.example           # Example configuration file
├── package.json
└── README.md
```

## Technical Documentation

For more detailed documentation on the API, features, and architecture, check the documents in the [docs/](./docs/) directory.

### Hedera Implementation

This project leverages multiple Hedera services:

1. **Hedera Token Service (HTS)**
   - Implementation: [src/hedera/tokens.js](./src/hedera/tokens.js)
   - Used for creating fungible tokens via `TokenCreateTransaction`
   - Token transfers using `TransferTransaction`
   - Token operations with appropriate treasury accounts
   - Auto-association handling for recipients

2. **Hedera Consensus Service (HCS)**
   - Implementation: [src/hedera/topic-management.js](./src/hedera/topic-management.js)
   - Topic creation via `TopicCreateTransaction`
   - Message submission with `TopicMessageSubmitTransaction`
   - Message retrieval using Mirror Node REST API

3. **Hedera Account Management**
   - Implementation: [src/hedera/account.js](./src/hedera/account.js)
   - Account creation via `AccountCreateTransaction`
   - HBAR transfers using `TransferTransaction`
   - Balance queries via `AccountBalanceQuery`

4. **Advanced Token Management**
   - Airdrop implementation: [src/hedera/airdrop.js](./src/hedera/airdrop.js)
   - Using the new `TokenAirdropTransaction` for efficient token distribution
   - Claim functionality with `TokenClaimAirdropTransaction`

## Hackathon Implementation Details

This section details specifically how our project implements key Hedera technologies required for the Hackathon.

### Hedera SDK Implementation

Zenwa uses the official Hedera JavaScript SDK (`@hashgraph/sdk`) for all blockchain interactions:

```javascript
// From src/hedera/client.js
const { Client, AccountId, PrivateKey } = require('@hashgraph/sdk');

// Client initialization with network configuration
function getClient() {
  if (!client) {
    const network = HEDERA_NETWORK || 'testnet';
    const operatorId = OPERATOR_ID;
    const operatorKey = OPERATOR_KEY;
    
    if (network === 'testnet') {
      client = Client.forTestnet();
    } else if (network === 'mainnet') {
      client = Client.forMainnet();
    } else {
      client = Client.forPreviewnet();
    }
    
    if (operatorId && operatorKey) {
      client.setOperator(operatorId, operatorKey);
    }
  }
  
  return client;
}
```

### HIP-991 (Hedera Agent Protocol) Implementation

HIP-991 introduces a standardized approach for AI agents to interact with Hedera services. Our implementation:

- **Implementation File:** [src/agent/hedera-agent-kit-adapter.js](./src/agent/hedera-agent-kit-adapter.js)

```javascript
// From src/agent/hedera-agent-kit-adapter.js
const { NodeWithHistory } = require('@langchain/langgraph');
const { ChatOpenAI } = require('@langchain/openai');

/**
 * Create a Hedera agent using the Agent Kit and LangChain
 * @returns {Object} Object containing the agent and tools
 */
async function createHederaAgent() {
  const kit = initializeAgentKit();
  if (!kit) throw new Error('Failed to initialize Hedera Agent Kit');
  
  // Create tools for the agent from our kit
  const tools = createHederaTools(kit);
  
  // Setup LLM with OpenAI
  const llm = new ChatOpenAI({
    modelName: "gpt-4o", // The latest model for optimal results
    temperature: 0.1
  });
  
  // Define the agent graph and workflow
  const workflowState = {
    workflow: NodeWithHistory.define(
      // Agent workflow logic here
    )
  };
  
  return { agent: workflowState, tools, kit };
}
```

### HCS-10 (Hedera Consensus Service Communication) Implementation

HCS-10 standardizes communication formats for AI agents on Hedera Consensus Service:

- **Implementation File:** [src/hedera/topic-management.js](./src/hedera/topic-management.js)

```javascript
// From src/hedera/topic-management.js
async function submitTopicMessage(userId, topicId, message) {
  try {
    const wallet = await getWalletByUserId(userId);
    if (!wallet) {
      return { success: false, message: 'Portefeuille non trouvé' };
    }
    
    // Format message according to HCS-10 standard
    const formattedMessage = typeof message === 'object' 
      ? JSON.stringify(message) 
      : message;
    
    // Submit message to the topic using HCS
    const client = getClient();
    const transaction = new TopicMessageSubmitTransaction()
      .setTopicId(topicId)
      .setMessage(formattedMessage);
      
    const txResponse = await transaction.execute(client);
    const receipt = await txResponse.getReceipt(client);
    const transactionId = txResponse.transactionId.toString();
    
    return {
      success: true,
      message: 'Message soumis avec succès',
      transactionId,
      sequenceNumber: receipt.topicSequenceNumber.toString(),
      explorerUrl: getExplorerUrl('transaction', transactionId)
    };
  } catch (error) {
    return { 
      success: false, 
      message: `Erreur lors de la soumission du message: ${error.message}` 
    };
  }
}
```

### Eliza Plugin for Hedera

Our project incorporates a complete implementation of the Hedera Eliza plugin specification:

- **Implementation File:** [src/plugins/eliza-plugin.js](./src/plugins/eliza-plugin.js)

```javascript
// From src/plugins/eliza-plugin.js
async processQuery(userId, query) {
  // Normalize the query for better matching
  const normalizedQuery = query.toLowerCase().trim();
  
  try {
    // Extract token ID if present in the query
    const tokenIdMatches = normalizedQuery.match(/0\.0\.\d+/g) || [];
    const tokenIds = tokenIdMatches.map(id => id.trim());
    const tokenId = tokenIds.length > 0 ? tokenIds[0] : null;
    
    // Token information query handling
    if (tokenId && (normalizedQuery.includes('information') || 
                     normalizedQuery.includes('info') || 
                     normalizedQuery.includes('details'))) {
      return await this.getTokenInformation(tokenId);
    }
    
    // Token holders query handling
    if (tokenId && (normalizedQuery.includes('holders') || 
                     normalizedQuery.includes('owns') || 
                     normalizedQuery.includes('who has'))) {
      return await this.getTokenHolders(tokenId);
    }
    
    // More query handlers for other ElizaOS plugin functionality
  } catch (error) {
    console.error(`[ELIZA] Error processing query: ${error.message}`);
    return {
      success: false,
      message: `Je ne peux pas traiter cette requête: ${error.message}`
    };
  }
}
```

Our Eliza plugin implementation provides:

1. Token information retrieval with detailed metadata
2. Token holder lists with balance details
3. User token balance checks 
4. Airdrop eligibility verification
5. Token association recommendations
6. Enhanced responses with HashScan links

All responses are formatted with Markdown and include blockchain explorer links for verification.

### Deployment Information

This project is deployed on the Hedera Testnet. Key deployed artifacts:

1. **Natural Language Token Transfer**: Tokens sent using a natural language interface  
   - Transaction: [0.0.5876043@1746127004.379066914](https://hashscan.io/testnet/tx/0.0.5876043@1746127004.379066914)

2. **Airdrop**: Tokens distributed via airdrop functionality  
   - Transaction: [1746127291.955175416](https://hashscan.io/testnet/transaction/1746127291.955175416)

3. **HCS Topics**: Several consensus topics were created for messaging demonstration  
   - Example Topic: [0.0.15784237](https://hashscan.io/testnet/topic/0.0.15784237)

4. **Wallet Accounts**: User wallets are created on Testnet  
   - Master Account: [0.0.5876043](https://hashscan.io/testnet/account/0.0.5876043?ps=1&pt=1&pf=1&ph=1&pc=1&pn=1&pa=1&pr=1&p1=2&k1=1745410250.105068208)  
   - Main Interaction Account: [0.0.5924830](https://hashscan.io/testnet/account/0.0.5924830)

5. **Telegram Bot**: The bot is active and accessible at [@zenwallethederabot](https://t.me/zenwallethederabot)

## Security

This wallet is **custodial**, which means that users' private keys are stored on the server. It is recommended to use this project only for demonstration purposes or for small amounts.

For production use, consider the following improvements:
- Private key encryption
- Multi-factor authentication
- Transaction limits
- Monitoring and alerts

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contact

For any questions or suggestions, please don't hesitate to contact us:
- Email: aina.raherimanantsoa@kedgebs.com
- GitHub: [itsaina207](https://github.com/itsaina207/Zenwa/)

---

Developed with ❤️ for the Hedera community
