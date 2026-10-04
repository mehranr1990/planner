import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthForm } from "@/features/auth/components/auth-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.signUp");
  return { title: t("metaTitle") };
}

export default async function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  const { next, email } = await searchParams;
  const t = await getTranslations("auth.signUp");
  return (
    <>
      <h1 className="mb-1 text-[26px] leading-9 font-medium tracking-[-0.02em]">{t("title")}</h1>
      <p className="mb-6 text-[13px] text-foreground-muted">{t("subtitle")}</p>
      <AuthForm mode="sign-up" next={typeof next === "string" ? next : null} initialEmail={typeof email === "string" ? email : undefined} />
    </>
  );
}
