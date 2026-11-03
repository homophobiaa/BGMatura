import Link from "next/link";
import { Feedback } from "@/components/ui/feedback";

export default function ExamEntry() {
  return <div className="max-w-reading space-y-6"><h1>Пробна матура</h1>
    <p>Симулациите с време и преглед на отговорите са в разработка.</p>
    <Feedback>Все още няма публикувани пробни матури. Есетата ще имат насоки за самооценка, без автоматична официална оценка.</Feedback>
    <Link href="/uchi" className="inline-flex min-h-11 items-center text-primary underline">Към учебните материали</Link>
  </div>;
}
