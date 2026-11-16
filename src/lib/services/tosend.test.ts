import assert from "node:assert/strict";
import { test } from "node:test";

import { createEmailService } from "./email.ts";
import { createToSendClient, parseAddress } from "./tosend.ts";

type Call = { body: unknown; headers: Record<string, string>; url: string };

function fakeFetch(
  responses: Array<{
    body: unknown;
    headers?: Record<string, string>;
    status: number;
  }>,
) {
  const calls: Call[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({
      body: JSON.parse(String(init.body)),
      headers: init.headers as Record<string, string>,
      url,
    });
    const next = responses.shift()!;

    return new Response(JSON.stringify(next.body), {
      headers: next.headers,
      status: next.status,
    });
  }) as unknown as typeof fetch;

  return { calls, impl };
}

const addresses = async () => ({
  senderAddress: "Homilla <szerzodes@homilla.hu>",
  supportAddress: "info@homilla.hu",
});

test("parseAddress splits a display name from the address", () => {
  assert.deepEqual(parseAddress("Homilla <szerzodes@homilla.hu>"), {
    email: "szerzodes@homilla.hu",
    name: "Homilla",
  });
  assert.deepEqual(parseAddress("a@b.hu"), { email: "a@b.hu" });
});

test("send posts a toSend email with base64 attachments", async () => {
  const { calls, impl } = fakeFetch([
    { body: { message_id: "m1" }, status: 200 },
  ]);
  const service = createEmailService({
    env: {},
    resolveAddresses: addresses,
    toSendClient: createToSendClient({ apiKey: "k", fetch: impl }),
  });

  const result = await service.send({
    attachments: [
      {
        content: new Uint8Array([1, 2, 3]),
        contentType: "application/pdf",
        filename: "a.pdf",
      },
    ],
    subject: "Szia",
    template: "test_email",
    textBody: "hello",
    to: "x@y.hu",
  });

  assert.equal(result.messageId, "m1");
  assert.equal(calls[0]!.url, "https://api.tosend.com/v2/emails");
  assert.equal(calls[0]!.headers.Authorization, "Bearer k");
  assert.deepEqual(calls[0]!.body, {
    attachments: [{ content: "AQID", name: "a.pdf", type: "application/pdf" }],
    from: { email: "szerzodes@homilla.hu", name: "Homilla" },
    headers: { "X-SignuDoc-Template": "test_email" },
    reply_to: "info@homilla.hu",
    subject: "Szia",
    text: "hello",
    to: [{ email: "x@y.hu" }],
  });
});

test("an idempotent send goes through the batch endpoint", async () => {
  const { calls, impl } = fakeFetch([
    {
      body: { results: [{ message_id: "m2", status: "success" }] },
      status: 200,
    },
  ]);
  const service = createEmailService({
    env: {},
    resolveAddresses: addresses,
    toSendClient: createToSendClient({ apiKey: "k", fetch: impl }),
  });

  const result = await service.send(
    { subject: "s", template: "test_email", textBody: "t", to: "x@y.hu" },
    { idempotencyKey: "key-1" },
  );

  assert.equal(result.messageId, "m2");
  assert.equal(calls[0]!.url, "https://api.tosend.com/v2/emails/batch");
  assert.equal(calls[0]!.headers["Idempotency-Key"], "key-1");
});

test("a rate-limited request is retried after the wait", async () => {
  const waits: number[] = [];
  const { calls, impl } = fakeFetch([
    {
      body: { message: "slow down", status_code: 429 },
      headers: { "retry-after": "5" },
      status: 429,
    },
    { body: { message_id: "m3" }, status: 200 },
  ]);
  const client = createToSendClient({
    apiKey: "k",
    fetch: impl,
    wait: async (ms) => {
      waits.push(ms);
    },
  });

  const id = await client.send({
    from: { email: "a@b.hu" },
    subject: "s",
    text: "t",
    to: [{ email: "x@y.hu" }],
  });

  assert.equal(id, "m3");
  assert.equal(calls.length, 2);
  assert.deepEqual(waits, [5000]);
});

test("an error response is thrown with its message", async () => {
  const { impl } = fakeFetch([
    {
      body: {
        errors: { from: "domain not verified" },
        message: "Validation failed",
        status_code: 422,
      },
      status: 422,
    },
  ]);
  const client = createToSendClient({ apiKey: "k", fetch: impl });

  await assert.rejects(
    client.send({
      from: { email: "a@b.hu" },
      subject: "s",
      text: "t",
      to: [{ email: "x@y.hu" }],
    }),
    /toSend 422: Validation failed – domain not verified/,
  );
});

test("a partly refused batch reports each message", async () => {
  const { impl } = fakeFetch([
    {
      body: {
        results: [
          { message_id: "m4", status: "success" },
          { message: "spam", status: "spam" },
        ],
      },
      status: 207,
    },
  ]);
  const service = createEmailService({
    env: {},
    resolveAddresses: addresses,
    toSendClient: createToSendClient({ apiKey: "k", fetch: impl }),
  });

  const results = await service.sendBatch([
    { subject: "s", template: "test_email", textBody: "t", to: "a@y.hu" },
    { subject: "s", template: "test_email", textBody: "t", to: "b@y.hu" },
  ]);

  assert.deepEqual(results, [
    { accepted: ["a@y.hu"], messageId: "m4", rejected: [] },
    { accepted: [], rejected: ["b@y.hu"] },
  ]);
});
