import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/button";
import { AcceptInvitation } from "@/features/invitations/components/accept-invitation";
import { previewInvitation } from "@/features/invitations/server/service";
import { getSessionUser } from "@/server/auth/session";

export default async function InviteAcceptPage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const [t, preview, sessionUser] = await Promise.all([getTranslations("invitations"), previewInvitation(token), getSessionUser()]);

  if (preview.state !== "valid") {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-[22px] leading-8 font-medium tracking-[-0.02em]">{t(`invalidStates.${preview.state}.title`)}</h1>
        <p className="text-[13.5px] text-foreground-muted">{t(`invalidStates.${preview.state}.hint`)}</p>
        <ButtonLink href={sessionUser ? "/home" : "/sign-in"} variant="primary" className="mt-2 self-start">
          {t("goToApp")}
        </ButtonLink>
      </div>
    );
  }

  const emailMismatch = sessionUser && sessionUser.email.toLowerCase() !== preview.email.toLowerCase();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[22px] leading-8 font-medium tracking-[-0.02em]">{t("inviteHeading", { workspace: preview.workspaceName })}</h1>
        <p className="mt-1 text-[13.5px] text-foreground-muted" dir="ltr">
          {preview.email}
        </p>
      </div>

      {!sessionUser && (
        <div className="flex flex-col gap-2">
          <ButtonLink href={`/sign-up?next=${encodeURIComponent(`/invite/${token}`)}&email=${encodeURIComponent(preview.email)}`} variant="primary" size="lg">
            {t("createAccountToAccept")}
          </ButtonLink>
          <p className="text-center text-[13px] text-foreground-muted">
            {t("alreadyHaveAccount")}{" "}
            <Link href={`/sign-in?next=${encodeURIComponent(`/invite/${token}`)}`} className="font-medium text-foreground underline-offset-4 hover:underline">
              {t("signIn")}
            </Link>
          </p>
        </div>
      )}

      {sessionUser && emailMismatch && (
        <div className="flex flex-col gap-2">
          <p className="text-[13.5px] text-accent-red">{t("emailMismatch", { email: preview.email })}</p>
          <ButtonLink href={`/sign-in?next=${encodeURIComponent(`/invite/${token}`)}`} variant="secondary">
            {t("switchAccount")}
          </ButtonLink>
        </div>
      )}

      {sessionUser && !emailMismatch && <AcceptInvitation token={token} goNext={sessionUser.isOnboarded ? "/home" : "/onboarding"} />}
    </div>
  );
}
