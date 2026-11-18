import { redirect } from "next/navigation";
import { connection } from "next/server";

import { LandingShell } from "@/components/landing/landing-shell";
import { getAuthSession } from "@/lib/auth/server";
import { redirectToSetupIfNeeded } from "@/lib/install";
import { isHostedMode } from "@/lib/utils/env";

const HOMILLA_SITE_URL = "https://homilla.hu";

// The front door. A new install sends its first visitor to setup. After
// that, the hosted service shows its landing page, and every other install
// goes straight to the app: the documents for someone who is signed in, the
// sign-in page for everyone else.
export default async function Home() {
  // Decided per request, not when the app was built.
  await connection();
  await redirectToSetupIfNeeded();

  if (isHostedMode()) {
    return <LandingShell />;
  }

  const session = await getAuthSession();

  // Homilla: the portal has no front page of its own. Staff who are signed
  // in go to their documents; everyone else is sent to homilla.hu, and the
  // sign-in page is at /belepes.
  redirect(session ? "/dashboard" : HOMILLA_SITE_URL);
}
