import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { AdapterConfigFieldsProps } from "../types";
import {
  Field,
  DraftInput,
} from "../../components/agent-config-primitives";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

function SecretField({
  label,
  value,
  onCommit,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label} hint={hint}>
      <div className="relative">
        <button
          type="button"
          onClick={() => setVisible((prev) => !prev)}
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

export function OpenClawRestConfigFields(p: AdapterConfigFieldsProps) {
  // Create mode — only URL field, rest configured after creation
  if (p.isCreate) {
    const url = p.values?.url ?? "";
    return (
      <div className="space-y-3">
        <Field label="Gateway HTTP URL" hint="OpenClaw gateway URL for REST API">
          <DraftInput
            value={url}
            onCommit={(v) => p.set!({ url: v })}
            immediate
            className={inputClass}
            placeholder="http://127.0.0.1:18789"
          />
        </Field>
        <p className="text-xs text-muted-foreground">
          After creation, configure Gateway Token, Agent ID, and other settings in agent properties.
        </p>
      </div>
    );
  }

  // Edit mode — full config via eff/mark
  return (
    <div className="space-y-3">
      <Field label="Gateway URL" hint="HTTP URL of your OpenClaw gateway">
        <DraftInput
          value={p.eff("adapterConfig", "gatewayUrl", String(p.config.gatewayUrl ?? ""))}
          onCommit={(v) => p.mark("adapterConfig", "gatewayUrl", v)}
          immediate
          className={inputClass}
          placeholder="http://127.0.0.1:18789"
        />
      </Field>

      <SecretField
        label="Gateway Token"
        value={p.eff("adapterConfig", "gatewayToken", String(p.config.gatewayToken ?? ""))}
        onCommit={(v) => p.mark("adapterConfig", "gatewayToken", v)}
        placeholder="Bearer auth token"
        hint="OpenClaw gateway auth token"
      />

      <Field label="Agent ID" hint="OpenClaw agent to target (e.g. main, rio, axis)">
        <DraftInput
          value={p.eff("adapterConfig", "agentId", String(p.config.agentId ?? ""))}
          onCommit={(v) => p.mark("adapterConfig", "agentId", v)}
          immediate
          className={inputClass}
          placeholder="main"
        />
      </Field>

      <Field label="Session Key Prefix" hint="Prefix for session isolation (default: clawcomclip)">
        <DraftInput
          value={p.eff("adapterConfig", "sessionKeyPrefix", String(p.config.sessionKeyPrefix ?? ""))}
          onCommit={(v) => p.mark("adapterConfig", "sessionKeyPrefix", v)}
          immediate
          className={inputClass}
          placeholder="clawcomclip"
        />
      </Field>

      <Field label="Timeout (ms)" hint="Request timeout in milliseconds (default: 120000)">
        <DraftInput
          value={p.eff("adapterConfig", "timeoutMs", String(p.config.timeoutMs ?? "120000"))}
          onCommit={(v) => p.mark("adapterConfig", "timeoutMs", v ? Number(v) : 120000)}
          immediate
          className={inputClass}
          placeholder="120000"
        />
      </Field>
    </div>
  );
}
