// UI exports for openclaw_rest adapter
// Reuse the shared stream parser from openclaw-gateway where applicable

import type { StdoutLineParser, TranscriptEntry } from "@paperclipai/adapter-utils";

/**
 * Simple stdout line parser for openclaw_rest adapter output.
 * Recognizes adapter log lines and agent response content.
 */
export const parseStdoutLine: StdoutLineParser = (line: string, ts: string): TranscriptEntry[] => {
  const trimmed = line.trim();
  if (!trimmed) return [];

  // Adapter internal logs
  if (trimmed.startsWith("[openclaw-rest]")) {
    return [{ kind: "system", ts, text: trimmed }];
  }

  // Everything else is agent output
  return [{ kind: "assistant", ts, text: trimmed }];
};

/**
 * Build the adapter configuration form fields for the UI.
 */
export function buildConfigFields() {
  return [
    {
      key: "gatewayUrl",
      label: "Gateway URL",
      type: "text" as const,
      placeholder: "http://127.0.0.1:18789",
      required: true,
      description: "OpenClaw gateway HTTP URL",
    },
    {
      key: "gatewayToken",
      label: "Gateway Token",
      type: "password" as const,
      required: true,
      description: "Bearer token for gateway authentication",
    },
    {
      key: "agentId",
      label: "Agent ID",
      type: "text" as const,
      placeholder: "main",
      required: true,
      description: "OpenClaw agent to target (e.g. main, rio, axis, hive, herald)",
    },
    {
      key: "sessionKeyPrefix",
      label: "Session Key Prefix",
      type: "text" as const,
      placeholder: "clawcomclip",
      required: false,
      description: "Prefix for session keys (default: clawcomclip)",
    },
    {
      key: "timeoutMs",
      label: "Timeout (ms)",
      type: "number" as const,
      placeholder: "120000",
      required: false,
      description: "Request timeout in milliseconds (default: 120000)",
    },
  ];
}
