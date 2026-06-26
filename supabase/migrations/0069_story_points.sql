-- Story points / estimation field on issues.
-- Null = unestimated; positive integer = story points (Fibonacci recommended: 1,2,3,5,8,13,21).
ALTER TABLE issues ADD COLUMN IF NOT EXISTS story_points integer CHECK (story_points > 0);
