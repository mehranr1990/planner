"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { acceptInvitationAction } from "../server/actions";

export function AcceptInvitation({ token, goNext }: { token: string; goNext: string }) {
  const t = useTranslations("invitations");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="primary"
        size="lg"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await acceptInvitationAction({ token });
            if (!res.ok) return setError(res.error);
            router.push(goNext);
          })
        }
      >
        {t("accept")}
      </Button>
      {error && (
        <p role="alert" className="text-[13px] text-accent-red">
          {error}
        </p>
      )}
    </div>
  );
}
