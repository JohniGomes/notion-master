-- Migração inicial: profiles, clients, tasks, comments, attachments
-- Rode este arquivo inteiro no SQL Editor do Supabase (Project > SQL Editor > New query > Run)

create extension if not exists "pgcrypto";

-- profiles: 1 linha por usuário autenticado (populada via trigger on auth.users insert)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  created_at timestamptz default now()
);

-- clients: equivalente à "página de cliente" com capa
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cover_url text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- tasks: etapas E subtarefas na mesma tabela (self-reference via parent_id)
do $$ begin
  create type task_status as enum ('not_started', 'in_progress', 'done');
exception
  when duplicate_object then null;
end $$;

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  parent_id uuid references tasks(id) on delete cascade,
  title text not null,
  service text,
  os_number int,
  status task_status not null default 'not_started',
  assignee_id uuid references profiles(id),
  due_date date,
  observation text,
  position int not null default 0,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  author_id uuid references profiles(id),
  body text not null,
  created_at timestamptz default now()
);

create table if not exists attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  uploaded_by uuid references profiles(id),
  created_at timestamptz default now()
);

create index if not exists tasks_client_id_idx on tasks (client_id);
create index if not exists tasks_parent_id_idx on tasks (parent_id);
create index if not exists tasks_status_idx on tasks (status);
create index if not exists comments_task_id_idx on comments (task_id);
create index if not exists attachments_task_id_idx on attachments (task_id);

-- trigger: cria profile automaticamente no signup/aceite de convite
create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- updated_at automático
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at on clients;
create trigger set_updated_at before update on clients
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at on tasks;
create trigger set_updated_at before update on tasks
  for each row execute procedure public.set_updated_at();

-- RLS: time interno pequeno -> qualquer usuário autenticado (com profile) tem acesso total
alter table clients enable row level security;
alter table tasks enable row level security;
alter table comments enable row level security;
alter table attachments enable row level security;
alter table profiles enable row level security;

drop policy if exists "authenticated full access" on clients;
create policy "authenticated full access" on clients for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "authenticated full access" on tasks;
create policy "authenticated full access" on tasks for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "authenticated full access" on comments;
create policy "authenticated full access" on comments for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "authenticated full access" on attachments;
create policy "authenticated full access" on attachments for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "read all profiles" on profiles;
create policy "read all profiles" on profiles for select
  using (auth.uid() is not null);

drop policy if exists "update own profile" on profiles;
create policy "update own profile" on profiles for update
  using (auth.uid() = id);

-- Storage buckets (capas de cliente e anexos de tarefa)
insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

drop policy if exists "authenticated read covers" on storage.objects;
create policy "authenticated read covers" on storage.objects for select
  using (bucket_id = 'covers');

drop policy if exists "authenticated write covers" on storage.objects;
create policy "authenticated write covers" on storage.objects for insert
  with check (bucket_id = 'covers' and auth.uid() is not null);

drop policy if exists "authenticated update covers" on storage.objects;
create policy "authenticated update covers" on storage.objects for update
  using (bucket_id = 'covers' and auth.uid() is not null);

drop policy if exists "authenticated read attachments" on storage.objects;
create policy "authenticated read attachments" on storage.objects for select
  using (bucket_id = 'attachments' and auth.uid() is not null);

drop policy if exists "authenticated write attachments" on storage.objects;
create policy "authenticated write attachments" on storage.objects for insert
  with check (bucket_id = 'attachments' and auth.uid() is not null);
