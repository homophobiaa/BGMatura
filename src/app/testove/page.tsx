import Link from "next/link";
import { Feedback } from "@/components/ui/feedback";

export default function PracticeEntry() {
  return <div className="max-w-reading space-y-6"><h1>Тестове</h1>
    <p>Упражненията по теми с обяснения към отговорите са в разработка.</p>
    <Feedback>Все още няма публикувани тестове. Можеш да започнеш с учебните материали.</Feedback>
    <Link href="/uchi" className="inline-flex min-h-11 items-center text-primary underline">Към учебните материали</Link>
  </div>;
}
