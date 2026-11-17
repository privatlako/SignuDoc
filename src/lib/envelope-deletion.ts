import { type DbExecutor, getDb } from "./db/connection.ts";
import {
  deleteDraftEnvelope,
  EnvelopeMutationError,
  getEnvelopeByIdForUser,
} from "./envelopes.ts";
import { deleteEnvelopesAndFiles } from "./retention.ts";
import { recordSystemAuditEvent } from "./services/system-audit.ts";
import {
  createStorageService,
  type StorageService,
} from "./services/storage.ts";
import { readStoredSettings } from "./settings.ts";

// Deleting an envelope by hand, from its page.
//
// - A draft goes at once, as before.
// - A finished envelope (completed, declined or voided) is deleted for good
//   with all of its files: the source PDF, the signed PDF and the
//   certificates. The install's own trail keeps a line saying who deleted
//   which envelope and when, since the envelope's own trail goes with it.
// - An envelope still out for signature must be voided first, so nothing
//   disappears while someone is signing it.
// - With Part 11 mode on, finished records are kept: they can only leave
//   through the retention period.

export type DeleteEnvelopeActor = {
  email: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  userId: string;
};

export async function deleteEnvelope(
  actor: DeleteEnvelopeActor,
  envelopeId: string,
  {
    database = getDb(),
    storageService = createStorageService(),
  }: {
    database?: DbExecutor;
    storageService?: StorageService;
  } = {},
): Promise<{ id: string; status: string }> {
  const envelope = await getEnvelopeByIdForUser(
    actor.userId,
    envelopeId,
    database,
  );

  if (!envelope) {
    throw new EnvelopeMutationError("Envelope not found.", 404);
  }

  if (envelope.status === "draft") {
    const deleted = await deleteDraftEnvelope(actor.userId, envelopeId, {
      database,
      storageService,
    });

    return { id: deleted.id, status: deleted.status };
  }

  if (envelope.status === "sent") {
    throw new EnvelopeMutationError(
      "This envelope is still out for signature. Void it first, then delete it.",
      409,
    );
  }

  if ((await readStoredSettings(database))?.part11Mode) {
    throw new EnvelopeMutationError(
      "Part 11 mode keeps finished records. They leave only through the retention period.",
      409,
    );
  }

  const deletedCount = await deleteEnvelopesAndFiles(
    [envelope.id],
    database,
    storageService,
  );

  if (deletedCount !== 1) {
    throw new EnvelopeMutationError(
      "This envelope could not be deleted. Please try again.",
      409,
    );
  }

  await recordSystemAuditEvent(
    {
      actorEmail: actor.email,
      actorUserId: actor.userId,
      event: "envelope_deleted",
      ipAddress: actor.ipAddress ?? null,
      metadata: {
        envelopeId: envelope.id,
        sourcePdfHash: envelope.sourcePdfHash,
        status: envelope.status,
        title: envelope.title,
      },
      targetUserId: envelope.userId,
      userAgent: actor.userAgent ?? null,
    },
    database,
  ).catch((error: unknown) => {
    console.error(
      `The deletion of envelope ${envelope.id} was not written to the install's trail:`,
      error,
    );
  });

  return { id: envelope.id, status: envelope.status };
}
