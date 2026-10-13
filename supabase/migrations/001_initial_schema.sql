create extension if not exists pgcrypto;
create extension if not exists vector;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade, email text not null,
  full_name text, avatar_url text, plan text not null default 'student',
  credits_used integer not null default 0, credits_limit integer not null default 100000,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.notebooks (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, description text, icon text default 'book-open', is_public boolean not null default false,
  theme text default 'Navy', metadata jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(), notebook_id uuid not null references public.notebooks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, type text not null check(type in ('pdf','docx','txt','url','youtube','text')),
  title text not null, content text, file_path text, file_size bigint, url text, word_count integer default 0, token_count integer default 0,
  status text not null default 'processing' check(status in ('processing','ready','error')), error_message text, metadata jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.chunks (id uuid primary key default gen_random_uuid(), source_id uuid not null references public.sources(id) on delete cascade, notebook_id uuid not null references public.notebooks(id) on delete cascade, content text not null, embedding vector(1536), chunk_index integer not null, metadata jsonb not null default '{}', created_at timestamptz not null default now());
create table if not exists public.chats (id uuid primary key default gen_random_uuid(), notebook_id uuid not null references public.notebooks(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, title text not null default 'Research chat', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.messages (id uuid primary key default gen_random_uuid(), chat_id uuid not null references public.chats(id) on delete cascade, notebook_id uuid not null references public.notebooks(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, role text not null check(role in ('user','assistant','system')), content text not null, citations jsonb not null default '[]', model_used text, tokens_used integer default 0, cost_usd numeric default 0, metadata jsonb not null default '{}', created_at timestamptz not null default now());
create table if not exists public.study_materials (id uuid primary key default gen_random_uuid(), notebook_id uuid not null references public.notebooks(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, type text not null, title text not null, content jsonb not null, model_used text, tokens_used integer default 0, cost_usd numeric default 0, metadata jsonb not null default '{}', created_at timestamptz not null default now());
create table if not exists public.audio_overviews (id uuid primary key default gen_random_uuid(), notebook_id uuid not null references public.notebooks(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, type text not null default 'deep_dive', title text not null, script text, audio_url text, duration_secs integer, status text not null default 'ready', error_message text, metadata jsonb not null default '{}', created_at timestamptz not null default now());
create table if not exists public.notes (id uuid primary key default gen_random_uuid(), notebook_id uuid not null references public.notebooks(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, title text not null, content text not null, tags text[] not null default '{}', is_pinned boolean not null default false, metadata jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index if not exists notebooks_user_idx on public.notebooks(user_id); create index if not exists sources_notebook_idx on public.sources(notebook_id,status); create index if not exists messages_notebook_idx on public.messages(notebook_id,created_at);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$ begin insert into public.profiles(id,email,full_name,avatar_url) values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name', ''),new.raw_user_meta_data->>'avatar_url') on conflict(id) do update set email=excluded.email; return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security; alter table public.notebooks enable row level security; alter table public.sources enable row level security; alter table public.chunks enable row level security; alter table public.chats enable row level security; alter table public.messages enable row level security; alter table public.study_materials enable row level security; alter table public.audio_overviews enable row level security; alter table public.notes enable row level security;
create policy "own profiles" on public.profiles for all using(auth.uid()=id) with check(auth.uid()=id);
create policy "own notebooks" on public.notebooks for all using(auth.uid()=user_id or is_public) with check(auth.uid()=user_id);
create policy "own sources" on public.sources for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy "own chunks" on public.chunks for all using(auth.uid()= (select user_id from public.sources where id=source_id)) with check(auth.uid()= (select user_id from public.sources where id=source_id));
create policy "own chats" on public.chats for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy "own messages" on public.messages for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy "own materials" on public.study_materials for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy "own audio" on public.audio_overviews for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy "own notes" on public.notes for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
