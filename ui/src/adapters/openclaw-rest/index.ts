import type { UIAdapterModule, CreateConfigValues } from "../types";
import { parseStdoutLine } from "@clawcomclip/adapter-openclaw-rest/ui";
import { OpenClawRestConfigFields } from "./config-fields";

export const openClawRestUIAdapter: UIAdapterModule = {
  type: "openclaw_rest",
  label: "OpenClaw REST API",
  parseStdoutLine,
  ConfigFields: OpenClawRestConfigFields,
  buildAdapterConfig: (v: CreateConfigValues) => {
    const ac: Record<string, unknown> = {};
    if (v.url) ac.gatewayUrl = v.url;
    ac.agentId = "main";
    ac.sessionKeyPrefix = "clawcomclip";
    ac.timeoutMs = 120000;
    return ac;
  },
};
