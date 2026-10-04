import "server-only";

// Domain/service code depends only on this interface (ARCHITECTURE.md D14) — never on a
// vendor SDK directly, so the provider is replaceable without touching business logic.
// A send failure must never corrupt the state that triggered it: callers invoke `send`
// after their own transaction commits and treat a rejection as best-effort/log-only.

export type EmailTemplate = "invitation" | "password-reset";

export interface EmailInput {
  to: string;
  template: EmailTemplate;
  data: Record<string, unknown>;
}

export interface EmailProvider {
  send(input: EmailInput): Promise<void>;
}
