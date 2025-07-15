import {
  agent,
  agentToolCallEvent,
  agentToolCallResultEvent,
  multiAgent,
} from "@llamaindex/workflow";
import fs from "fs";
import { tool } from "llamaindex";
import os from "os";
import { z } from "zod";
import { requesty } from "@requesty/llamaindex";
import { config } from "dotenv";

import { wiki } from "@llamaindex/tools";

async function main() {
  console.log("🤖 Multi-Agent Workflow Example");
  console.log("===============================\n");

  config();

  console.log("📚 Setting up LLM configuration...");
  const llm = requesty({
    model: "openai/gpt-4o-mini",
  });

  console.log("\n🔧 Creating file save tool...");
  const saveFileTool = tool({
    name: "saveFile",
    description:
      "Save the written content into a file that can be downloaded by the user",
    parameters: z.object({
      content: z.string({
        description: "The content to save into a file",
      }),
    }),
    execute: ({ content }) => {
      const filePath = os.tmpdir() + "/report.md";
      fs.writeFileSync(filePath, content);
      return `File saved successfully at ${filePath}`;
    },
  });

  console.log("\n🚀 Initializing report agent...");
  const reportAgent = agent({
    name: "ReportAgent",
    description:
      "Responsible for crafting well-written blog posts based on research findings",
    systemPrompt: `You are a professional writer. Your task is to create an engaging blog post using the research content provided. Once complete, save the post to a file using the saveFile tool.`,
    tools: [saveFileTool],
    llm,
  });

  console.log("\n🔍 Initializing research agent...");
  const researchAgent = agent({
    name: "ResearchAgent",
    description:
      "Responsible for gathering relevant information from the internet",
    systemPrompt: `You are a research agent. Your role is to gather information from the internet using the provided tools and then transfer this information to the report agent for content creation.`,
    tools: [wiki()],
    canHandoffTo: [reportAgent],
    llm,
  });

  console.log("\n⚡ Setting up multi-agent workflow...");
  const workflow = multiAgent({
    agents: [researchAgent, reportAgent],
    rootAgent: researchAgent,
  });

  console.log("\n💬 Starting workflow: 'Write a blog post about history of LLM'");
  const events = workflow.runStream("Write a blog post about history of LLM");

  console.log("\n📊 Processing workflow events...");
  let finalResult;
  for await (const event of events) {
    if (agentToolCallEvent.include(event)) {
      console.log(
        `🔧 [Agent ${event.data.agentName}] executing tool ${event.data.toolName} with parameters ${JSON.stringify(
          event.data.toolKwargs,
        )}`,
      );
    } else if (agentToolCallResultEvent.include(event)) {
      console.log(
        `✅ [Tool ${event.data.toolName}] executed with result ${event.data.toolOutput.result}`,
      );
    }
    finalResult = event;
  }

  console.log("\n📋 Final result:", finalResult?.data);
}

main().catch((error) => {
  console.error("❌ Error occurred:", error);
  process.exit(1);
});

