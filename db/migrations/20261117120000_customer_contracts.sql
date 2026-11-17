-- Customer contracts: an offer the customer accepts by signing, the billing
-- details they give while signing, and a signal that invoicing can start.
--
-- * envelopes.contract_type: 'partner' (a designer or partner contract, as
--   before) or 'customer' (ügyfélszerződés). Every existing envelope is a
--   partner contract.
-- * envelopes.offer: what the sender entered for a customer contract: offer
--   number, total, deposit, transfer deadline in days, and optional
--   prefill for the project address and phone number.
-- * envelopes.billing: the billing details the first signer gave, with the
--   terms they accepted and when.
-- * envelopes.billing_status: 'pending' once a customer contract is signed
--   by everyone and waits to be invoiced, 'invoiced' once someone marked it.
-- * envelopes.billing_status_changed_at: when the status last changed.

alter table public.envelopes
  add column if not exists contract_type text not null default 'partner',
  add column if not exists offer jsonb,
  add column if not exists billing jsonb,
  add column if not exists billing_status text,
  add column if not exists billing_status_changed_at bigint;

alter table public.envelopes
  drop constraint if exists envelopes_contract_type_check;

alter table public.envelopes
  add constraint envelopes_contract_type_check
    check (contract_type in ('partner', 'customer'));

alter table public.envelopes
  drop constraint if exists envelopes_billing_status_check;

alter table public.envelopes
  add constraint envelopes_billing_status_check
    check (billing_status is null or billing_status in ('pending', 'invoiced'));

create index if not exists idx_envelopes_billing_pending
  on public.envelopes(user_id)
  where billing_status = 'pending';
