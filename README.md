# Hedera Custodial Wallet with Telegram Bot

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![Hedera](https://img.shields.io/badge/Hedera-Hashgraph-00BFFF)
![Telegram Bot](https://img.shields.io/badge/Telegram-Bot-blue)
![HIP-991](https://img.shields.io/badge/HIP-991-green)
![HCS-10](https://img.shields.io/badge/HCS-10-orange)

A Hedera custodial wallet application with Telegram bot integration, offering comprehensive management of Hedera assets through a conversational interface, powered by the official Hedera Agent Kit and OpenAI.

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

### HIP-991, HCS-10, and Eliza Plugin Implementation

#### HIP-991 (Hedera Agent Protocol)

This project implements HIP-991 through the Hedera Agent Kit integration:

- Implementation: [src/agent/hedera-agent-kit-adapter.js](./src/agent/hedera-agent-kit-adapter.js)
- The Hedera Agent Kit provides a standardized interface for interacting with Hedera services
- Agent tools created in [src/agent/kit-manager.js](./src/agent/kit-manager.js)
- Natural language processing with kit integration in [src/agent/nlp-processor.js](./src/agent/nlp-processor.js)

Key features of our HIP-991 implementation:
- Standardized agent API for Hedera operations
- LangChain integration for natural language processing
- Tool-based architecture for modular functionality
- Agent operations using GPT-4o for accurate intent recognition

#### HCS-10 (Hedera Consensus Service Topic Management)

Our implementation follows the HCS-10 specification for topic management:

- Implementation: [src/hedera/topic-management.js](./src/hedera/topic-management.js)
- Topic creation with appropriate properties and permissions
- Structured message submission with consistent formats
- Topic ID resolution from human-readable identifiers
- Message retrieval and parsing according to the standard

#### Eliza Hedera Plugin

The project includes an Eliza plugin for interacting with Hedera services through natural language:

- Implementation: [src/plugins/eliza-plugin.js](./src/plugins/eliza-plugin.js)
- Compatible with ElizaOS Hedera plugin commands
- Leverages Mirror Node API for blockchain state queries
- Key capabilities:
  - Token information retrieval and display
  - Token holders lists with detailed balances
  - User token balance checks
  - Airdrop eligibility verification
  - Token association recommendations
  - Enhanced responses with HashScan links

The plugin follows similar patterns to the ElizaOS plugin for Hedera, allowing users to:

1. Query token information with commands like `information about token 0.0.12345`
2. Check token holders with `who owns token 0.0.12345`
3. View personal token balances with `what are my token balances`
4. Verify airdrop eligibility with `am I eligible for any airdrops`
5. Get recommended actions for token operations

All responses are formatted with Markdown and include HashScan links for verification.

### Deployment Information

This project is deployed on the Hedera Testnet. Key deployed artifacts:

1. **Tokens**: Multiple fungible tokens have been created for testing purposes
   - Example Token: [0.0.15784236](https://hashscan.io/testnet/token/0.0.15784236)

2. **HCS Topics**: Several consensus topics were created for messaging demonstration
   - Example Topic: [0.0.15784237](https://hashscan.io/testnet/topic/0.0.15784237)

3. **Wallet Accounts**: User wallets are created on Testnet
   - Operator Account: [0.0.14396235](https://hashscan.io/testnet/account/0.0.14396235)

4. **Telegram Bot**: The bot is active and accessible at [@YourBotName](https://t.me/YourBotName)

## Security

This wallet is **custodial**, which means that users' private keys are stored on the server. It is recommended to use this project only for demonstration purposes or for small amounts.

For production use, consider the following improvements:
- Private key encryption
- Multi-factor authentication
- Transaction limits
- Monitoring and alerts

## Contributing

Contributions are welcome! Feel free to submit a Pull Request or open an Issue for any suggestions or problems.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contact

For any questions or suggestions, please don't hesitate to contact us:
- Email: your.email@example.com
- GitHub: [your-github-name](https://github.com/your-github-name)

---

Developed with ❤️ for the Hedera community