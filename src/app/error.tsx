"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Feedback } from "@/components/ui/feedback";

// Do not render or log error messages: driver errors can contain private data.
export default function ErrorPage({ retry }: { error: unknown; retry: () => void }) {
  return <section className="max-w-reading space-y-6"><h1>Съдържанието не се зареди</h1>
    <Feedback tone="error">Нещо се обърка. Опитай отново.</Feedback>
    <div className="flex flex-wrap gap-3"><Button type="button" onClick={retry}>Опитай отново</Button>
      <Button asChild variant="secondary"><Link href="/">Към началото</Link></Button></div>
  </section>;
}
