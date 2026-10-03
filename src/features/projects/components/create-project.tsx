"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { createProjectAction } from "../server/actions";

const COLORS = [
  { value: "blue", className: "bg-accent-blue-soft" },
  { value: "yellow", className: "bg-accent-yellow-soft" },
  { value: "peach", className: "bg-accent-peach-soft" },
  { value: "red", className: "bg-accent-red-soft" },
  { value: "green", className: "bg-accent-green-soft" },
  { value: "slate", className: "bg-accent-slate-soft" },
] as const;

export function CreateProjectButton({ contexts, defaultContext }: { contexts: { value: string; label: string }[]; defaultContext: string }) {
  const t = useTranslations("projects");
  const tc = useTranslations("common");
  // The button can appear twice on a page (header + empty state); ids must stay unique.
  const uid = useId();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [color, setColor] = useState<(typeof COLORS)[number]["value"]>("blue");
  const [context, setContext] = useState(defaultContext);

  const submit = (form: FormData) => {
    setError(null);
    start(async () => {
      const res = await createProjectAction({
        name: String(form.get("name") ?? ""),
        description: String(form.get("description") ?? ""),
        color,
        context,
        visibility: form.get("private") === "on" ? "PRIVATE" : "WORKSPACE",
      });
      if (!res.ok) return setError(res.error);
      setOpen(false);
      router.push(`/projects/${res.data.id}`);
    });
  };

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden /> {t("new")}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("create.title")}>
        <form action={submit} className="flex flex-col gap-4">
          <Field label={t("create.name")} htmlFor={`${uid}-name`}>
            <Input id={`${uid}-name`} name="name" dir="auto" required maxLength={120} autoFocus />
          </Field>
          <Field label={t("create.description")} htmlFor={`${uid}-description`}>
            <Textarea id={`${uid}-description`} name="description" dir="auto" maxLength={2000} />
          </Field>
          {contexts.length > 1 && (
            <Field label={t("create.space")} htmlFor={`${uid}-context`}>
              <Select id={`${uid}-context`} value={context} onChange={(e) => setContext(e.target.value)}>
                {contexts.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {context !== "personal" && (
            <label className="flex items-center gap-3 px-1 text-sm">
              <input type="checkbox" name="private" className="size-4 accent-[var(--surface-active)]" />
              {t("create.private")}
            </label>
          )}
          <fieldset>
            <legend className="mb-2 px-1 text-[12.5px] text-foreground-muted">{t("create.color")}</legend>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <label key={c.value} className="cursor-pointer">
                  <input type="radio" name="color" value={c.value} checked={color === c.value} onChange={() => setColor(c.value)} className="peer sr-only" />
                  <span className={cn("block size-8 rounded-full ring-2 ring-transparent ring-offset-2 ring-offset-surface-elevated peer-checked:ring-foreground peer-focus-visible:ring-focus-ring", c.className)} />
                  <span className="sr-only">{tc(`colors.${c.value}`)}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {error && (
            <p role="alert" className="text-[13px] text-accent-red">
              {error}
            </p>
          )}
          <DialogFooter cancelLabel={tc("actions.cancel")} submitLabel={t("create.submit")} onCancel={() => setOpen(false)} pending={pending} />
        </form>
      </Dialog>
    </>
  );
}
