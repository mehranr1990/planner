import "server-only";
import type { EmailInput, EmailProvider } from "./provider";

/** Dev/test default: logs instead of sending, so local work and E2E never depend on a real inbox. */
export class ConsoleEmailProvider implements EmailProvider {
  async send(input: EmailInput): Promise<void> {
    console.log(`[email:${input.template}] to=${input.to}`, input.data);
  }
}
