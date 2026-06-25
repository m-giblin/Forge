-- Extend invites with display_name and job_titles so the admin can set them
-- up-front during the invite flow; they are applied to the user/membership on accept.

alter table invites
  add column if not exists display_name text,
  add column if not exists job_titles   text[] not null default '{}';
