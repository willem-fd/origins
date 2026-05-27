-- ============================================================
-- ORIGINS — Wave 1 Foundation migration
-- Clean slate (Option B): wipe test data, retire dead tables,
-- fold growers + logistics into companies, add a real users table.
-- No RLS yet — that's the next, separate step.
-- ============================================================

begin;

-- STEP 1 — Wipe throwaway test data (children first, then parents)
delete from purchase_orders;
delete from grower_products;
delete from shipment_documents;
delete from claims;
delete from template_items;
delete from shipment_templates;
delete from shipments;
delete from company_addresses;
delete from company_bank_accounts;
delete from company_contacts;
delete from companies;

-- STEP 2 — Retire genuinely dead tables (confirmed empty / unused)
drop table if exists company_handshakes;
drop table if exists logistics_rates;
drop table if exists profiles;
drop table if exists farms;

-- STEP 3 — Fold growers + logistics into companies.
-- Re-point the foreign keys from the old tables to companies.id.
-- (Tables are empty now, so these just change what the column points at.)

-- 3a. purchase_orders.farm_id -> rename to grower_company_id, point at companies
alter table purchase_orders drop constraint if exists purchase_orders_farm_id_fkey;
alter table purchase_orders rename column farm_id to grower_company_id;
alter table purchase_orders
  add constraint purchase_orders_grower_company_id_fkey
  foreign key (grower_company_id) references companies(id) on delete set null;

-- 3b. template_items.farm_id -> rename to grower_company_id, point at companies
alter table template_items drop constraint if exists template_items_farm_id_fkey;
alter table template_items rename column farm_id to grower_company_id;
alter table template_items
  add constraint template_items_grower_company_id_fkey
  foreign key (grower_company_id) references companies(id) on delete set null;

-- 3c. grower_products.grower_id -> rename to company_id, point at companies
alter table grower_products drop constraint if exists grower_products_grower_id_fkey;
alter table grower_products rename column grower_id to company_id;
alter table grower_products
  add constraint grower_products_company_id_fkey
  foreign key (company_id) references companies(id) on delete cascade;

-- 3d. shipment_documents.farm_id -> rename to grower_company_id, point at companies
alter table shipment_documents drop constraint if exists shipment_documents_farm_id_fkey;
alter table shipment_documents rename column farm_id to grower_company_id;
alter table shipment_documents
  add constraint shipment_documents_grower_company_id_fkey
  foreign key (grower_company_id) references companies(id) on delete set null;

-- 3e. claims.farm_id -> rename to grower_company_id, point at companies
alter table claims drop constraint if exists claims_farm_id_fkey;
alter table claims rename column farm_id to grower_company_id;
alter table claims
  add constraint claims_grower_company_id_fkey
  foreign key (grower_company_id) references companies(id) on delete set null;

-- 3f. shipments logistics references already point at logistics_partners.
--     Re-point each to companies (type=logistics). Columns: cargo_agent_id,
--     airline_id, customs_agent_id, trucking_id, handling_id.
alter table shipments drop constraint if exists shipments_cargo_agent_id_fkey;
alter table shipments drop constraint if exists shipments_airline_id_fkey;
alter table shipments drop constraint if exists shipments_customs_agent_id_fkey;
alter table shipments drop constraint if exists shipments_trucking_id_fkey;
alter table shipments drop constraint if exists shipments_handling_id_fkey;
alter table shipments
  add constraint shipments_cargo_agent_id_fkey   foreign key (cargo_agent_id)   references companies(id) on delete set null,
  add constraint shipments_airline_id_fkey       foreign key (airline_id)       references companies(id) on delete set null,
  add constraint shipments_customs_agent_id_fkey foreign key (customs_agent_id) references companies(id) on delete set null,
  add constraint shipments_trucking_id_fkey      foreign key (trucking_id)      references companies(id) on delete set null,
  add constraint shipments_handling_id_fkey      foreign key (handling_id)      references companies(id) on delete set null;

-- 3g. Now drop the old separate tables (empty, references re-pointed)
drop table if exists growers;
drop table if exists logistics_partners;

-- STEP 4 — Build the users table (the Wave 1 core).
-- Links a Supabase auth login to a company, with a role.
create table users (
  id          uuid primary key references auth.users(id) on delete cascade,
  company_id  uuid not null references companies(id) on delete cascade,
  role        text not null default 'regular' check (role in ('admin','regular')),
  full_name   text,
  email       text,
  phone       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index users_company_id_idx on users(company_id);

-- A user's "super admin" power is platform-level, not a company role.
-- Marked here so the app can grant view-as / see-all to specific logins.
alter table users add column is_super_admin boolean not null default false;

commit;
