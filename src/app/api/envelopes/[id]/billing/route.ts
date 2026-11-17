import { NextResponse } from "next/server";
import { z } from "zod";

import { requireVerifiedSenderSession } from "@/lib/auth/route-session";
import { BillingStatusError, setBillingStatusForUser } from "@/lib/billing";
import { billingStatusSchema } from "@/lib/customer-contract";
import { getDb } from "@/lib/db/connection";
import { logRouteError } from "@/lib/security/logging";
import {
  applyRateLimit,
  buildRateLimitKey,
} from "@/lib/security/route-controls";
import { getClientIpAddress, getRequestPathname } from "@/lib/security/request";

type EnvelopeBillingRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const noStore = { "cache-control": "private, no-store" };
const billingStatusRequestSchema = z.object({ status: billingStatusSchema });

// Marks a signed customer contract as invoiced, or back to waiting for it.
export async function POST(
  request: Request,
  context: EnvelopeBillingRouteContext,
) {
  const sessionResult = await requireVerifiedSenderSession(request);

  if (sessionResult instanceof Response) {
    return sessionResult;
  }

  const session = sessionResult;
  const { id } = await context.params;
  const ipAddress = getClientIpAddress(request.headers);
  const rateLimitResponse = await applyRateLimit({
    category: "envelope_billing_status",
    key: buildRateLimitKey(["envelope-billing", session.user.id, id]),
    limit: 30,
    request,
    userId: session.user.id,
    windowMs: 60 * 60 * 1000,
  });

  if (rateLimitResponse) {
    rateLimitResponse.headers.set("cache-control", "private, no-store");
    return rateLimitResponse;
  }

  const parsed = billingStatusRequestSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Az állapot „pending” vagy „invoiced” lehet." },
      { headers: noStore, status: 400 },
    );
  }

  try {
    const result = await setBillingStatusForUser(
      session.user.id,
      id,
      parsed.data.status,
      getDb(),
    );

    return NextResponse.json(result, { headers: noStore, status: 200 });
  } catch (error) {
    if (error instanceof BillingStatusError) {
      return NextResponse.json(
        { error: error.message },
        { headers: noStore, status: error.statusCode },
      );
    }

    logRouteError(error, {
      category: "envelope_billing_status_failure",
      ipAddress,
      message:
        "Unexpected failure while changing an envelope's billing status.",
      path: getRequestPathname(request),
      userId: session.user.id,
    });

    return NextResponse.json(
      { error: "Nem sikerült módosítani a számlázási állapotot." },
      { headers: noStore, status: 500 },
    );
  }
}
