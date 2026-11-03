import Link from "next/link";

export default function LearningHub() {
  return <div className="max-w-reading space-y-6"><h1>Учи</h1>
    <p className="text-body-lg">Избери област за преговор. Материалите са достъпни без регистрация.</p>
    <ul className="grid gap-4 md:grid-cols-2">
      <li><Link className="block rounded-lg bg-surface-card p-6 text-title text-primary underline" href="/literatura">Литература</Link></li>
      <li><Link className="block rounded-lg bg-surface-card p-6 text-title text-primary underline" href="/balgarski-ezik">Български език</Link></li>
    </ul>
  </div>;
}
