import { requesty } from "llamaindex-requesty";
import { agent } from "@llamaindex/workflow";
import { tool } from "llamaindex";
import { z } from "zod";

// Agent workflow example with tool calling
const llm = requesty({
  model: "openai/gpt-4o-mini",
  apiKey: process.env.REQUESTY_API_KEY,
  baseURL: process.env.REQUESTY_BASE_URL || "https://router.requesty.ai/v1"
});

// Define a simple calculator tool
const calculatorTool = tool({
  name: "calculate",
  description: "Perform basic arithmetic operations",
  parameters: z.object({
    operation: z.enum(["add", "subtract", "multiply", "divide"]),
    a: z.number().describe("First number"),
    b: z.number().describe("Second number")
  }),
  execute: ({ operation, a, b }) => {
    switch (operation) {
      case "add": return a + b;
      case "subtract": return a - b;
      case "multiply": return a * b;
      case "divide": return b !== 0 ? a / b : "Cannot divide by zero";
      default: return "Unknown operation";
    }
  }
});

async function agentWorkflow() {
  console.log("🤖 Agent Workflow Example");
  console.log("=========================");

  const mathAgent = agent({
    name: "MathAgent",
    description: "A helpful math assistant that can perform calculations",
    systemPrompt: "You are a math expert. Use the calculator tool to help solve problems accurately.",
    tools: [calculatorTool],
    llm,
  });

  const result = await mathAgent.run(
    "What is 15 times 24, and then subtract 50 from the result?"
  );

  console.log("Agent Response:", result);
}

agentWorkflow().catch(console.error);
