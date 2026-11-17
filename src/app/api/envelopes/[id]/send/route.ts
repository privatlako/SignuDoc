import { NextResponse } from "next/server";

import { requireVerifiedSenderSession } from "@/lib/auth/route-session";
import { customerOfferSchema } from "@/lib/customer-contract";
import { getDb } from "@/lib/db/connection";
import { EnvelopeMutationError, sendDraftEnvelope } from "@/lib/envelopes";
import { sendEnvelopeOptionsSchema } from "@/lib/schemas/envelope";
import { logRouteError } from "@/lib/security/logging";
import {
  applyRateLimit,
  buildRateLimitKey,
} from "@/lib/security/route-controls";
import {
  getClientIpAddress,
  getRequestPathname,
  getRequestUserAgent,
} from "@/lib/security/request";

type EnvelopeSendRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type SendEnvelopeRequest = {
  contractType?: unknown;
  expiresInDays?: unknown;
  offer?: unknown;
  reminderIntervalDays?: unknown;
  signatureLevel?: unknown;
  permittedUseConfirmed?: boolean;
};

export async function POST(
  request: Request,
  context: EnvelopeSendRouteContext,
) {
  const sessionResult = await requireVerifiedSenderSession(request);

  if (sessionResult instanceof Response) {
    return sessionResult;
  }

  const session = sessionResult;
  const { id } = await context.params;
  const ipAddress = getClientIpAddress(request.headers);
  const rateLimitResponse = await applyRateLimit({
    category: "draft_envelope_send",
    key: buildRateLimitKey(["envelope-send", session.user.id]),
    limit: 10,
    request,
    userId: session.user.id,
    windowMs: 60 * 60 * 1000,
  });

  if (rateLimitResponse) {
    rateLimitResponse.headers.set("cache-control", "private, no-store");
    return rateLimitResponse;
  }

  const body = (await request
    .json()
    .catch(() => null)) as SendEnvelopeRequest | null;

  if (body?.permittedUseConfirmed !== true) {
    return NextResponse.json(
      {
        error:
          "Elküldés előtt erősítsd meg, hogy ez a szerződés szokásos üzleti megállapodás.",
      },
      { status: 400 },
    );
  }

  const options = sendEnvelopeOptionsSchema.safeParse({
    expiresInDays: body.expiresInDays ?? undefined,
    reminderIntervalDays: body.reminderIntervalDays ?? undefined,
    signatureLevel: body.signatureLevel ?? undefined,
    contractType: body.contractType ?? undefined,
  });

  if (!options.success) {
    return NextResponse.json(
      {
        error:
          "A határidő 1 és 365 nap között lehet, az emlékeztetők 1–30 naponként, az aláírás típusa pedig csak olyan lehet, amelyet ez a telepítés kínál.",
      },
      { status: 400 },
    );
  }

  const contractType = options.data.contractType ?? "partner";
  let offer = null;

  if (contractType === "customer") {
    const parsedOffer = customerOfferSchema.safeParse(body.offer);

    if (!parsedOffer.success) {
      return NextResponse.json(
        {
          error:
            parsedOffer.error.issues[0]?.message ??
            "Ellenőrizd az ajánlat adatait.",
        },
        { status: 400 },
      );
    }

    offer = parsedOffer.data;
  }

  try {
    const result = await sendDraftEnvelope(
      session.user.id,
      id,
      {
        expiresInDays: options.data.expiresInDays,
        reminderIntervalDays: options.data.reminderIntervalDays,
        signatureLevel: options.data.signatureLevel,
        contractType,
        offer,
        ipAddress,
        senderEmail: session.user.email,
        senderName:
          typeof session.user.name === "string" && session.user.name.trim()
            ? session.user.name
            : session.user.email,
        userAgent: getRequestUserAgent(request.headers),
      },
      {
        database: getDb(),
      },
    );

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof EnvelopeMutationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    logRouteError(error, {
      category: "draft_envelope_send_failure",
      ipAddress,
      message: "Unexpected failure while sending an envelope.",
      path: getRequestPathname(request),
      userId: session.user.id,
    });

    return NextResponse.json(
      { error: "Nem sikerült elküldeni a szerződést." },
      { status: 500 },
    );
  }
}
