-- P6: host UI language (en / ar). Run after schema-p5-classroom.sql.

alter table public.hosts
  add column if not exists ui_locale text not null default 'en';

alter table public.hosts
  drop constraint if exists hosts_ui_locale_check;
alter table public.hosts
  add constraint hosts_ui_locale_check check (ui_locale in ('en', 'ar'));
