import { wrapEventCaller, wrapLLMEvent } from "@llamaindex/core/decorator";
import {
  ToolCallLLM,
  type BaseTool,
  type ChatMessage,
  type ChatResponse,
  type ChatResponseChunk,
  type LLMChatParamsNonStreaming,
  type LLMChatParamsStreaming,
  type LLMMetadata,
  type MessageType,
  type PartialToolCall,
  type ToolCallLLMMessageOptions,
} from "@llamaindex/core/llms";
import { extractText } from "@llamaindex/core/utils";
import { getEnv } from "@llamaindex/env";
import { Tokenizers } from "@llamaindex/env/tokenizers";
import type {
  ClientOptions as OpenAIClientOptions,
  OpenAI as OpenAILLM,
} from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionContentPart,
  ChatCompletionMessageToolCall,
  ChatCompletionRole,
  ChatCompletionSystemMessageParam,
  ChatCompletionTool,
  ChatCompletionToolMessageParam,
  ChatCompletionUserMessageParam,
} from "openai/resources/chat/completions";
import type {
  ChatCompletionMessageParam,
  ResponseFormatJSONObject,
  ResponseFormatJSONSchema,
} from "openai/resources/index.js";

export type RequestyAdditionalChatOptions = Omit<
  Partial<OpenAILLM.Chat.ChatCompletionCreateParams>,
  | "max_tokens"
  | "messages"
  | "model"
  | "temperature"
  | "top_p"
  | "stream"
  | "tools"
  | "toolChoice"
>;

export type RequestyAdditionalMetadata = {
  structuredOutput: boolean;
};

export type LLMInstance = Pick<OpenAILLM, "chat" | "apiKey" | "baseURL">;

export class Requesty extends ToolCallLLM<RequestyAdditionalChatOptions> {
  model: string;
  temperature: number;
  topP: number;
  maxTokens?: number | undefined;
  additionalChatOptions?: RequestyAdditionalChatOptions | undefined;

  // Requesty session params
  apiKey?: string | undefined = undefined;
  baseURL?: string | undefined = undefined;
  maxRetries: number;
  timeout?: number;
  additionalSessionOptions?:
    | undefined
    | Omit<Partial<OpenAIClientOptions>, "apiKey" | "maxRetries" | "timeout">;

  // use lazy here to avoid check API_KEY immediately
  lazySession: () => Promise<LLMInstance>;
  #session: Promise<LLMInstance> | null = null;
  get session() {
    if (!this.#session) {
      this.#session = this.lazySession();
    }
    return this.#session;
  }

  constructor(
    init?: Omit<Partial<Requesty>, "session"> & {
      session?: LLMInstance | undefined;
    },
  ) {
    super();

    this.model = init?.model ?? "openai/gpt-4o-mini";
    this.temperature = init?.temperature ?? 0.1;
    this.topP = init?.topP ?? 1;
    this.maxTokens = init?.maxTokens ?? undefined;

    this.maxRetries = init?.maxRetries ?? 10;
    this.timeout = init?.timeout ?? 60 * 1000; // Default is 60 seconds
    this.additionalChatOptions = init?.additionalChatOptions;
    this.additionalSessionOptions = init?.additionalSessionOptions;
    this.apiKey = init?.session?.apiKey ?? init?.apiKey;
    this.baseURL = init?.session?.baseURL ?? init?.baseURL;
    this.lazySession = async () =>
      init?.session ??
      import("openai").then(({ OpenAI }) => {
        return new OpenAI({
          apiKey: this.apiKey ?? getEnv("REQUESTY_API_KEY"),
          baseURL: this.baseURL ?? getEnv("REQUESTY_BASE_URL"),
          maxRetries: this.maxRetries,
          timeout: this.timeout!,
          ...this.additionalSessionOptions,
        });
      });
  }

  // Always return true for tool calling support since Requesty supports it
  get supportToolCall() {
    return true;
  }

  get metadata(): LLMMetadata & RequestyAdditionalMetadata {
    // Default context window for most models
    const contextWindow = 128000;
    return {
      model: this.model,
      temperature: this.temperature,
      topP: this.topP,
      maxTokens: this.maxTokens,
      contextWindow,
      tokenizer: Tokenizers.CL100K_BASE,
      structuredOutput: true,
    };
  }

  static toOpenAIRole(messageType: MessageType): ChatCompletionRole {
    switch (messageType) {
      case "user":
        return "user";
      case "assistant":
        return "assistant";
      case "system":
        return "system";
      case "developer":
        return "developer";
      default:
        return "user";
    }
  }

  static toOpenAIMessage(
    messages: ChatMessage<ToolCallLLMMessageOptions>[],
  ): ChatCompletionMessageParam[] {
    return messages.map((message) => {
      const options = message.options ?? {};
      if ("toolResult" in options) {
        return {
          tool_call_id: options.toolResult.id,
          role: "tool",
          content: extractText(message.content),
        } satisfies ChatCompletionToolMessageParam;
      } else if ("toolCall" in options) {
        return {
          role: "assistant",
          content: extractText(message.content),
          tool_calls: options.toolCall.map((toolCall) => {
            return {
              id: toolCall.id,
              type: "function",
              function: {
                name: toolCall.name,
                arguments:
                  typeof toolCall.input === "string"
                    ? toolCall.input
                    : JSON.stringify(toolCall.input),
              },
            };
          }),
        } satisfies ChatCompletionAssistantMessageParam;
      } else if (message.role === "user") {
        if (typeof message.content === "string") {
          return { role: "user", content: message.content };
        }

        return {
          role: "user",
          content: message.content.map((item, index) => {
            // Handle MessageContentMediaDetail (audio, video, image)
            if (
              "data" in item &&
              "mimeType" in item &&
              (item.type === "audio" ||
                item.type === "video" ||
                item.type === "image")
            ) {
              if (item.type === "audio" || item.type === "video") {
                throw new Error("Audio and video are not supported");
              }
              // Convert image type to file format for OpenAI
              return {
                type: "file",
                file: {
                  file_data: `data:${item.mimeType};base64,${item.data}`,
                  filename: `image-${index}.${item.mimeType.split("/")[1] || "png"}`,
                },
              } satisfies ChatCompletionContentPart.File;
            }

            if (item.type === "file") {
              if (item.mimeType !== "application/pdf") {
                throw new Error("Only PDF files are supported");
              }
              const base64Data = item.data;
              return {
                type: "file",
                file: {
                  file_data: `data:${item.mimeType};base64,${base64Data}`,
                  filename: `part-${index}.pdf`,
                },
              } satisfies ChatCompletionContentPart.File;
            }

            // Keep other types as is (text, image_url, etc.)
            return item;
          }) as ChatCompletionContentPart[],
        } satisfies ChatCompletionUserMessageParam;
      }

      const response:
        | ChatCompletionSystemMessageParam
        | ChatCompletionUserMessageParam
        | ChatCompletionMessageToolCall = {
        role: Requesty.toOpenAIRole(message.role) as never,
        content: extractText(message.content),
      };
      return response;
    });
  }

  chat(
    params: LLMChatParamsStreaming<
      RequestyAdditionalChatOptions,
      ToolCallLLMMessageOptions
    >,
  ): Promise<AsyncIterable<ChatResponseChunk<ToolCallLLMMessageOptions>>>;
  chat(
    params: LLMChatParamsNonStreaming<
      RequestyAdditionalChatOptions,
      ToolCallLLMMessageOptions
    >,
  ): Promise<ChatResponse<ToolCallLLMMessageOptions>>;
  @wrapEventCaller
  @wrapLLMEvent
  async chat(
    params:
      | LLMChatParamsNonStreaming<
          RequestyAdditionalChatOptions,
          ToolCallLLMMessageOptions
        >
      | LLMChatParamsStreaming<
          RequestyAdditionalChatOptions,
          ToolCallLLMMessageOptions
        >,
  ): Promise<
    | ChatResponse<ToolCallLLMMessageOptions>
    | AsyncIterable<ChatResponseChunk<ToolCallLLMMessageOptions>>
  > {
    const { messages, stream, tools, responseFormat, additionalChatOptions } =
      params;
    const baseRequestParams = <OpenAILLM.Chat.ChatCompletionCreateParams>{
      model: this.model,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      tools: tools?.map(Requesty.toTool),
      messages: Requesty.toOpenAIMessage(messages),
      top_p: this.topP,
      ...Object.assign({}, this.additionalChatOptions, additionalChatOptions),
    };

    if (
      Array.isArray(baseRequestParams.tools) &&
      baseRequestParams.tools.length === 0
    ) {
      // remove empty tools array to avoid OpenAI error
      delete baseRequestParams.tools;
    }

    //add response format for the structured output
    if (responseFormat && this.metadata.structuredOutput) {
      // Check if it's a ZodType by looking for its parse and safeParse methods
      if ("parse" in responseFormat && "safeParse" in responseFormat)
        baseRequestParams.response_format = zodResponseFormat(
          responseFormat,
          "response_format",
        );
      else {
        baseRequestParams.response_format = responseFormat as
          | ResponseFormatJSONObject
          | ResponseFormatJSONSchema;
      }
    }

    // Streaming
    if (stream) {
      return this.streamChat(baseRequestParams);
    }

    // Non-streaming
    const response = await (
      await this.session
    ).chat.completions.create({
      ...baseRequestParams,
      stream: false,
    });

    const content = response.choices[0]!.message?.content ?? "";

    return {
      raw: response,
      message: {
        content,
        role: response.choices[0]!.message.role,
        options: response.choices[0]!.message?.tool_calls
          ? {
              toolCall: response.choices[0]!.message.tool_calls.map(
                (toolCall) => ({
                  id: toolCall.id,
                  name: toolCall.function.name,
                  input: toolCall.function.arguments,
                }),
              ),
            }
          : {},
      },
    };
  }

  @wrapEventCaller
  protected async *streamChat(
    baseRequestParams: OpenAILLM.Chat.ChatCompletionCreateParams,
  ): AsyncIterable<ChatResponseChunk<ToolCallLLMMessageOptions>> {
    const stream: AsyncIterable<OpenAILLM.Chat.ChatCompletionChunk> = await (
      await this.session
    ).chat.completions.create({
      ...baseRequestParams,
      stream: true,
    });

    // this will be used to keep track of the current tool call, make sure input are valid json object.
    let currentToolCall: PartialToolCall | null = null;
    const toolCallMap = new Map<string, PartialToolCall>();
    for await (const part of stream) {
      if (part.choices.length === 0) {
        if (part.usage) {
          yield {
            raw: part,
            delta: "",
          };
        }
        continue;
      }
      const choice = part.choices[0]!;
      // skip parts that don't have any content
      if (
        !(
          choice.delta.content ||
          choice.delta.tool_calls ||
          choice.finish_reason
        )
      )
        continue;

      let shouldEmitToolCall: PartialToolCall | null = null;
      if (
        choice.delta.tool_calls?.[0]!.id &&
        currentToolCall &&
        choice.delta.tool_calls?.[0].id !== currentToolCall.id
      ) {
        try {
          shouldEmitToolCall = {
            ...currentToolCall,
            input: JSON.parse(currentToolCall.input),
          };
        } catch (e) {
          // Skip incomplete JSON during streaming
          continue;
        }
      }
      if (choice.delta.tool_calls?.[0]!.id) {
        currentToolCall = {
          name: choice.delta.tool_calls[0].function!.name!,
          id: choice.delta.tool_calls[0].id,
          input: choice.delta.tool_calls[0].function!.arguments!,
        };
        toolCallMap.set(choice.delta.tool_calls[0].id, currentToolCall);
      } else {
        if (choice.delta.tool_calls?.[0]!.function?.arguments) {
          currentToolCall!.input +=
            choice.delta.tool_calls[0].function.arguments;
        }
      }

      const isDone: boolean = choice.finish_reason !== null;

      if (isDone && currentToolCall) {
        // for the last one, we need to emit the tool call
        try {
          shouldEmitToolCall = {
            ...currentToolCall,
            input: JSON.parse(currentToolCall.input),
          };
        } catch (e) {
          // Skip incomplete JSON
          shouldEmitToolCall = null;
        }
      }

      yield {
        raw: part,
        options: shouldEmitToolCall
          ? { toolCall: [shouldEmitToolCall] }
          : currentToolCall
            ? {
                toolCall: [currentToolCall],
              }
            : {},
        delta: choice.delta.content ?? "",
      };
    }
    toolCallMap.clear();
    return;
  }

  static toTool(tool: BaseTool): ChatCompletionTool {
    return {
      type: "function",
      function: tool.metadata.parameters
        ? {
            name: tool.metadata.name,
            description: tool.metadata.description,
            parameters: tool.metadata.parameters,
          }
        : {
            name: tool.metadata.name,
            description: tool.metadata.description,
          },
    };
  }
}

/**
 * Convenience function to create a new Requesty instance.
 * @param init - Optional initialization parameters for the Requesty instance.
 * @returns A new Requesty instance.
 */
export const requesty = (init?: ConstructorParameters<typeof Requesty>[0]) =>
  new Requesty(init);
