export const type = "openclaw_rest";
export const label = "OpenClaw REST API";

export const models: { id: string; label: string }[] = [];

export const agentConfigurationDoc = `# openclaw_rest agent configuration

Adapter: openclaw_rest

Use when:
- Your OpenClaw gateway has the /v1/chat/completions HTTP endpoint enabled.
- You want a simple HTTP-based integration without WebSocket complexity.
- You have multiple agents on a single OpenClaw gateway and want per-agent routing.

Don't use when:
- You need real-time streaming from gateway events (use openclaw_gateway instead).
- Your gateway does not have chatCompletions endpoint enabled.

Core fields:
- gatewayUrl (string, required): OpenClaw gateway HTTP URL (http:// or https://)
- gatewayToken (string, required): Gateway auth token (min 16 chars)
- agentId (string, required): OpenClaw agent ID to target (e.g. "main", "rio", "axis")

Optional fields:
- sessionKeyPrefix (string, optional): Prefix for session keys (default "clawcomclip")
- timeoutMs (number, optional): Request timeout in ms (default 120000)
- paperclipApiUrl (string, optional): ClawComClip API URL for agent callbacks

Agent targeting:
Each agent in ClawComClip should have its own adapterConfig with a unique agentId.
The adapter sends POST /v1/chat/completions with model: "openclaw/{agentId}".
This routes the request to the specific agent inside the OpenClaw gateway.
`;
