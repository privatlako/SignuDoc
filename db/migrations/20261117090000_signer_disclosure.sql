-- The words signers agree to before signing, as an administrator wrote them.
--
-- * app_settings.signer_disclosure_text: the disclosure shown in the
--   "Mielőtt aláírod" dialog, as plain text (blank lines between paragraphs,
--   "## " before a heading, {sender} and {contact} filled in per envelope).
-- * app_settings.signer_consent_statement: the text of the checkbox.
--
-- Null means the built-in words. Each signer's agreement records a version
-- that names the exact words shown, so changing these later does not change
-- what an earlier record says.

alter table public.app_settings
  add column if not exists signer_disclosure_text text,
  add column if not exists signer_consent_statement text;

alter table public.app_settings
  drop constraint if exists app_settings_signer_disclosure_check;

alter table public.app_settings
  add constraint app_settings_signer_disclosure_check
    check (
      (signer_disclosure_text is null or char_length(signer_disclosure_text) <= 8000)
      and (signer_consent_statement is null or char_length(signer_consent_statement) <= 600)
    );
