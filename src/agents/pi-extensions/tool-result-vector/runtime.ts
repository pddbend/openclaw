/**
 * Runtime state management for Tool Result Vector extension.
 *
 * Uses a WeakMap keyed by SessionManager to store per-session runtime state.
 */

import type { ToolResultVectorRuntime } from "./types.js";

/**
 * Runtime state per session.
 */
const RUNTIME_REGISTRY = new WeakMap<object, ToolResultVectorRuntime>();

/**
 * Default runtime state.
 */
function createDefaultRuntime(): ToolResultVectorRuntime {
  return {
    initialized: false,
    entryCount: 0,
    lastCleanupAt: null,
  };
}

/**
 * Set runtime state for a session manager.
 */
export function setToolResultVectorRuntime(
  sessionManager: unknown,
  value: ToolResultVectorRuntime | null,
): void {
  if (!sessionManager || typeof sessionManager !== "object") {
    return;
  }

  const key = sessionManager;
  if (value === null) {
    RUNTIME_REGISTRY.delete(key);
    return;
  }

  RUNTIME_REGISTRY.set(key, value);
}

/**
 * Get runtime state for a session manager.
 * Returns default state if not set.
 */
export function getToolResultVectorRuntime(sessionManager: unknown): ToolResultVectorRuntime {
  if (!sessionManager || typeof sessionManager !== "object") {
    return createDefaultRuntime();
  }

  return RUNTIME_REGISTRY.get(sessionManager) ?? createDefaultRuntime();
}

/**
 * Update runtime state for a session manager.
 * Merges partial updates with existing state.
 */
export function updateToolResultVectorRuntime(
  sessionManager: unknown,
  updates: Partial<ToolResultVectorRuntime>,
): void {
  if (!sessionManager || typeof sessionManager !== "object") {
    return;
  }

  const current = getToolResultVectorRuntime(sessionManager);
  RUNTIME_REGISTRY.set(sessionManager, { ...current, ...updates });
}

/**
 * Check if the extension is initialized for a session.
 */
export function isInitialized(sessionManager: unknown): boolean {
  return getToolResultVectorRuntime(sessionManager).initialized;
}
