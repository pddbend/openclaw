/**
 * Tool Result Vector Extension
 *
 * Captures tool execution results, generates summaries via LLM,
 * stores them in a vector database, and retrieves relevant results
 * for future tasks.
 *
 * This extension follows the OpenClaw embedded extension pattern:
 * 1. Runtime state is set via setToolResultVectorRuntime before session starts
 * 2. Extension reads runtime state to get configuration and services
 * 3. Extension hooks into tool_result and before_agent_start events
 */

import type { TextContent, ImageContent } from "@mariozechner/pi-ai";
import type {
  ExtensionAPI,
  ExtensionContext,
  ToolResultEvent,
} from "@mariozechner/pi-coding-agent";
import type { OpenClawConfig } from "../../../config/config.js";
import type { EmbeddingProvider } from "../../../memory/embeddings.js";
import type { ToolResultVectorConfig, ToolResultVectorRuntimeValue } from "./types.js";
import { createEmbeddingProvider } from "../../../memory/embeddings.js";
import { createRetriever, buildSearchQuery } from "./retriever.js";
import { getToolResultVectorRuntime, updateToolResultVectorRuntime } from "./runtime.js";
import { ToolResultVectorStore } from "./store.js";
import { createSummarizer, createLLMClient } from "./summarizer.js";
import { makeToolFilterPredicate, estimateContentLength } from "./tools.js";

/**
 * Cached services per runtime.
 */
const serviceCache = new WeakMap<
  object,
  {
    store: ToolResultVectorStore;
    embeddings: EmbeddingProvider;
    shouldProcess: (toolName: string) => boolean;
    config: ToolResultVectorConfig;
  }
>();

/**
 * Get or initialize services for the extension.
 */
async function ensureServices(runtime: ToolResultVectorRuntimeValue): Promise<{
  store: ToolResultVectorStore;
  embeddings: EmbeddingProvider;
  shouldProcess: (toolName: string) => boolean;
  config: ToolResultVectorConfig;
} | null> {
  // Check cache first
  const cached = serviceCache.get(runtime);
  if (cached) {
    return cached;
  }

  try {
    const config = runtime.config;

    // Create embeddings provider using memory system
    const openClawConfig = runtime.openClawConfig as OpenClawConfig | undefined;
    const embeddingResult = await createEmbeddingProvider({
      config: openClawConfig ?? {},
      provider: "auto",
      model: "text-embedding-3-small",
      fallback: "none",
    });
    const embeddings = embeddingResult.provider;

    // Resolve database path
    const resolvedDbPath = runtime.resolvedDbPath ?? config.storage.dbPath;

    // Create store
    const store = new ToolResultVectorStore(config.storage, embeddings, resolvedDbPath);

    await store.ensureInitialized();

    // Create tool filter
    const shouldProcess = makeToolFilterPredicate(config.tools);

    // Cache the result
    const result = { store, embeddings, shouldProcess, config };
    serviceCache.set(runtime, result);

    return result;
  } catch (err) {
    console.error(`tool-result-vector: service initialization failed: ${String(err)}`);
    return null;
  }
}

/**
 * Main extension entry point.
 *
 * This extension is loaded by Pi when its path is returned from
 * buildEmbeddedExtensionPaths. It reads configuration from the
 * runtime registry set by setToolResultVectorRuntime.
 */
export default function toolResultVectorExtension(api: ExtensionAPI): void {
  api.on("tool_result", async (event: ToolResultEvent, ctx: ExtensionContext) => {
    return handleToolResult(event, ctx);
  });

  api.on("context", async (event, ctx) => {
    // Use context event for retrieval instead of before_agent_start
    // Check if we should inject context
    const runtime = getRuntime(ctx.sessionManager);
    if (!runtime || !runtime.config.enabled) {
      return undefined;
    }

    const config = runtime.config;
    if (config.mode === "off" || config.mode === "store-only") {
      return undefined;
    }

    // Get the last user message as the query context
    const messages = event.messages;
    const lastUserMessage = [...messages].toReversed().find((m) => m.role === "user");
    if (!lastUserMessage) {
      return undefined;
    }

    const prompt = getUserMessageText(lastUserMessage);
    if (!prompt || prompt.trim().length < 10) {
      return undefined;
    }

    const services = await ensureServices(runtime);
    if (!services) {
      return undefined;
    }

    try {
      const sessionId = getSessionId(ctx);
      const retriever = createRetriever(config.retrieval, services.store, services.embeddings);

      const query = buildSearchQuery({ prompt });
      const result = await retriever.retrieveAndFormat(query, { sessionId });

      if (result.count === 0) {
        return undefined;
      }

      // Update access counts
      for (const r of result.results) {
        await services.store.touch(r.entry.id);
      }

      // Inject context by prepending to the first user message
      // This is done by returning modified messages
      const contextNote = `\n\n${result.contextBlock}`;
      const modifiedMessages = messages.map((m) => {
        if (m.role === "user" && m === lastUserMessage) {
          if (typeof m.content === "string") {
            return { ...m, content: m.content + contextNote };
          } else if (Array.isArray(m.content)) {
            const newContent = m.content.map((block) => {
              if (block.type === "text") {
                return { ...block, text: block.text + contextNote };
              }
              return block;
            });
            return { ...m, content: newContent };
          }
        }
        return m;
      });

      return { messages: modifiedMessages };
    } catch (err) {
      console.warn(`tool-result-vector: retrieval failed: ${String(err)}`);
      return undefined;
    }
  });
}

/**
 * Extract text from a user message.
 */
function getUserMessageText(message: { role: string; content: unknown }): string {
  if (typeof message.content === "string") {
    return message.content;
  }
  if (Array.isArray(message.content)) {
    return message.content
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text)
      .join("\n");
  }
  return "";
}

/**
 * Get runtime value from session manager.
 */
function getRuntime(sessionManager: unknown): ToolResultVectorRuntimeValue | null {
  const runtime = getToolResultVectorRuntime(sessionManager);
  if (!runtime || !("config" in runtime)) {
    return null;
  }
  return runtime as ToolResultVectorRuntimeValue;
}

/**
 * Handle tool_result event - store the result with summary.
 */
async function handleToolResult(
  event: ToolResultEvent,
  ctx: ExtensionContext,
): Promise<{ content?: (TextContent | ImageContent)[] } | undefined> {
  const runtime = getRuntime(ctx.sessionManager);
  if (!runtime || !runtime.config.enabled) {
    return undefined;
  }

  const config = runtime.config;
  if (config.mode === "off" || config.mode === "retrieve-only") {
    return undefined;
  }

  const services = await ensureServices(runtime);
  if (!services) {
    return undefined;
  }

  // Check if this tool should be processed
  if (!services.shouldProcess(event.toolName)) {
    return undefined;
  }

  // Check content length
  const contentLength = estimateContentLength(
    event.content as Array<{ type: string; text?: string }>,
  );
  if (contentLength < config.tools.minContentChars) {
    return undefined;
  }

  // Skip error results
  if (event.isError) {
    return undefined;
  }

  try {
    const sessionId = getSessionId(ctx);
    const model = ctx.model;

    // Create summarizer
    const llmClient = createLLMClient({
      model,
      sessionId,
    });
    const summarizer = createSummarizer(config.summary, llmClient);

    // Generate summary
    const summaryResult = await summarizer.summarize({
      toolName: event.toolName,
      input: event.input,
      content: event.content,
      isError: event.isError,
    });

    if (!summaryResult.ok) {
      console.warn(`tool-result-vector: summarization failed: ${summaryResult.error}`);
      return undefined;
    }

    // Store the result
    await services.store.store({
      sessionId,
      toolCallId: event.toolCallId,
      toolName: event.toolName,
      input: event.input,
      summary: summaryResult.summary,
      originalContent: event.content,
      isError: event.isError,
      details: event.details,
    });

    // Update runtime state
    updateToolResultVectorRuntime(ctx.sessionManager, {
      entryCount: services.store.getCount(),
    });

    return undefined;
  } catch (err) {
    console.warn(`tool-result-vector: failed to store result: ${String(err)}`);
    return undefined;
  }
}

/**
 * Get session ID from context.
 */
function getSessionId(ctx: ExtensionContext): string {
  const sm = ctx.sessionManager as unknown as {
    sessionId?: string;
    sessionFile?: string;
  };

  if (sm.sessionId) {
    return sm.sessionId;
  }

  if (sm.sessionFile) {
    const parts = sm.sessionFile.split(/[/\\]/);
    const fileName = parts[parts.length - 1];
    return fileName.replace(/\.json$/, "");
  }

  return "default";
}
