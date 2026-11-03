"use client";

import "./globals.css";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return <html lang="bg"><body><main className="mx-auto max-w-reading space-y-6 px-4 py-16">
    <h1>Страницата не се зареди</h1><p>Нещо се обърка. Опитай отново.</p>
    <Button type="button" onClick={retry}>Опитай отново</Button>
    <p><Link href="/" className="inline-flex min-h-11 items-center text-primary underline">Към началото</Link></p>
  </main></body></html>;
}
