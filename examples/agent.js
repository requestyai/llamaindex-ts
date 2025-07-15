import { config } from "dotenv";
import { requesty } from "@requesty/llamaindex";
import { agent } from "@llamaindex/workflow";
import { tool } from "llamaindex";
import { z } from "zod";

async function agentWorkflow() {
  console.log("🤖 Agent Workflow Example");
  console.log("=========================\n");

  config();

  console.log("📚 Setting up LLM configuration...");
  const llm = requesty({
    model: "openai/gpt-4o-mini",
  });

  console.log("\n🔧 Creating calculator tool...");
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


  console.log("\n🚀 Initializing math agent...");
  const mathAgent = agent({
    name: "MathAgent",
    description: "A helpful math assistant that can perform calculations",
    systemPrompt: "You are a math expert. Use the calculator tool to help solve problems accurately.",
    tools: [calculatorTool],
    llm,
  });

  console.log("\n💬 Running query: 'What is 15 times 24, and then subtract 50 from the result?'");
  const result = await mathAgent.run(
    "What is 15 times 24, and then subtract 50 from the result?"
  );

  console.log("\n📊 Agent Response:");
  console.log(result.toJSON());

  console.log("\n🎉 Agent workflow completed successfully!");
}

agentWorkflow().catch((error) => {
  console.error("❌ Error occurred:", error);
  process.exit(1);
});
