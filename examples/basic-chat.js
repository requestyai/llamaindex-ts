import { requesty } from "llamaindex-requesty";

const llm = requesty({
  model: "openai/gpt-4o-mini",
  apiKey: process.env.REQUESTY_API_KEY,
  baseURL: process.env.REQUESTY_BASE_URL || "https://router.requesty.ai/v1"
});

async function basicChat() {
  console.log("🤖 Basic Chat Example");
  console.log("====================");

  const response = await llm.chat({
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Explain what TypeScript is in one paragraph." }
    ]
  });

  console.log("Response:", response.message.content);
}

basicChat().catch(console.error);
