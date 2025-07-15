import { config } from "dotenv";
import { requesty } from "@requesty/llamaindex";

async function basicChat() {
  console.log("🤖 Basic Chat Example");
  console.log("====================\n");

  config();

  console.log("📚 Setting up LLM configuration...");
  const llm = requesty({
    model: "openai/gpt-4o-mini",
  });

  console.log("\n💬 Preparing chat messages...");
  const messages = [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Explain what TypeScript is in one paragraph." }
  ];

  console.log("\n🚀 Sending chat request...");
  const response = await llm.chat({ messages });

  console.log("\n📊 LLM Response:");
  console.log(response.message.content);
}

basicChat().catch((error) => {
  console.error("❌ Error occurred:", error);
  process.exit(1);
});
