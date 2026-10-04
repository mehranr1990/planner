import "server-only";
import { ConsoleEmailProvider } from "./console";
import type { EmailInput, EmailProvider } from "./provider";
import { ResendAdapter } from "./resend";

export type { EmailInput, EmailProvider, EmailTemplate } from "./provider";

function createProvider(): EmailProvider {
  const kind = process.env.EMAIL_PROVIDER ?? (process.env.NODE_ENV === "production" ? "resend" : "console");
  if (kind === "resend") {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey || !from) throw new Error("RESEND_API_KEY and EMAIL_FROM are required when EMAIL_PROVIDER=resend");
    return new ResendAdapter(apiKey, from);
  }
  return new ConsoleEmailProvider();
}

let instance: EmailProvider | null = null;

// Built lazily, on first actual send — not at import time, so route/page analysis (e.g. `next
// build`'s data collection, which imports every server action module) never pays this cost or
// needs provider env vars configured just to compile.
export const emailProvider: EmailProvider = {
  send(input: EmailInput) {
    instance ??= createProvider();
    return instance.send(input);
  },
};
