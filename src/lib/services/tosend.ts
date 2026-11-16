// toSend (https://tosend.com) as the email provider, used in place of Resend
// when TOSEND_API_KEY is set (or EMAIL_DRIVER=tosend).
//
// API reference: https://tosend.com/docs/api/introduction/
//
// - Single sends (POST /v2/emails) are not deduplicated by toSend. A message
//   that carries an idempotency key therefore goes through the batch
//   endpoint as a batch of one, which honours the Idempotency-Key header.
// - The sending domain is verified in the toSend dashboard, not from here.

export const TOSEND_API_URL = "https://api.tosend.com";
export const TOSEND_DASHBOARD_URL = "https://dash.tosend.com/app";

/** toSend accepts up to 10 MB of attachments per email, decoded. */
export const TOSEND_MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const RATE_LIMIT_RETRIES = 3;
const DEFAULT_RATE_LIMIT_WAIT_MS = 5_000;
const MAX_RATE_LIMIT_WAIT_MS = 10_000;

export type ToSendAddress = { email: string; name?: string };

export type ToSendAttachment = {
  content: string;
  name: string;
  type: string;
};

export type ToSendEmail = {
  attachments?: ToSendAttachment[];
  from: ToSendAddress;
  headers?: Record<string, string>;
  html?: string;
  reply_to?: string;
  subject: string;
  text?: string;
  to: ToSendAddress[];
};

type ToSendBatchItem =
  | { message_id: string; status: "success" }
  | {
      errors?: Record<string, string>;
      message?: string;
      status: "error" | "spam";
      status_code?: number;
    };

export type ToSendBatchResult =
  | { error?: undefined; messageId: string }
  | { error: string; messageId?: undefined };

export class ToSendError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "ToSendError";
    this.statusCode = statusCode;
  }
}

/** "Acme <sign@acme.com>" becomes { name: "Acme", email: "sign@acme.com" }. */
export function parseAddress(value: string): ToSendAddress {
  const match = /^\s*"?([^"<]*?)"?\s*<([^<>]+)>\s*$/.exec(value);

  if (!match) {
    return { email: value.trim() };
  }

  const name = match[1]?.trim();

  return name ? { email: match[2]!.trim(), name } : { email: match[2]!.trim() };
}

function describeError(statusCode: number, body: unknown): string {
  if (body && typeof body === "object") {
    const { errors, message } = body as {
      errors?: Record<string, string>;
      message?: unknown;
    };
    const details = errors ? Object.values(errors).join(" ") : "";
    const text = typeof message === "string" ? message : "";

    if (text || details) {
      return `toSend ${String(statusCode)}: ${[text, details].filter(Boolean).join(" – ")}`;
    }
  }

  return `toSend ${String(statusCode)}: email delivery failed.`;
}

function retryWaitMs(response: Response): number {
  const seconds = Number(response.headers.get("retry-after"));

  return Number.isFinite(seconds) && seconds > 0
    ? Math.min(seconds * 1000, MAX_RATE_LIMIT_WAIT_MS)
    : DEFAULT_RATE_LIMIT_WAIT_MS;
}

export type ToSendClientOptions = {
  apiKey: string;
  apiUrl?: string;
  fetch?: typeof fetch;
  wait?: (milliseconds: number) => Promise<void>;
};

export function createToSendClient({
  apiKey,
  apiUrl = TOSEND_API_URL,
  fetch: fetchImpl = fetch,
  wait = (milliseconds) =>
    new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    }),
}: ToSendClientOptions) {
  async function post(
    path: string,
    body: unknown,
    idempotencyKey?: string,
  ): Promise<{ body: unknown; status: number }> {
    for (let attempt = 0; ; attempt += 1) {
      const response = await fetchImpl(`${apiUrl}${path}`, {
        body: JSON.stringify(body),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        },
        method: "POST",
      });

      // 429 is a rate limit and nothing was accepted; 409 on the batch
      // endpoint means the idempotency key could not be read back and
      // nothing was sent. Both are safe to try again.
      if (
        (response.status === 429 || response.status === 409) &&
        attempt < RATE_LIMIT_RETRIES
      ) {
        await wait(retryWaitMs(response));
        continue;
      }

      const text = await response.text();
      let parsed: unknown = null;

      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = text;
      }

      return { body: parsed, status: response.status };
    }
  }

  /**
   * One result per email, in order. A 207 means some emails were refused
   * (validation or spam filtering) while the rest were queued; those are
   * reported per item rather than failing the whole batch, so the queued
   * ones are not sent twice by a retry.
   */
  async function sendBatch(
    emails: readonly ToSendEmail[],
    idempotencyKey?: string,
  ): Promise<ToSendBatchResult[]> {
    const { body, status } = await post(
      "/v2/emails/batch",
      { emails },
      idempotencyKey,
    );

    if (status !== 200 && status !== 207) {
      throw new ToSendError(status, describeError(status, body));
    }

    const results = (body as { results?: ToSendBatchItem[] } | null)?.results;

    if (!Array.isArray(results) || results.length !== emails.length) {
      throw new ToSendError(status, "toSend returned an unexpected response.");
    }

    return results.map((item) =>
      item.status === "success"
        ? { messageId: item.message_id }
        : { error: describeError(item.status_code ?? status, item) },
    );
  }

  return {
    async send(email: ToSendEmail, idempotencyKey?: string): Promise<string> {
      if (idempotencyKey) {
        const [result] = await sendBatch([email], idempotencyKey);

        if (!result || result.error !== undefined) {
          throw new ToSendError(422, result?.error ?? "Email was refused.");
        }

        return result.messageId;
      }

      const { body, status } = await post("/v2/emails", email);

      if (status !== 200) {
        throw new ToSendError(status, describeError(status, body));
      }

      return (body as { message_id?: string } | null)?.message_id ?? "";
    },
    sendBatch,
  };
}

export type ToSendClient = ReturnType<typeof createToSendClient>;
