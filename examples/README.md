# LlamaIndex-TS Examples

This directory contains examples demonstrating how to use the `llamaindex-requesty` adapter.

## Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/requestyai/llamaindex-ts.git
   cd llamaindex-ts/examples
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and add your Requesty API key.

4. **Run an example**
   ```bash
   npm run basic-chat
   # or
   npm run agent-workflow
   ```

## Available Examples

### Basic Chat (`basic-chat.js`)
A simple chat example showing how to use the Requesty adapter for basic LLM interactions.

```bash
npm run basic-chat
```

### Agent Workflow (`agent-workflow.js`)
Demonstrates an AI agent with tool calling capabilities, including a calculator tool.

```bash
npm run agent-workflow
```

## Environment Variables

- `REQUESTY_API_KEY` - Your Requesty API key (required)
- `REQUESTY_BASE_URL` - Base URL for Requesty API (optional, defaults to `https://router.requesty.ai/v1`)

## Getting a Requesty API Key

Visit [requesty.ai](https://requesty.ai) to sign up and get your API key.