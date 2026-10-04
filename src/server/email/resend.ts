import "server-only";
import type { EmailInput, EmailProvider } from "./provider";

// Calls the Resend HTTP API directly (no SDK dependency) — one fetch, one responsibility.
const RESEND_API_URL = "https://api.resend.com/emails";

function renderSubjectAndText(input: EmailInput): { subject: string; text: string } {
  switch (input.template) {
    case "invitation": {
      const { workspaceName, inviterName, inviteUrl } = input.data as { workspaceName: string; inviterName: string; inviteUrl: string };
      return {
        subject: `${inviterName} invited you to ${workspaceName}`,
        text: `${inviterName} invited you to join ${workspaceName}.\n\nAccept: ${inviteUrl}`,
      };
    }
    case "password-reset": {
      const { resetUrl } = input.data as { resetUrl: string };
      return {
        subject: "Reset your password",
        text: `Reset your password: ${resetUrl}\n\nIf you didn't request this, you can ignore this email.`,
      };
    }
  }
}

export class ResendAdapter implements EmailProvider {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(input: EmailInput): Promise<void> {
    const { subject, text } = renderSubjectAndText(input);
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: this.from, to: input.to, subject, text }),
    });
    if (!res.ok) throw new Error(`Resend send failed: ${res.status} ${await res.text()}`);
  }
}
