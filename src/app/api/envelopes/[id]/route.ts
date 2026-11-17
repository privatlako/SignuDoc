import { NextResponse } from "next/server";

import { requireVerifiedSenderSession } from "@/lib/auth/route-session";
import { getDb } from "@/lib/db/connection";
import { deleteEnvelope } from "@/lib/envelope-deletion";
import { EnvelopeMutationError } from "@/lib/envelopes";
import { logRouteError } from "@/lib/security/logging";
import { getClientIpAddress, getRequestPathname } from "@/lib/security/request";

type EnvelopeRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function DELETE(request: Request, context: EnvelopeRouteContext) {
  const sessionResult = await requireVerifiedSenderSession(request);

  if (sessionResult instanceof Response) {
    return sessionResult;
  }

  const session = sessionResult;
  const { id } = await context.params;

  try {
    const envelope = await deleteEnvelope(
      {
        email: session.user.email,
        ipAddress: getClientIpAddress(request.headers),
        userAgent: request.headers.get("user-agent"),
        userId: session.user.id,
      },
      id,
      { database: getDb() },
    );

    return NextResponse.json(
      {
        deletedEnvelopeId: envelope.id,
        redirectPath: "/dashboard",
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof EnvelopeMutationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    logRouteError(error, {
      category: "envelope_delete_failure",
      ipAddress: getClientIpAddress(request.headers),
      message: "Unexpected failure while deleting an envelope.",
      path: getRequestPathname(request),
      userId: session.user.id,
    });

    return NextResponse.json(
      { error: "Nem sikerült törölni a szerződést." },
      { status: 500 },
    );
  }
}
