import type { UIAdapterModule } from "../types";
import { parseStdoutLine } from "@clawcomclip/adapter-openclaw-rest/ui";
import { OpenClawRestConfigFields } from "./config-fields";

export const openClawRestUIAdapter: UIAdapterModule = {
  type: "openclaw_rest",
  label: "OpenClaw REST API",
  parseStdoutLine,
  ConfigFields: OpenClawRestConfigFields,
  buildAdapterConfig: (values: Record<string, string>) => ({
    gatewayUrl: values.gatewayUrl || "",
    gatewayToken: values.gatewayToken || "",
    agentId: values.agentId || "main",
    sessionKeyPrefix: values.sessionKeyPrefix || "clawcomclip",
    timeoutMs: values.timeoutMs ? Number(values.timeoutMs) : 120000,
  }),
};
