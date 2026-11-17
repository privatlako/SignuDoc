import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import type pg from "pg";

import { openTestDatabase } from "./db/test-database.ts";
import { deleteEnvelope } from "./envelope-deletion.ts";
import { EnvelopeMutationError } from "./envelopes.ts";
import { createStorageService } from "./services/storage.ts";

// Deleting an envelope by hand, against a real Postgres.
// Run with `npm run test:db`.

let database: pg.Pool;
let storageDir: string;
const createdUsers: string[] = [];

before(async () => {
  database = await openTestDatabase();
  globalThis.__signudocPgPool = database;
  storageDir = await mkdtemp(path.join(tmpdir(), "signudoc-delete-"));
});

after(async () => {
  await database.query(`delete from public."user" where id = any($1)`, [
    createdUsers,
  ]);
  await database.end();
  await rm(storageDir, { force: true, recursive: true });
});

function storage() {
  return createStorageService({
    env: { STORAGE_DRIVER: "local", STORAGE_LOCAL_DIR: storageDir },
  });
}

async function exists(key: string) {
  try {
    await access(path.join(storageDir, key));
    return true;
  } catch {
    return false;
  }
}

async function createEnvelope(status: "sent" | "voided" | "completed") {
  const userId = randomUUID();
  const envelopeId = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const sourceKey = `test/${envelopeId}.pdf`;

  createdUsers.push(userId);
  await mkdir(path.join(storageDir, "test"), { recursive: true });
  await writeFile(path.join(storageDir, sourceKey), "%PDF-1.4\n");
  await database.query(
    `insert into public."user" (id, name, email, role) values ($1, 'Sam Sender', $2, 'user')`,
    [userId, `${userId}@example.test`],
  );
  await database.query(
    `
      insert into envelopes (
        id, user_id, title, status, source_pdf_key, source_pdf_filename,
        source_pdf_size_bytes, page_count, source_pdf_hash, sent_at
      ) values ($1, $2, 'Lease', 'sent', $3, 'lease.pdf', 10, 1, $4, $5)
    `,
    [envelopeId, userId, sourceKey, "a".repeat(64), now - 60],
  );

  if (status === "voided") {
    await database.query(
      `update envelopes set status = 'voided', voided_at = $2 where id = $1`,
      [envelopeId, now],
    );
  }

  return { envelopeId, sourceKey, userId };
}

async function envelopeExists(envelopeId: string) {
  const result = await database.query(`select 1 from envelopes where id = $1`, [
    envelopeId,
  ]);

  return result.rowCount === 1;
}

test("an envelope still out for signature must be voided before it is deleted", async () => {
  const { envelopeId, sourceKey, userId } = await createEnvelope("sent");

  await assert.rejects(
    deleteEnvelope({ email: null, userId }, envelopeId, {
      database,
      storageService: storage(),
    }),
    (error: unknown) =>
      error instanceof EnvelopeMutationError && error.statusCode === 409,
  );
  assert.equal(await envelopeExists(envelopeId), true);
  assert.equal(await exists(sourceKey), true);
});

test("a voided envelope is deleted with its files, and the install's trail says so", async () => {
  const { envelopeId, sourceKey, userId } = await createEnvelope("voided");

  const deleted = await deleteEnvelope(
    { email: `${userId}@example.test`, userId },
    envelopeId,
    { database, storageService: storage() },
  );

  assert.deepEqual(deleted, { id: envelopeId, status: "voided" });
  assert.equal(await envelopeExists(envelopeId), false);
  assert.equal(await exists(sourceKey), false);

  const trail = await database.query<{ metadata: Record<string, unknown> }>(
    `
      select metadata from system_audit_events
      where event = 'envelope_deleted' and actor_user_id = $1
    `,
    [userId],
  );

  assert.equal(trail.rowCount, 1);
  assert.equal(trail.rows[0]?.metadata.envelopeId, envelopeId);
  assert.equal(trail.rows[0]?.metadata.title, "Lease");
});

test("nobody can delete someone else's envelope", async () => {
  const { envelopeId } = await createEnvelope("voided");

  await assert.rejects(
    deleteEnvelope({ email: null, userId: randomUUID() }, envelopeId, {
      database,
      storageService: storage(),
    }),
    (error: unknown) =>
      error instanceof EnvelopeMutationError && error.statusCode === 404,
  );
  assert.equal(await envelopeExists(envelopeId), true);
});
