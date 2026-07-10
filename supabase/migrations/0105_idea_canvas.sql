-- Migration 0105: Idea Canvas — freeform pre-conversion brainstorm board.
-- Unlike the Mind Map (strict Idea -> Project -> Epic -> Sprint -> Issue,
-- data-backed), this is unstructured: loose Problem/Feature/Risk/Question/AI
-- cards with free x/y positions and optional connections, living entirely
-- inside one idea until it's ready to convert.

create table if not exists public.idea_canvas_nodes (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  idea_id     uuid not null references public.ideas(id) on delete cascade,
  kind        text not null check (kind in ('problem', 'feature', 'risk', 'question', 'ai')),
  text        text not null default '',
  pos_x       double precision not null default 0,
  pos_y       double precision not null default 0,
  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_idea_canvas_nodes_idea on public.idea_canvas_nodes (idea_id);
create index if not exists idx_idea_canvas_nodes_tenant on public.idea_canvas_nodes (tenant_id);

alter table public.idea_canvas_nodes enable row level security;

drop policy if exists idea_canvas_nodes_select on public.idea_canvas_nodes;
create policy idea_canvas_nodes_select on public.idea_canvas_nodes
  for select using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = idea_canvas_nodes.tenant_id and m.user_id = public.current_app_user_id()
    )
  );

-- Writes go through the service-role client only (matches epics/sprints convention).

create trigger trg_idea_canvas_nodes_updated before update on public.idea_canvas_nodes
  for each row execute function public.set_updated_at();

create table if not exists public.idea_canvas_edges (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  idea_id     uuid not null references public.ideas(id) on delete cascade,
  from_node   uuid not null references public.idea_canvas_nodes(id) on delete cascade,
  to_node     uuid not null references public.idea_canvas_nodes(id) on delete cascade,
  is_ai       boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (from_node, to_node)
);

create index if not exists idx_idea_canvas_edges_idea on public.idea_canvas_edges (idea_id);

alter table public.idea_canvas_edges enable row level security;

drop policy if exists idea_canvas_edges_select on public.idea_canvas_edges;
create policy idea_canvas_edges_select on public.idea_canvas_edges
  for select using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = idea_canvas_edges.tenant_id and m.user_id = public.current_app_user_id()
    )
  );

insert into public.schema_migrations (filename) values ('0105_idea_canvas.sql') on conflict do nothing;
