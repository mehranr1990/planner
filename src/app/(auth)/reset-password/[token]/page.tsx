import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.resetPassword");
  return { title: t("metaTitle") };
}

export default async function ResetPasswordPage({ params }: PageProps<"/reset-password/[token]">) {
  const { token } = await params;
  const t = await getTranslations("auth.resetPassword");
  return (
    <>
      <h1 className="mb-1 text-[26px] leading-9 font-medium tracking-[-0.02em]">{t("title")}</h1>
      <p className="mb-6 text-[13px] text-foreground-muted">{t("subtitle")}</p>
      <ResetPasswordForm token={token} />
    </>
  );
}
