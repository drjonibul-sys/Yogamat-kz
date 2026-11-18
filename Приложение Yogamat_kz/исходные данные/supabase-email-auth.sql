-- Вход по e-mail: таблица разрешённых адресов. Выполнить в Supabase → SQL Editor.
-- Клиентская база сюда НЕ попадает: хранятся только адрес, роль и имя.

create table if not exists public.allowed_emails (
  email text primary key check (email = lower(email)),
  role text not null check (role in ('admin','trainer')),
  display_name text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.allowed_emails enable row level security;

-- роль текущего пользователя (по адресу из JWT); security definer, чтобы политики не зацикливались
create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.allowed_emails where email = lower(auth.jwt() ->> 'email') and active
$$;
revoke all on function public.my_role() from public, anon;
grant execute on function public.my_role() to authenticated;

-- читать список могут разрешённые пользователи (нужен для имён тренеров в направлениях) и сам владелец строки
drop policy if exists ae_read on public.allowed_emails;
create policy ae_read on public.allowed_emails for select to authenticated
  using (public.my_role() is not null or email = lower(auth.jwt() ->> 'email'));
-- менять список может только администратор
drop policy if exists ae_admin_write on public.allowed_emails;
create policy ae_admin_write on public.allowed_emails for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- проверка адреса ДО отправки письма: чужим адресам письма не уходят (но наличие адреса в списке можно проверить)
create or replace function public.email_allowed(p_email text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.allowed_emails where email = lower(p_email) and active)
$$;
grant execute on function public.email_allowed(text) to anon, authenticated;

-- ПЕРВЫЙ АДМИНИСТРАТОР: замените адрес на свой и выполните
insert into public.allowed_emails (email, role, display_name)
values (lower('ВАШ_EMAIL@example.com'), 'admin', 'Администратор')
on conflict (email) do nothing;
