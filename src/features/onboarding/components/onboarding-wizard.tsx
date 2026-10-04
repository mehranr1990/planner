"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Panel } from "@/components/ui/surface";
import { LOCALE_NAMES, LOCALES, type AppLocale } from "@/i18n/config";
import { createProjectAction } from "@/features/projects/server/actions";
import { createTaskAction } from "@/features/tasks/server/actions";
import { createWorkspaceAction } from "@/features/workspace/server/actions";
import { sendInvitationAction } from "@/features/invitations/server/actions";
import { completeOnboardingAction, saveOnboardingSetupAction } from "../server/actions";

type UsageContext = "PERSONAL" | "TEAM";

export function OnboardingWizard({
  name,
  timezone,
  weekStartsOn,
  locale,
  timezones,
  existingWorkspace,
}: {
  name: string;
  timezone: string;
  weekStartsOn: number;
  locale: AppLocale;
  timezones: string[];
  existingWorkspace: { id: string; name: string } | null;
}) {
  const t = useTranslations("onboarding");
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [context, setContext] = useState<UsageContext | null>(null);
  const [workspace, setWorkspace] = useState(existingWorkspace);
  const [pending, start] = useTransition();

  function finish() {
    start(async () => {
      await completeOnboardingAction();
      router.push("/home");
    });
  }

  return (
    <Panel className="mx-auto max-w-xl">
      <p className="mb-5 text-[12.5px] text-foreground-muted">{t("stepOf", { step, total: 4 })}</p>

      {step === 1 && (
        <form
          className="flex flex-col gap-4"
          action={(form) =>
            start(async () => {
              await saveOnboardingSetupAction({
                name: String(form.get("name")),
                timezone: String(form.get("timezone")),
                weekStartsOn: Number(form.get("weekStartsOn")),
                locale: String(form.get("locale")) as AppLocale,
              });
              setStep(2);
            })
          }
        >
          <h1 className="text-[20px] font-medium tracking-[-0.01em]">{t("setup.heading")}</h1>
          <Field label={t("setup.name")} htmlFor="ob-name">
            <Input id="ob-name" name="name" dir="auto" defaultValue={name} required maxLength={80} />
          </Field>
          <Field label={t("setup.language")} htmlFor="ob-locale">
            <Select id="ob-locale" name="locale" defaultValue={locale}>
              {LOCALES.map((l) => (
                <option key={l} value={l} lang={l}>
                  {LOCALE_NAMES[l]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("setup.timezone")} htmlFor="ob-tz">
            <Select id="ob-tz" name="timezone" defaultValue={timezone} dir="ltr">
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replaceAll("_", " ")}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("setup.weekStart")} htmlFor="ob-week">
            <Select id="ob-week" name="weekStartsOn" defaultValue={String(weekStartsOn)}>
              <option value="1">{t("setup.monday")}</option>
              <option value="0">{t("setup.sunday")}</option>
              <option value="6">{t("setup.saturday")}</option>
            </Select>
          </Field>
          <Button type="submit" variant="primary" size="lg" disabled={pending} className="mt-2">
            {t("continue")}
          </Button>
        </form>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <h1 className="text-[20px] font-medium tracking-[-0.01em]">{t("context.heading")}</h1>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                setContext("PERSONAL");
                setStep(4);
              }}
            >
              {t("context.personal")}
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                setContext("TEAM");
                setStep(workspace ? 4 : 3);
              }}
            >
              {t("context.team")}
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <form
          className="flex flex-col gap-4"
          action={(form) =>
            start(async () => {
              const res = await createWorkspaceAction({ name: String(form.get("name")), timezone });
              if (res.ok) setWorkspace({ id: res.data.id, name: String(form.get("name")) });
              setStep(4);
            })
          }
        >
          <h1 className="text-[20px] font-medium tracking-[-0.01em]">{t("workspace.heading")}</h1>
          <Field label={t("workspace.name")} htmlFor="ob-ws-name">
            <Input id="ob-ws-name" name="name" dir="auto" required minLength={2} maxLength={80} placeholder={t("workspace.placeholder")} />
          </Field>
          <Button type="submit" variant="primary" size="lg" disabled={pending} className="mt-2">
            {t("continue")}
          </Button>
        </form>
      )}

      {step === 4 && context === "PERSONAL" && (
        <FirstActionPersonal pending={pending} onCreate={(title) => start(async () => { await createTaskAction({ input: title, clientMutationId: crypto.randomUUID(), context: "personal", projectId: null, view: null }); finish(); })} onSkip={finish} />
      )}

      {step === 4 && context === "TEAM" && workspace && (
        <FirstActionTeam
          pending={pending}
          onInvite={(email) => start(async () => { await sendInvitationAction({ workspaceId: workspace.id, email, role: "MEMBER" }); finish(); })}
          onCreateProject={(name2) => start(async () => { await createProjectAction({ name: name2, context: workspace.id, visibility: "WORKSPACE" }); finish(); })}
          onSkip={finish}
        />
      )}
    </Panel>
  );
}

function FirstActionPersonal({ pending, onCreate, onSkip }: { pending: boolean; onCreate: (title: string) => void; onSkip: () => void }) {
  const t = useTranslations("onboarding.firstAction");
  const [title, setTitle] = useState("");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[20px] font-medium tracking-[-0.01em]">{t("personalHeading")}</h1>
      <Field label={t("taskTitle")} htmlFor="ob-task">
        <Input id="ob-task" dir="auto" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={500} placeholder={t("taskPlaceholder")} />
      </Field>
      <div className="flex gap-3">
        <Button variant="primary" size="lg" disabled={pending || title.trim().length === 0} onClick={() => onCreate(title.trim())}>
          {t("createTask")}
        </Button>
        <Button variant="secondary" size="lg" disabled={pending} onClick={onSkip}>
          {t("skip")}
        </Button>
      </div>
    </div>
  );
}

function FirstActionTeam({
  pending,
  onInvite,
  onCreateProject,
  onSkip,
}: {
  pending: boolean;
  onInvite: (email: string) => void;
  onCreateProject: (name: string) => void;
  onSkip: () => void;
}) {
  const t = useTranslations("onboarding.firstAction");
  const [email, setEmail] = useState("");
  const [projectName, setProjectName] = useState("");
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-[20px] font-medium tracking-[-0.01em]">{t("teamHeading")}</h1>
      <div className="flex flex-col gap-3">
        <Field label={t("inviteEmail")} htmlFor="ob-invite">
          <Input id="ob-invite" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("inviteEmailPlaceholder")} />
        </Field>
        <Button variant="primary" disabled={pending || email.trim().length === 0} onClick={() => onInvite(email.trim())} className="self-start">
          {t("sendInvite")}
        </Button>
      </div>
      <div className="flex flex-col gap-3">
        <Field label={t("projectName")} htmlFor="ob-project">
          <Input id="ob-project" dir="auto" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder={t("projectPlaceholder")} />
        </Field>
        <Button variant="secondary" disabled={pending || projectName.trim().length === 0} onClick={() => onCreateProject(projectName.trim())} className="self-start">
          {t("createProject")}
        </Button>
      </div>
      <Button variant="ghost" size="lg" disabled={pending} onClick={onSkip}>
        {t("skip")}
      </Button>
    </div>
  );
}
