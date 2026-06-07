-- ============================================================
-- ORIGINS — Auto-generated shipment reference (YY-NNNN per buyer)
-- 1. next_shipment_reference(buyer, at): computes the next reference
-- 2. before-insert trigger fills reference if blank
-- 3. backfill: assign references to existing rows that lack one
-- ============================================================

begin;

create or replace function public.next_shipment_reference(p_buyer_id uuid, p_at timestamptz)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  next_seq int;
  yr_short text;
begin
  yr_short := to_char(p_at, 'YY');
  -- Pull the highest YY-NNNN sequence the buyer already has for this year
  select coalesce(max(
    case when reference ~ ('^' || yr_short || '-[0-9]+$')
      then substring(reference from length(yr_short) + 2)::int
      else 0
    end
  ), 0) + 1
    into next_seq
    from shipments
   where buyer_company_id = p_buyer_id;
  return yr_short || '-' || lpad(next_seq::text, 4, '0');
end $$;

create or replace function public.on_shipment_insert_set_reference()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (new.reference is null or new.reference = '') and new.buyer_company_id is not null then
    new.reference := public.next_shipment_reference(new.buyer_company_id, coalesce(new.created_at, now()));
  end if;
  return new;
end $$;

drop trigger if exists shipment_set_reference on shipments;
create trigger shipment_set_reference
before insert on shipments
for each row
execute function public.on_shipment_insert_set_reference();

-- Backfill existing shipments that lack a reference
with numbered as (
  select id, buyer_company_id,
         to_char(coalesce(created_at, now()), 'YY') as yr,
         row_number() over (partition by buyer_company_id, to_char(coalesce(created_at, now()), 'YY') order by created_at, id) as seq
    from shipments
   where (reference is null or reference = '') and buyer_company_id is not null
)
update shipments s
   set reference = n.yr || '-' || lpad(n.seq::text, 4, '0')
  from numbered n
 where n.id = s.id;

commit;
