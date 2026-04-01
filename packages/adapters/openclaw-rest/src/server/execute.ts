import type {
  AdapterExecutionContext,
  AdapterExecutionResult,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@paperclipai/adapter-utils";
import { buildPaperclipEnv } from "@paperclipai/adapter-utils/server-utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nonEmpty(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatCompletionResponse {
  id?: string;
  object?: string;
  model?: string;
  choices?: Array<{
    index?: number;
    message?: { role?: string; content?: string };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: { message?: string; code?: string };
}

// ---------------------------------------------------------------------------
// Wake text builder (compatible with openclaw_gateway adapter)
// ---------------------------------------------------------------------------

function buildWakeText(ctx: AdapterExecutionContext): string {
  const { runId, agent, context } = ctx;
  const paperclipEnv = buildPaperclipEnv(agent);
  const taskId = nonEmpty(context.taskId) ?? nonEmpty(context.issueId);
  const issueId = nonEmpty(context.issueId);
  const wakeReason = nonEmpty(context.wakeReason);
  const wakeCommentId = nonEmpty(context.wakeCommentId) ?? nonEmpty(context.commentId);
  const approvalId = nonEmpty(context.approvalId);
  const approvalStatus = nonEmpty(context.approvalStatus);

  const envLines: string[] = [
    `PAPERCLIP_RUN_ID=${runId}`,
    `PAPERCLIP_AGENT_ID=${paperclipEnv.PAPERCLIP_AGENT_ID ?? agent.id}`,
    `PAPERCLIP_COMPANY_ID=${paperclipEnv.PAPERCLIP_COMPANY_ID ?? agent.companyId}`,
  ];

  const apiUrl = nonEmpty(ctx.config.paperclipApiUrl) ?? process.env.PAPERCLIP_API_URL;
  if (apiUrl) envLines.push(`PAPERCLIP_API_URL=${apiUrl}`);
  if (taskId) envLines.push(`PAPERCLIP_TASK_ID=${taskId}`);
  if (wakeReason) envLines.push(`PAPERCLIP_WAKE_REASON=${wakeReason}`);
  if (wakeCommentId) envLines.push(`PAPERCLIP_WAKE_COMMENT_ID=${wakeCommentId}`);
  if (approvalId) envLines.push(`PAPERCLIP_APPROVAL_ID=${approvalId}`);
  if (approvalStatus) envLines.push(`PAPERCLIP_APPROVAL_STATUS=${approvalStatus}`);

  const issueIds = Array.isArray(context.issueIds)
    ? context.issueIds.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    : [];
  if (issueIds.length > 0) envLines.push(`PAPERCLIP_LINKED_ISSUE_IDS=${issueIds.join(",")}`);

  const issueIdHint = taskId ?? issueId ?? "";
  const apiBaseHint = apiUrl ?? "<set PAPERCLIP_API_URL>";

  const lines = [
    "ClawComClip wake event (openclaw_rest adapter).",
    "",
    "Run this procedure now.",
    "",
    "Context:",
    ...envLines,
    "",
    `api_base=${apiBaseHint}`,
    `task_id=${taskId ?? ""}`,
    `issue_id=${issueId ?? ""}`,
    `wake_reason=${wakeReason ?? ""}`,
    "",
    "Workflow:",
    "1) GET /api/agents/me",
    `2) Determine issueId: PAPERCLIP_TASK_ID if present, otherwise issue_id (${issueIdHint}).`,
    "3) If issueId exists:",
    `   - POST /api/issues/{issueId}/checkout with {"agentId":"$PAPERCLIP_AGENT_ID","expectedStatuses":["todo","backlog","blocked"]}`,
    "   - GET /api/issues/{issueId}",
    "   - Execute the issue instructions.",
    `   - PATCH /api/issues/{issueId} with {"status":"done","comment":"what changed and why"}.`,
    "4) If no issueId:",
    "   - GET /api/companies/$PAPERCLIP_COMPANY_ID/issues?assigneeAgentId=$PAPERCLIP_AGENT_ID&status=todo,in_progress,blocked",
    "   - Pick one and execute step 3.",
    "",
    "Complete the workflow in this run.",
  ];
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Session key
// ---------------------------------------------------------------------------

function resolveSessionKey(ctx: AdapterExecutionContext): string {
  const strategy = nonEmpty(ctx.config.sessionKeyStrategy) ?? "issue";
  const prefix = nonEmpty(ctx.config.sessionKeyPrefix) ?? "clawcomclip";
  const agentId = nonEmpty(ctx.config.agentId) ?? "main";

  switch (strategy) {
    case "fixed":
      return nonEmpty(ctx.config.sessionKey) ?? `${prefix}:${agentId}`;
    case "run":
      return `${prefix}:${agentId}:run:${ctx.runId}`;
    case "issue":
    default: {
      const issueId = nonEmpty(ctx.context.issueId) ?? nonEmpty(ctx.context.taskId);
      return issueId ? `${prefix}:${agentId}:issue:${issueId}` : `${prefix}:${agentId}:run:${ctx.runId}`;
    }
  }
}

// ---------------------------------------------------------------------------
// Execute — main adapter function
// ---------------------------------------------------------------------------

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const gatewayUrl = nonEmpty(ctx.config.gatewayUrl);
  const gatewayToken = nonEmpty(ctx.config.gatewayToken);
  const agentId = nonEmpty(ctx.config.agentId) ?? "main";
  const timeoutMs = asNumber(ctx.config.timeoutMs, 120_000);

  if (!gatewayUrl) {
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: "openclaw_rest: gatewayUrl is required in adapterConfig",
      errorCode: "MISSING_GATEWAY_URL",
    };
  }

  if (!gatewayToken) {
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: "openclaw_rest: gatewayToken is required in adapterConfig",
      errorCode: "MISSING_GATEWAY_TOKEN",
    };
  }

  const sessionKey = resolveSessionKey(ctx);
  const wakeText = buildWakeText(ctx);

  // Merge payloadTemplate message if present
  const payloadTemplate = (typeof ctx.config.payloadTemplate === "object" && ctx.config.payloadTemplate !== null)
    ? ctx.config.payloadTemplate as Record<string, unknown>
    : {};
  const templateMessage = nonEmpty(payloadTemplate.message) ?? nonEmpty(payloadTemplate.text);
  const message = templateMessage ? `${templateMessage}\n\n${wakeText}` : wakeText;

  const url = `${gatewayUrl.replace(/\/$/, "")}/v1/chat/completions`;

  await ctx.onLog("stdout", `[openclaw-rest] Sending to ${agentId} via ${url}\n`);
  await ctx.onLog("stdout", `[openclaw-rest] Session key: ${sessionKey}\n`);

  if (ctx.onMeta) {
    await ctx.onMeta({
      adapterType: "openclaw_rest",
      command: "fetch",
      commandArgs: ["POST", url, `model=openclaw/${agentId}`],
      context: ctx.context,
    });
  }

  const startTime = Date.now();
  let response: Response;
  let timedOut = false;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      timedOut = true;
    }, timeoutMs);

    response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${gatewayToken}`,
        "Content-Type": "application/json",
        "x-openclaw-session-key": sessionKey,
      },
      body: JSON.stringify({
        model: `openclaw/${agentId}`,
        messages: [{ role: "user", content: message }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);
  } catch (err) {
    const elapsed = Date.now() - startTime;
    if (timedOut) {
      await ctx.onLog("stderr", `[openclaw-rest] Timeout after ${elapsed}ms\n`);
      return {
        exitCode: 1,
        signal: null,
        timedOut: true,
        errorMessage: `openclaw_rest: request timed out after ${timeoutMs}ms`,
        errorCode: "TIMEOUT",
      };
    }

    const errorMsg = err instanceof Error ? err.message : String(err);
    await ctx.onLog("stderr", `[openclaw-rest] Network error: ${errorMsg}\n`);
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: `openclaw_rest: network error — ${errorMsg}`,
      errorCode: "NETWORK_ERROR",
    };
  }

  const elapsed = Date.now() - startTime;

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    await ctx.onLog("stderr", `[openclaw-rest] HTTP ${response.status}: ${errorBody.slice(0, 500)}\n`);

    let errorCode = "HTTP_ERROR";
    if (response.status === 401 || response.status === 403) errorCode = "AUTH_ERROR";
    if (response.status === 404) errorCode = "AGENT_NOT_FOUND";
    if (response.status === 429) errorCode = "RATE_LIMITED";

    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: `openclaw_rest: HTTP ${response.status} from gateway`,
      errorCode,
      errorMeta: { status: response.status, body: errorBody.slice(0, 1000) },
    };
  }

  let data: ChatCompletionResponse;
  try {
    data = await response.json() as ChatCompletionResponse;
  } catch {
    await ctx.onLog("stderr", "[openclaw-rest] Failed to parse JSON response\n");
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: "openclaw_rest: invalid JSON response from gateway",
      errorCode: "INVALID_RESPONSE",
    };
  }

  const content = data.choices?.[0]?.message?.content ?? "";
  const finishReason = data.choices?.[0]?.finish_reason ?? "stop";

  await ctx.onLog("stdout", `[openclaw-rest] Response received (${elapsed}ms, ${content.length} chars, reason=${finishReason})\n`);
  await ctx.onLog("stdout", content + "\n");

  // Extract usage for cost tracking
  const usage = data.usage
    ? {
        inputTokens: data.usage.prompt_tokens ?? 0,
        outputTokens: data.usage.completion_tokens ?? 0,
        totalTokens: data.usage.total_tokens ?? 0,
      }
    : undefined;

  return {
    exitCode: 0,
    signal: null,
    timedOut: false,
    model: data.model ?? `openclaw/${agentId}`,
    provider: "openclaw",
    usage,
    sessionId: sessionKey,
    summary: content.length > 200 ? content.slice(0, 200) + "..." : content,
    resultJson: {
      content,
      finishReason,
      model: data.model,
      gatewayResponseId: data.id,
    },
  };
}

// ---------------------------------------------------------------------------
// Environment test
// ---------------------------------------------------------------------------

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentTestResult["checks"] = [];
  const config = ctx.config ?? {};
  const gatewayUrl = nonEmpty(config.gatewayUrl);
  const gatewayToken = nonEmpty(config.gatewayToken);
  const agentId = nonEmpty(config.agentId);

  if (!gatewayUrl) {
    checks.push({
      code: "missing_gateway_url",
      level: "error",
      message: "gatewayUrl is required",
      hint: "Set gatewayUrl in adapterConfig (e.g. http://127.0.0.1:18789)",
    });
  }

  if (!gatewayToken) {
    checks.push({
      code: "missing_gateway_token",
      level: "error",
      message: "gatewayToken is required",
      hint: "Set gatewayToken in adapterConfig (min 16 characters)",
    });
  } else if (gatewayToken.length < 16) {
    checks.push({
      code: "short_gateway_token",
      level: "warn",
      message: "gatewayToken is shorter than 16 characters",
      hint: "Use a longer token for security",
    });
  }

  if (!agentId) {
    checks.push({
      code: "missing_agent_id",
      level: "warn",
      message: "agentId not set, will default to 'main'",
      hint: "Set agentId to target a specific OpenClaw agent (e.g. rio, axis, hive)",
    });
  }

  // Health check
  if (gatewayUrl) {
    try {
      const healthUrl = `${gatewayUrl.replace(/\/$/, "")}/healthz`;
      const res = await fetch(healthUrl, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        checks.push({
          code: "gateway_reachable",
          level: "info",
          message: `Gateway at ${gatewayUrl} is reachable`,
        });
      } else {
        checks.push({
          code: "gateway_unhealthy",
          level: "error",
          message: `Gateway returned HTTP ${res.status}`,
          hint: "Check that OpenClaw gateway is running",
        });
      }
    } catch (err) {
      checks.push({
        code: "gateway_unreachable",
        level: "error",
        message: `Cannot reach gateway at ${gatewayUrl}`,
        detail: err instanceof Error ? err.message : String(err),
        hint: "Check network connectivity and gateway URL",
      });
    }
  }

  const hasError = checks.some((c) => c.level === "error");
  const hasWarn = checks.some((c) => c.level === "warn");

  return {
    adapterType: "openclaw_rest",
    status: hasError ? "fail" : hasWarn ? "warn" : "pass",
    checks,
    testedAt: new Date().toISOString(),
  };
}
