/**
 * Tool Result Vector Extension Entry Point
 *
 * Opt-in vector storage and retrieval for tool execution results.
 *
 * When enabled, this extension will:
 * 1. Generate LLM summaries of large tool outputs
 * 2. Store results with summaries in a vector database
 * 3. Inject relevant results into future agent turns
 *
 * This helps maintain context across long conversations by allowing
 * the agent to recall relevant tool results from previous turns.
 */

export { default } from "./tool-result-vector/extension.js";

export {
  computeEffectiveSettings,
  DEFAULT_TOOL_RESULT_VECTOR_CONFIG,
} from "./tool-result-vector/settings.js";

export type {
  ToolResultVectorConfig,
  ToolResultVectorUserConfig,
} from "./tool-result-vector/types.js";
