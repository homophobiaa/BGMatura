import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return <section className="max-w-reading space-y-6"><p className="text-caption text-muted">404</p>
    <h1>Страницата не е намерена</h1><p>Адресът е невалиден или материалът не е публикуван.</p>
    <Button asChild><Link href="/uchi">Към учебните материали</Link></Button>
  </section>;
}
