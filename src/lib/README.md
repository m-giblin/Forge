# Layered architecture (`src/lib`)

Clean separation so the web UI and the v1 API share one set of business rules,
and so the data tier can move off Supabase later by touching only one layer.

```
Route / Controller  (src/app/api/...)   HTTP only: auth, Zod validation, error shaping
        │
Service layer       (src/lib/services)  Business rules, authz decisions, AI hooks
        │
Repository layer    (src/lib/repositories)  ALL Supabase access; tenant scoping
        │
Provider adapters   (src/lib/providers)  Grok (AI), storage, rate limiter — swappable
```

## Data access: the two paths (see Architecture §5)

- **Human path** — `supabase/server.ts` / `supabase/client.ts`. Carries the user
  JWT; **RLS enforces tenant isolation natively**.
- **Machine path** — `supabase/service.ts`. Service-role client **bypasses RLS**;
  the repository layer **must inject `tenant_id`** on every query. This is the
  only place isolation lives in code, not the database.

Rule: nothing outside `repositories/` talks to Supabase directly.
