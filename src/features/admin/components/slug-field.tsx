"use client";

import { Button } from "@/components/ui/button";
import { slugFromTitle } from "../slug";
import { TextField } from "./form-fields";

/** Slug input with guidance and a one-click suggestion from the title. */
export function SlugField({ id, value, title, publicPathPrefix, errors, onChange }: {
  id: string; value: string; title: string; publicPathPrefix: string | null; errors: readonly string[]; onChange: (slug: string) => void;
}) {
  const suggestion = slugFromTitle(title);
  return <div className="space-y-2">
    <TextField id={id} label="Адрес (slug)" value={value} maxLength={200} required autoComplete="off" spellCheck={false}
      hint={publicPathPrefix === null
        ? "Уникален идентификатор в рамките на предмета. Малки букви, цифри и единични тирета."
        : <>Част от публичния адрес: {publicPathPrefix}<strong>{value || "…"}</strong>. Малки букви, цифри и единични тирета.</>}
      errors={errors} onChange={(event) => onChange(event.target.value)} />
    <Button type="button" variant="secondary" disabled={!suggestion || suggestion === value} onClick={() => onChange(suggestion)}>
      Предложи от заглавието
    </Button>
  </div>;
}
