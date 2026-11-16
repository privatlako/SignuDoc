"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";

import { FieldShell, ShellButton } from "@/components/shared/form-shell";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { contactFormSchema } from "@/lib/schemas/contact";

type ContactFormValues = {
  company: string;
  email: string;
  message: string;
  name: string;
};

type ContactFormErrors = Partial<
  Record<Exclude<keyof ContactFormValues, "company">, string>
>;

type ContactApiPayload = {
  error?: string;
  fieldErrors?: Partial<Record<string, string>>;
} | null;

const defaultValues: ContactFormValues = {
  company: "",
  email: "",
  message: "",
  name: "",
};

function readApiErrorMessage(payload: ContactApiPayload): string {
  if (typeof payload?.error === "string" && payload.error.trim()) {
    return payload.error;
  }

  return "Valami hiba történt. Próbáld újra.";
}

export function ContactForm() {
  const [values, setValues] = useState<ContactFormValues>(defaultValues);
  const [errors, setErrors] = useState<ContactFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function handleChange(field: keyof ContactFormValues) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const nextValue = event.target.value;

      setValues((currentValues) => ({
        ...currentValues,
        [field]: nextValue,
      }));

      if (field !== "company") {
        setErrors((currentErrors) => ({
          ...currentErrors,
          [field]: undefined,
        }));
      }

      setSubmitError(null);
      setSuccessMessage(null);
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const submittedValues = {
      company: String(formData.get("company") ?? values.company),
      email: String(formData.get("contact-email") ?? values.email),
      message: String(formData.get("contact-message") ?? values.message),
      name: String(formData.get("contact-name") ?? values.name),
    };
    const validationResult = contactFormSchema.safeParse(submittedValues);

    if (!validationResult.success) {
      const nextErrors: ContactFormErrors = {};

      for (const issue of validationResult.error.issues) {
        const field = issue.path[0];

        if (field === "name") {
          nextErrors.name = "Add meg a neved";
        }

        if (field === "email") {
          nextErrors.email = "Adj meg egy érvényes e-mail-címet";
        }

        if (field === "message") {
          nextErrors.message =
            issue.code === "too_big"
              ? "Az üzenet legfeljebb 5000 karakter lehet"
              : "Írd be az üzenetet";
        }
      }

      setValues(submittedValues);
      setErrors(nextErrors);
      setSubmitError(null);
      setSuccessMessage(null);
      return;
    }

    setValues(validationResult.data);
    setErrors({});
    setSubmitError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/contact", {
        body: JSON.stringify(validationResult.data),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response
        .json()
        .catch(() => null)) as ContactApiPayload;

      if (!response.ok) {
        setErrors({
          email:
            typeof payload?.fieldErrors?.email === "string"
              ? payload.fieldErrors.email
              : undefined,
          message:
            typeof payload?.fieldErrors?.message === "string"
              ? payload.fieldErrors.message
              : undefined,
          name:
            typeof payload?.fieldErrors?.name === "string"
              ? payload.fieldErrors.name
              : undefined,
        });
        setSubmitError(readApiErrorMessage(payload));
        return;
      }

      setValues(defaultValues);
      setErrors({});
      setSuccessMessage(
        `Elküldtük az üzenetedet. Ha további részletekre van szükségünk, a(z) ${validationResult.data.email} címen keresünk.`,
      );
    } catch {
      setSubmitError("Valami hiba történt. Próbáld újra.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="well p-5 sm:p-7">
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-[10000px] top-auto h-px w-px overflow-hidden"
        >
          <label htmlFor="company">Cég</label>
          <input
            autoComplete="off"
            id="company"
            name="company"
            onChange={handleChange("company")}
            tabIndex={-1}
            value={values.company}
          />
        </div>

        {successMessage ? (
          <div className="notice notice-success">{successMessage}</div>
        ) : null}

        {submitError ? (
          <div className="notice notice-danger">{submitError}</div>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2">
          <FieldShell
            autoComplete="name"
            disabled={isSubmitting}
            error={errors.name}
            label="Név"
            name="contact-name"
            onChange={handleChange("name")}
            placeholder="A neved"
            readOnly={false}
            value={values.name}
          />
          <FieldShell
            autoComplete="email"
            disabled={isSubmitting}
            error={errors.email}
            label="E-mail-cím"
            name="contact-email"
            onChange={handleChange("email")}
            placeholder="te@pelda.hu"
            readOnly={false}
            type="email"
            value={values.email}
          />
        </div>

        <Field className="gap-2 text-sm">
          <FieldLabel
            className="text-[0.8125rem] font-semibold text-(--secondary)"
            htmlFor="contact-message"
          >
            Üzenet
          </FieldLabel>
          <Textarea
            aria-describedby="contact-message-description"
            aria-invalid={errors.message ? true : undefined}
            className={errors.message ? "border-(--danger)" : ""}
            disabled={isSubmitting}
            id="contact-message"
            name="contact-message"
            onChange={handleChange("message")}
            placeholder="Írd le, miben segíthetünk. Add meg a fiókhoz tartozó e-mail-címet, a küldő nevét, a dokumentum címét vagy linkjét, ha ezek segítenek beazonosítani a kérést."
            value={values.message}
          />
          {errors.message ? (
            <FieldError
              className="text-xs font-semibold text-(--danger)"
              id="contact-message-description"
            >
              {errors.message}
            </FieldError>
          ) : null}
        </Field>

        <div className="flex pt-1 sm:justify-end">
          <ShellButton loading={isSubmitting} type="submit">
            {isSubmitting ? "Küldés…" : "Üzenet küldése"}
          </ShellButton>
        </div>
      </form>
    </section>
  );
}
