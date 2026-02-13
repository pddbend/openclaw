/**
 * Tool Result Vector Extension
 *
 * Stores tool execution results with LLM-generated summaries in a vector database
 * for semantic retrieval across sessions.
 *
 * ## Features
 *
 * - Automatic summarization of large tool outputs
 * - Vector-based semantic search for relevant results
 * - Cross-session retrieval of tool results
 * - Configurable tool filtering and importance scoring
 *
 * ## Usage
 *
 * Add to your openclaw.yaml:
 *
 * ```yaml
 * agents:
 *   toolResultVector:
 *     enabled: true
 *     mode: "full"  # "off", "store-only", "retrieve-only", "full"
 *     summary:
 *       maxChars: 200
 *     retrieval:
 *       maxResults: 5
 *       minScore: 0.5
 * ```
 */

export { default } from "./extension.js";

// Export types
export type {
  ToolResultEntry,
  ToolResultSearchResult,
  ToolResultVectorConfig,
  ToolResultVectorUserConfig,
  SummaryConfig,
  SummaryCacheConfig,
  SummaryBatchConfig,
  StorageConfig,
  RetrievalConfig,
  ToolsFilterConfig,
  ToolResultVectorRuntime,
  ToolResultVectorRuntimeValue,
} from "./types.js";

// Export settings
export {
  computeEffectiveSettings,
  DEFAULT_TOOL_RESULT_VECTOR_CONFIG,
  DEFAULT_SUMMARY_CONFIG,
  DEFAULT_STORAGE_CONFIG,
  DEFAULT_RETRIEVAL_CONFIG,
  DEFAULT_TOOLS_FILTER_CONFIG,
} from "./settings.js";

// Export runtime
export {
  getToolResultVectorRuntime,
  setToolResultVectorRuntime,
  updateToolResultVectorRuntime,
} from "./runtime.js";

// Export store
export { ToolResultVectorStore } from "./store.js";

// Export retriever
export { createRetriever, buildSearchQuery, formatResultsForContext } from "./retriever.js";

// Export summarizer
export { createSummarizer, createLLMClient, extractTextContent } from "./summarizer.js";

// Export tools
export { makeToolFilterPredicate, estimateContentLength, truncateContent } from "./tools.js";
