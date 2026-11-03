import { HomeSequence } from "@/features/home/components/HomeSequence";

export default function HomePage() {
  return <div className="space-y-12 md:space-y-16">
    <HomeSequence />
    <section className="max-w-reading space-y-4 border-t border-hairline pt-8">
      <h2>Ясна обратна връзка</h2>
      <p>За обективните задачи подготвяме проверка с обяснение. Разширените отговори и есетата ще имат насоки за самооценка — без автоматично присъдена официална оценка.</p>
      <p className="text-caption text-muted">Платформата е в разработка. Публикуваме учебни материали след редакторска проверка.</p>
    </section>
  </div>;
}
