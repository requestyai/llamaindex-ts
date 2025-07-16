# LlamaIndex Requesty Provider

A LlamaIndex.TS provider to use with Requesty - a gateway that makes it easier to integrate, manage and scale AI.

## 🚀 Features

- **Use any model from any provider**: OpenAI, Anthropic, Gemini, Deepseek, xAI, and any other model provider via a single API.
- **Support for all features**: Streaming, tools, structured output and thinking across all providers.
- **Powerful telemetry and analytics**: Monitor and analyze your AI usage via the Requesty platform.

## 📦 Installation

```bash
# For pnpm
pnpm add @requesty/llamaindex

# For npm
npm install @requesty/llamaindex

# For yarn
yarn add @requesty/llamaindex
```

## 🔧 Basic Usage

Find the complete list of models [here](https://www.requesty.ai/solution/llm-routing/models).

```javascript
import { requesty } from "@requesty/llamaindex";

const llm = requesty({
  model: "openai/gpt-4o-mini",
  apiKey: process.env.REQUESTY_API_KEY
});

// Use with any LlamaIndex.TS component
const response = await llm.chat({
  messages: [{ role: "user", content: "Hello!" }]
});
```

## 🤖 Agent Workflows

Perfect for building agents with tool calling:

```javascript
import { requesty } from "@requesty/llamaindex";
import { agent } from "@llamaindex/workflow";
import { tool } from "llamaindex";
import { z } from "zod";

const llm = requesty({
  model: "openai/gpt-4o-mini",
  apiKey: process.env.REQUESTY_API_KEY
});

const searchTool = tool({
  name: "search",
  description: "Search the web for information",
  parameters: z.object({
    query: z.string().describe("Search query")
  }),
  execute: async ({ query }) => {
    // Your search implementation
    return `Results for: ${query}`;
  }
});

const searchAgent = agent({
  name: "SearchAgent",
  description: "Helpful search assistant",
  tools: [searchTool],
  llm,
});

const result = await searchAgent.run("Find information about TypeScript");
```

## 🏗️ Multi-Agent Systems

```javascript
import { multiAgent } from "@llamaindex/workflow";

const researchAgent = agent({
  name: "ResearchAgent",
  tools: [wikipediaTool],
  llm,
});

const writerAgent = agent({
  name: "WriterAgent",
  tools: [saveFileTool],
  canHandoffTo: [researchAgent],
  llm,
});

const workflow = multiAgent({
  agents: [researchAgent, writerAgent],
  rootAgent: researchAgent,
});

const events = workflow.runStream("Write a blog post about AI");
for await (const event of events) {
  console.log(event);
}
```

## 🎯 Structured Outputs

Support for Zod schemas and JSON response formats:

```javascript
import { z } from "zod";

const PersonSchema = z.object({
  name: z.string(),
  age: z.number(),
  occupation: z.string()
});

const response = await llm.chat({
  messages: [{
    role: "user",
    content: "Tell me about a fictional character"
  }],
  responseFormat: PersonSchema
});

// Response will be typed and validated
const person = response.message.content; // Type: { name: string, age: number, occupation: string }
```

## 🔄 Streaming

```javascript
const stream = await llm.chat({
  messages: [{ role: "user", content: "Write a story" }],
  stream: true
});

for await (const chunk of stream) {
  process.stdout.write(chunk.delta);
}
```

## 🛠️ Tool calling

```javascript
const toolResponse = await llm.chat({
  messages: [{ role: "user", content: "Search for TypeScript tutorials" }],
  tools: [searchTool]
});

if (toolResponse.message.options?.toolCall) {
  for (const toolCall of toolResponse.message.options.toolCall) {
    console.log(`Calling ${toolCall.name} with:`, toolCall.input);
  }
}
```

## ⭐ Support

If this package helps you, please consider giving it a star on GitHub!
