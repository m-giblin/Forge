import { z } from "zod";

// API request schemas. Pure (no server-only) so they're unit-testable and
// reusable between the route handler and tests.

export const createIssueSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(20_000).optional(),
  // status/priority/type are per-tenant configurable; validated against the
  // tenant's options in the route (unknown value → 422), not a fixed enum.
  status: z.string().min(1).max(40).optional(),
  priority: z.string().min(1).max(40).optional(),
  type: z.string().min(1).max(40).optional(),
  projectKey: z.string().max(20).optional(),
  environment: z.string().max(200).optional(),
  appVersion: z.string().max(100).optional(),
  stackTrace: z.string().max(50_000).optional(),
  labels: z.array(z.string().max(50)).max(20).optional(),
});

export type CreateIssueBody = z.infer<typeof createIssueSchema>;

// PATCH: all fields optional, but at least one must be present. status/priority/
// type are validated as plain strings here (per-tenant config validation is
// layered on in the service in a later step); empty body is rejected.
export const updateIssueSchema = z
  .object({
    title: z.string().min(1).max(500).optional(),
    description: z.string().max(20_000).nullable().optional(),
    status: z.string().min(1).max(40).optional(),
    priority: z.string().min(1).max(40).optional(),
    type: z.string().min(1).max(40).optional(),
    assignee_id: z.string().uuid().nullable().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "Provide at least one field to update." });

export type UpdateIssueBody = z.infer<typeof updateIssueSchema>;
