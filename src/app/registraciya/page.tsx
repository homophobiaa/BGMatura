import { redirect } from "next/navigation";

import { safeReturnPath } from "@/features/account/return-path";

/** Registration and sign-in are one step with Google, so the registration address leads to the same page. */
export default async function RegistrationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const returnTo = safeReturnPath((await searchParams).next);
  redirect(returnTo === "/" ? "/vhod" : `/vhod?next=${encodeURIComponent(returnTo)}`);
}
