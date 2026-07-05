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
  assignee_id: z.string().uuid().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  sprint_id: z.string().uuid().nullable().optional(),
  parent_id: z.string().uuid().nullable().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "due_date must be YYYY-MM-DD").nullable().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "start_date must be YYYY-MM-DD").nullable().optional(),
  story_points: z.number().int().min(0).max(999).nullable().optional(),
  // SDK dedup: stable hash of error type+message+first stack frame.
  // If an open issue with the same fingerprint exists, occurrence_count is
  // incremented and the existing issue is returned (HTTP 200, not 201).
  fingerprint: z.string().max(256).optional(),
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
    labels: z.array(z.string().max(50)).max(20).optional(),
    category_id: z.string().uuid().nullable().optional(),
    sprint_id: z.string().uuid().nullable().optional(),
    parent_id: z.string().uuid().nullable().optional(),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "due_date must be YYYY-MM-DD").nullable().optional(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "start_date must be YYYY-MM-DD").nullable().optional(),
    story_points: z.number().int().min(0).max(999).nullable().optional(),
    environment: z.string().max(200).nullable().optional(),
    app_version: z.string().max(100).nullable().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "Provide at least one field to update." });

export type UpdateIssueBody = z.infer<typeof updateIssueSchema>;
