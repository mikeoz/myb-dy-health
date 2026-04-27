-- 1. Create agent_sessions table
create table public.agent_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  agent_id text not null,
  agent_name text not null default 'Unknown Agent',
  session_token text not null unique,
  allowed_ops text[] not null default '{read}',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

alter table public.agent_sessions enable row level security;

create policy "Users can view own agent sessions"
  on public.agent_sessions for select
  using (user_id = auth.uid());

create policy "Users can revoke own agent sessions"
  on public.agent_sessions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index idx_agent_sessions_token on public.agent_sessions(session_token);
create index idx_agent_sessions_user on public.agent_sessions(user_id);

-- 2. Attach handle_new_user trigger (latent bug fix)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. Seed demo agent session for testing
insert into public.agent_sessions (user_id, agent_id, agent_name, session_token, allowed_ops, expires_at)
select id, 'demo-agent-bigcroc', 'BigCROC (Demo)', 'demo-session-token-medgraph-2026', '{read}', '2027-01-01T00:00:00Z'::timestamptz
from auth.users
where email = 'harriethumble@testco.com'
limit 1
on conflict (session_token) do nothing;