import type { Metadata } from "next";
import Link from "next/link";

import { inactiveAccountMonths } from "@/features/account/retention";

export const metadata: Metadata = {
  title: "Поверителност — BG Matura",
  description: "Какви данни пазим, ако влезеш с профил, за какво, за колко време и как да ги изтриеш.",
};

export default function PrivacyPage() {
  return (
    <article className="max-w-reading space-y-8">
      <header className="space-y-4">
        <h1>Поверителност</h1>
        <p className="text-body-lg">
          Не ти трябва профил, за да учиш, да се упражняваш или да решаваш пробни матури. Профилът е по желание и служи само за да запазиш резултатите си.
        </p>
      </header>

      <section aria-labelledby="without" className="space-y-3">
        <h2 id="without" className="text-title">Без профил</h2>
        <p>Резултатите от упражненията и пробните матури се пазят в този браузър до 30 дни, защото иначе не бихме могли да ти ги покажем отново. Не искаме име, имейл или друга лична информация.</p>
      </section>

      <section aria-labelledby="with" className="space-y-3">
        <h2 id="with" className="text-title">С профил</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li><strong>Какво пазим:</strong> името и потвърдения имейл от твоя Google акаунт и резултатите, които си запазил. Не пазим парола, снимка, телефон или адрес.</li>
          <li><strong>Защо:</strong> за да влизаш и да виждаш резултатите си от всяко устройство. Не ги използваме за реклама и не ги продаваме.</li>
          <li><strong>Колко време:</strong> докато не изтриеш профила си. Профил, в който не си влизал {inactiveAccountMonths} месеца, се изтрива автоматично заедно с резултатите му. Изтеклите входове се изтриват.</li>
          <li><strong>Кой ги вижда:</strong> само ти. Редакторите на съдържанието нямат достъп до резултатите ти. Достъп до базата данни имат само отговорните за поддръжката на сайта.</li>
          <li><strong>Услуги:</strong> входът минава през Google. Google вижда, че влизаш в BG Matura, според собствените си условия.</li>
        </ul>
      </section>

      <section aria-labelledby="delete" className="space-y-3">
        <h2 id="delete" className="text-title">Как да изтриеш всичко</h2>
        <p>Влез в <Link href="/profil" className="text-primary underline underline-offset-4">профила си</Link> и избери „Изтрий профила и данните ми“. Профилът, входът и всички запазени резултати се изтриват веднага и завинаги.</p>
      </section>

      <section aria-labelledby="age" className="space-y-3">
        <h2 id="age" className="text-title">Възраст</h2>
        <p>Профил могат да правят ученици на 14 или повече години. Ако си под 14, използвай сайта без профил — всичко за учене работи и така. Не събираме възраст и не питаме за нея.</p>
      </section>

      <p className="text-caption text-muted">Това известие е работен текст и трябва да бъде прегледано от юрист преди официално пускане.</p>
    </article>
  );
}
