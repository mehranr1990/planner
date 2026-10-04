"use client";

import type { ChangeEvent } from "react";
import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import type { PersonRef } from "@/components/ui/people";
import { useFormat } from "@/i18n/use-format";
import { createCommentAction, deleteCommentAction, updateCommentAction } from "@/features/collaboration/server/actions";
import { renderCommentBody } from "@/features/collaboration/domain/mentions";
import type { CommentItem } from "@/features/collaboration/types";

function MentionBody({ body }: { body: string }) {
  return (
    <p dir="auto" className="min-w-0 text-[13.5px] leading-6 whitespace-pre-wrap">
      {renderCommentBody(body).map((part, i) =>
        part.type === "mention" ? (
          <span key={i} className="rounded-[6px] bg-accent-blue-soft px-1 font-medium">
            @{part.name}
          </span>
        ) : (
          <span key={i}>{part.value}</span>
        ),
      )}
    </p>
  );
}

function Composer({
  mentionCandidates,
  placeholder,
  submitLabel,
  initialValue = "",
  autoFocus,
  pending,
  onSubmit,
  onCancel,
}: {
  mentionCandidates: readonly PersonRef[];
  placeholder: string;
  submitLabel: string;
  initialValue?: string;
  autoFocus?: boolean;
  pending: boolean;
  onSubmit: (body: string) => void;
  onCancel?: () => void;
}) {
  const t = useTranslations("tasks.comments");
  const [value, setValue] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<PersonRef[]>([]);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    setValue(v);
    const caret = e.target.selectionStart ?? v.length;
    const upToCaret = v.slice(0, caret);
    const match = /(?:^|\s)@([^\s@]{0,30})$/.exec(upToCaret);
    if (match) {
      const q = match[1]!.toLowerCase();
      setMentionStart(caret - match[1]!.length - 1);
      setSuggestions(mentionCandidates.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 6));
    } else {
      setMentionStart(null);
      setSuggestions([]);
    }
  }

  function pick(person: PersonRef) {
    if (mentionStart === null) return;
    const caret = ref.current?.selectionStart ?? value.length;
    const before = value.slice(0, mentionStart);
    const after = value.slice(caret);
    const token = `@[${person.name.replace(/[[\]()]/g, "")}](${person.id})`;
    setValue(`${before}${token} ${after}`);
    setMentionStart(null);
    setSuggestions([]);
    requestAnimationFrame(() => ref.current?.focus());
  }

  function submit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue("");
  }

  return (
    <div className="relative flex flex-col gap-2">
      <Textarea ref={ref} value={value} onChange={handleChange} placeholder={placeholder} dir="auto" rows={2} maxLength={5000} autoFocus={autoFocus} />
      {suggestions.length > 0 && (
        <ul
          role="listbox"
          aria-label={t("mentionSuggestions")}
          className="absolute top-full z-10 mt-1 flex w-full max-w-xs flex-col gap-0.5 rounded-[14px] bg-surface-elevated p-1 shadow-lg ring-1 ring-border-subtle"
        >
          {suggestions.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => pick(p)} className="flex w-full items-center gap-2 rounded-[10px] px-2 py-1.5 text-start text-[13px] hover:bg-surface-secondary">
                <Avatar person={p} size="xs" />
                <span className="min-w-0 flex-1 truncate" dir="auto">
                  {p.name}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <Button size="sm" variant="primary" disabled={pending || !value.trim()} onClick={submit}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button size="sm" variant="secondary" disabled={pending} onClick={onCancel}>
            {t("cancel")}
          </Button>
        )}
      </div>
    </div>
  );
}

function CommentRow({
  comment,
  timezone,
  mentionCandidates,
  editing,
  pending,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onReply,
}: {
  comment: CommentItem;
  timezone: string;
  mentionCandidates: readonly PersonRef[];
  editing: boolean;
  pending: boolean;
  onStartEdit?: () => void;
  onCancelEdit?: () => void;
  onSaveEdit?: (body: string) => void;
  onDelete?: () => void;
  onReply?: () => void;
}) {
  const t = useTranslations("tasks.comments");
  const f = useFormat();

  return (
    <div className="flex gap-3">
      <Avatar person={comment.author} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
          <span className="font-medium" dir="auto">
            {comment.author.name}
          </span>
          <time dateTime={comment.createdAt} className="shrink-0 text-foreground-subtle" data-volatile>
            {f.dateTime(new Date(comment.createdAt), timezone)}
          </time>
          {comment.editedAt && <span className="text-foreground-subtle">{t("edited")}</span>}
        </div>
        {editing ? (
          <div className="mt-2">
            <Composer
              mentionCandidates={mentionCandidates}
              placeholder={t("placeholder")}
              submitLabel={t("save")}
              initialValue={comment.body ?? ""}
              autoFocus
              pending={pending}
              onSubmit={(body) => onSaveEdit?.(body)}
              onCancel={onCancelEdit}
            />
          </div>
        ) : comment.body === null ? (
          <p className="mt-1 text-[13px] text-foreground-subtle italic">{t("deleted")}</p>
        ) : (
          <div className="mt-1">
            <MentionBody body={comment.body} />
          </div>
        )}
        {!editing && comment.body !== null && (
          <div className="mt-1 flex items-center gap-3 text-[12px] text-foreground-muted">
            {onReply && (
              <button type="button" onClick={onReply} className="hover:text-foreground">
                {t("reply")}
              </button>
            )}
            {comment.canEdit && (
              <button type="button" onClick={onStartEdit} className="hover:text-foreground">
                {t("edit")}
              </button>
            )}
            {comment.canDelete && (
              <button type="button" disabled={pending} onClick={onDelete} className="hover:text-accent-red">
                {t("delete")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function CommentsSection({
  taskId,
  comments,
  mentionCandidates,
  timezone,
  currentUser,
}: {
  taskId: string;
  comments: readonly CommentItem[];
  mentionCandidates: readonly PersonRef[];
  timezone: string;
  currentUser: PersonRef;
}) {
  const t = useTranslations("tasks.comments");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState(comments);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  function submitNew(body: string, replyToId: string | null) {
    setError(null);
    const optimistic: CommentItem = {
      id: `pending-${items.length}-${body.length}`,
      body,
      replyToId,
      author: currentUser,
      createdAt: new Date().toISOString(),
      editedAt: null,
      deletedAt: null,
      canEdit: true,
      canDelete: true,
    };
    setItems((prev) => [...prev, optimistic]);
    setReplyingTo(null);
    start(async () => {
      const res = await createCommentAction({ taskId, body, replyToId });
      if (!res.ok) {
        setError(res.error ?? null);
        setItems((prev) => prev.filter((c) => c.id !== optimistic.id));
      } else {
        setItems((prev) => prev.map((c) => (c.id === optimistic.id ? { ...c, id: res.data.id } : c)));
      }
    });
  }

  function submitEdit(id: string, body: string) {
    setError(null);
    const previous = items;
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, body, editedAt: new Date().toISOString() } : c)));
    setEditingId(null);
    start(async () => {
      const res = await updateCommentAction({ commentId: id, body });
      if (!res.ok) {
        setError(res.error ?? null);
        setItems(previous);
      }
    });
  }

  function submitDelete(id: string) {
    setError(null);
    const previous = items;
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, body: null, deletedAt: new Date().toISOString(), canEdit: false, canDelete: false } : c)));
    start(async () => {
      const res = await deleteCommentAction({ commentId: id });
      if (!res.ok) {
        setError(res.error ?? null);
        setItems(previous);
      }
    });
  }

  const topLevel = items.filter((c) => !c.replyToId);
  const repliesOf = (id: string) => items.filter((c) => c.replyToId === id);

  return (
    <section aria-labelledby="comments-heading" className="mt-8">
      <h3 id="comments-heading" className="mb-2 px-1 text-[12.5px] text-foreground-muted">
        {t("heading")}
      </h3>

      {error && (
        <div role="alert" className="mb-3 rounded-[14px] bg-accent-red-soft/40 px-3 py-2 text-[12.5px]">
          {error}
        </div>
      )}

      {topLevel.length === 0 ? (
        <p className="px-1 text-[13px] text-foreground-subtle">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {topLevel.map((c) => (
            <li key={c.id} className="flex flex-col gap-2">
              <CommentRow
                comment={c}
                timezone={timezone}
                mentionCandidates={mentionCandidates}
                editing={editingId === c.id}
                pending={pending}
                onStartEdit={() => setEditingId(c.id)}
                onCancelEdit={() => setEditingId(null)}
                onSaveEdit={(body) => submitEdit(c.id, body)}
                onDelete={() => submitDelete(c.id)}
                onReply={() => setReplyingTo(replyingTo === c.id ? null : c.id)}
              />
              {repliesOf(c.id).length > 0 && (
                <ul className="ms-11 flex flex-col gap-3 border-s-2 border-border-subtle ps-3">
                  {repliesOf(c.id).map((r) => (
                    <li key={r.id}>
                      <CommentRow
                        comment={r}
                        timezone={timezone}
                        mentionCandidates={mentionCandidates}
                        editing={editingId === r.id}
                        pending={pending}
                        onStartEdit={() => setEditingId(r.id)}
                        onCancelEdit={() => setEditingId(null)}
                        onSaveEdit={(body) => submitEdit(r.id, body)}
                        onDelete={() => submitDelete(r.id)}
                      />
                    </li>
                  ))}
                </ul>
              )}
              {replyingTo === c.id && (
                <div className="ms-11">
                  <Composer
                    mentionCandidates={mentionCandidates}
                    placeholder={t("replyPlaceholder")}
                    submitLabel={t("reply")}
                    autoFocus
                    pending={pending}
                    onSubmit={(body) => submitNew(body, c.id)}
                    onCancel={() => setReplyingTo(null)}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        <Composer mentionCandidates={mentionCandidates} placeholder={t("placeholder")} submitLabel={t("post")} pending={pending} onSubmit={(body) => submitNew(body, null)} />
      </div>
    </section>
  );
}
