import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse, TYPE, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";
import { describe, expect, it } from "vitest";
import { LOCALES } from "../config";
import { messagesFor, NAMESPACES } from "../messages";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else Object.assign(out, flatten(v, key));
  }
  return out;
}

/** Placeholder names, rich-text tags and plural/select presence of an ICU message. */
function signature(elements: MessageFormatElement[], acc = { args: new Set<string>(), tags: new Set<string>() }) {
  for (const el of elements) {
    if (el.type === TYPE.argument || el.type === TYPE.number || el.type === TYPE.date || el.type === TYPE.time) acc.args.add(el.value);
    if (el.type === TYPE.plural || el.type === TYPE.select) {
      acc.args.add(el.value);
      for (const opt of Object.values(el.options)) signature(opt.value, acc);
    }
    if (el.type === TYPE.tag) {
      acc.tags.add(el.value);
      signature(el.children, acc);
    }
  }
  return acc;
}

function hasOther(elements: MessageFormatElement[]): boolean {
  return elements.every((el) => {
    if (el.type === TYPE.plural || el.type === TYPE.select) return "other" in el.options && Object.values(el.options).every((o) => hasOther(o.value));
    if (el.type === TYPE.tag) return hasOther(el.children);
    return true;
  });
}

const flat = Object.fromEntries(LOCALES.map((l) => [l, flatten(messagesFor(l) as unknown as Tree)])) as Record<(typeof LOCALES)[number], Record<string, string>>;

describe("message catalogs", () => {
  it("one file per namespace in every locale, and nothing unregistered", () => {
    for (const locale of LOCALES) {
      const files = readdirSync(join(process.cwd(), "messages", locale)).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));
      expect(files.sort()).toEqual([...NAMESPACES].sort());
    }
  });

  it("every locale has exactly the English keys", () => {
    const en = Object.keys(flat.en).sort();
    for (const locale of LOCALES) expect(Object.keys(flat[locale]).sort()).toEqual(en);
  });

  it("no empty translations", () => {
    for (const locale of LOCALES) for (const [k, v] of Object.entries(flat[locale])) expect(v.trim(), `${locale}:${k}`).not.toBe("");
  });

  it("every message is valid ICU, plurals/selects have `other`, and placeholders/tags match English", () => {
    for (const [key, source] of Object.entries(flat.en)) {
      const enAst = parse(source);
      const enSig = signature(enAst);
      for (const locale of LOCALES) {
        const ast = parse(flat[locale][key]!);
        expect(hasOther(ast), `${locale}:${key} plural/select needs other`).toBe(true);
        const sig = signature(ast);
        expect([...sig.args].sort(), `${locale}:${key} placeholders`).toEqual([...enSig.args].sort());
        expect([...sig.tags].sort(), `${locale}:${key} tags`).toEqual([...enSig.tags].sort());
      }
    }
  });

  it("keys are semantic identifiers, not sentences", () => {
    for (const key of Object.keys(flat.en)) expect(key, key).toMatch(/^[A-Za-z0-9_.]+$/);
  });
});

describe("error codes", () => {
  // Every code thrown or returned by server code must exist in the errors catalog.
  const root = join(process.cwd(), "src");
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== "generated" && entry.name !== "__tests__") walk(p);
      else if (/\.tsx?$/.test(entry.name)) files.push(p);
    }
  };
  walk(root);
  const source = files.map((f) => readFileSync(f, "utf8")).join("\n");
  const codes = new Set<string>();
  for (const re of [/DomainError\("([A-Za-z]+)"\)/g, /localizeError\("([A-Za-z]+)"\)/g, /ScheduleError\("([A-Za-z]+)"\)/g, /RecurrenceError\("([A-Za-z]+)"\)/g]) {
    for (const m of source.matchAll(re)) codes.add(m[1]!);
  }
  // Zod messages in server schemas are codes too.
  for (const m of source.matchAll(/\.(?:min|max|refine)\([^)]*?,\s*"([a-z][A-Za-z]+)"\)/g)) codes.add(m[1]!);
  for (const m of source.matchAll(/z\.email\("([a-z][A-Za-z]+)"\)/g)) codes.add(m[1]!);

  it("finds the codes it is supposed to check", () => {
    expect(codes.size).toBeGreaterThan(15);
  });

  it.each([...codes])("%s is in the errors catalog for every locale", (code) => {
    for (const locale of LOCALES) expect(Object.keys(messagesFor(locale).errors)).toContain(code);
  });
});
