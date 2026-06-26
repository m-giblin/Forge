-- Add impact_score and effort_score to ideas for the 2x2 prioritization matrix
-- Values: 1 (lowest) to 5 (highest), nullable (unscored ideas shown separately)
ALTER TABLE ideas
  ADD COLUMN IF NOT EXISTS impact_score SMALLINT CHECK (impact_score BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS effort_score SMALLINT CHECK (effort_score BETWEEN 1 AND 5);
