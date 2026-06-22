-- Enable Mission Control dashboards globally.
-- The engineering intelligence section now shows real issue-based metrics
-- (lead time, velocity, bug rate, bug cycle time), making this production-ready.
UPDATE feature_flags SET enabled = true WHERE key = 'dashboards';
