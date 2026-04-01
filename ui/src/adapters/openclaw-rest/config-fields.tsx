import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { AdapterConfigFieldsProps } from "../types";
import {
  Field,
  DraftInput,
  help,
} from "../../components/agent-config-primitives";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

function SecretField({
  label,
  value,
  onCommit,
  placeholder,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label}>
      <div className="relative">
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          {visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </button>
        <DraftInput
          value={value}
          onCommit={onCommit}
          immediate
          type={visible ? "text" : "password"}
          className={inputClass + " pl-8"}
          placeholder={placeholder}
        />
      </div>
    </Field>
  );
}

export function OpenClawRestConfigFields({
  isCreate,
  config,
  onPatch,
}: AdapterConfigFieldsProps) {
  const gatewayUrl = (config.gatewayUrl as string) ?? "";
  const gatewayToken = (config.gatewayToken as string) ?? "";
  const agentId = (config.agentId as string) ?? "";
  const sessionKeyPrefix = (config.sessionKeyPrefix as string) ?? "";
  const timeoutMs = config.timeoutMs != null ? String(config.timeoutMs) : "";

  return (
    <div className="space-y-3">
      <Field label="Gateway URL" hint={help("HTTP URL of your OpenClaw gateway")}>
        <DraftInput
          value={gatewayUrl}
          onCommit={(v) => onPatch({ gatewayUrl: v })}
          immediate
          className={inputClass}
          placeholder="http://127.0.0.1:18789"
        />
      </Field>

      <SecretField
        label="Gateway Token"
        value={gatewayToken}
        onCommit={(v) => onPatch({ gatewayToken: v })}
        placeholder="Bearer auth token"
      />

      <Field label="Agent ID" hint={help("OpenClaw agent to target (e.g. main, rio, axis)")}>
        <DraftInput
          value={agentId}
          onCommit={(v) => onPatch({ agentId: v })}
          immediate
          className={inputClass}
          placeholder="main"
        />
      </Field>

      <Field label="Session Key Prefix" hint={help("Prefix for session isolation (default: clawcomclip)")}>
        <DraftInput
          value={sessionKeyPrefix}
          onCommit={(v) => onPatch({ sessionKeyPrefix: v })}
          immediate
          className={inputClass}
          placeholder="clawcomclip"
        />
      </Field>

      <Field label="Timeout (ms)" hint={help("Request timeout in milliseconds (default: 120000)")}>
        <DraftInput
          value={timeoutMs}
          onCommit={(v) => onPatch({ timeoutMs: v ? Number(v) : 120000 })}
          immediate
          className={inputClass}
          placeholder="120000"
        />
      </Field>
    </div>
  );
}
