# Eliza Plugin for Hedera

## Overview

The Eliza plugin for Hedera provides natural language processing capabilities for interacting with the Hedera network. It enables users to query blockchain state, retrieve token information, and check eligibility for airdrops using natural language commands.

## Implementation

The plugin is implemented in `src/plugins/eliza-plugin.js` and has the following components:

1. **ElizaHederaPlugin Class**: Core implementation of the plugin functionality
2. **Query Detection System**: Pattern matching for identifying user intent
3. **Blockchain Query Functions**: Interactions with Hedera for retrieving data
4. **Response Formatting**: Markdown-formatted responses with HashScan links

## Features

### Token Information Queries

Users can retrieve detailed information about tokens with natural language queries:

```
Information about token 0.0.12345
```

The system will:
- Validate the token ID format
- Query the Mirror Node API for token information
- Format the response with details such as:
  - Token name and symbol
  - Total supply
  - Treasury account
  - Creation and modification timestamps
  - Custom fees configuration
  - Pause status
- Include a HashScan link for verification

### Token Holders Queries

Users can check who owns a specific token:

```
Who owns token 0.0.12345?
Liste des détenteurs du token 0.0.12345
```

The system will:
- Query the Mirror Node API for token balances
- Return a list of up to 10 holders (to avoid excessive response size)
- Show the total number of holders
- Include a HashScan link to view all holders

### User Token Balances

Users can check their own token balances:

```
What are my token balances?
Quels sont mes tokens?
```

The system will:
- Retrieve the user's wallet information
- Query the account balance using Hedera SDK
- Format a list of all tokens and their balances
- Include HashScan links for each token
- Show the HBAR balance as well

### Airdrop Eligibility

Users can check if they're eligible for any airdrops:

```
Am I eligible for any airdrops?
Suis-je éligible pour un airdrop?
```

The system will:
- Check if the user has a wallet
- Query available airdrops for the user
- List eligible airdrops with token IDs and amounts
- Provide instructions on how to claim them

## ElizaOS Plugin Compatibility

The plugin's query detection system is designed to be compatible with commands similar to those used with the ElizaOS Hedera plugin:

### Airdrop Commands

When users enter airdrop commands in ElizaOS format:

```
Airdrop 100 tokens 0.0.12345 to wallets: 0.0.11111, 0.0.22222
```

The system will direct them to use the bot's `/airdrop` command with equivalent functionality.

### Pending Airdrop Queries

When users ask about pending airdrops:

```
Show pending airdrops for account 0.0.12345
```

The system will direct them to use the bot's `/claimairdrop` command.

### Balance Queries

When users ask for specific token balances:

```
Show me balance of token 0.0.12345 for wallet 0.0.11111
```

The system will provide the information or redirect them to HashScan for detailed balance information.

## Multilingual Support

The plugin supports both English and French languages, with translated responses and command detection patterns for:

- Token information queries
- Token holders queries
- Balance queries
- Airdrop eligibility queries

## Integration with Other Bot Components

The Eliza plugin integrates with:

1. **Telegram Bot**: All natural language queries from Telegram are processed through the plugin
2. **OpenAI Service**: For more complex queries, the plugin results can be enhanced with OpenAI output
3. **Storage Module**: For retrieving user wallet information and airdrop eligibility
4. **Mirror Node API**: For efficient blockchain state queries without requiring signatures
5. **Hedera SDK**: For account balance queries and other operations requiring authentication

## Future Enhancements

Planned improvements include:

1. **Token Rejection**: Adding the ability to reject tokens through natural language commands
2. **Enhanced Query Detection**: Additional pattern matching for more flexible commands
3. **Context Awareness**: Remembering previous queries to support follow-up questions
4. **Support for NFTs**: Extending the plugin to handle non-fungible token queries
5. **Token Associations**: Natural language interface for associating and dissociating tokens