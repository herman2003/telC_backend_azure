-- ADR 0003: AI Speaking cap becomes assigned remaining, pool becomes unallocated.
--
-- DEPLOY: apply this migration BEFORE releasing the new app binary. The new
-- spend path treats `cap` as remaining (`cap -= 1`); running new code on old
-- ceiling rows would burn the ceiling instead of remaining.
--
-- 1) Convert ceiling/used into remaining on the seat.
-- 2) Reserve that remaining out of the center pool (unallocated = pool − Σ remaining).
--    If caps oversubscribed the pool, pool floors at 0 (logged below).

UPDATE code_entitlement_caps
SET
  cap = GREATEST(0, cap - used),
  updated_at = NOW()
WHERE product = 'AI_SPEAKING_CREDIT';

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT
      p.center_id,
      p.balance AS pool_before,
      COALESCE(s.assigned, 0) AS assigned_remaining
    FROM center_entitlement_pools p
    LEFT JOIN LATERAL (
      SELECT SUM(c.cap)::int AS assigned
      FROM code_entitlement_caps c
      INNER JOIN activation_codes a ON a.id = c.code_id
      WHERE a.center_id = p.center_id
        AND c.product = 'AI_SPEAKING_CREDIT'
    ) s ON TRUE
    WHERE p.product = 'AI_SPEAKING_CREDIT'
      AND COALESCE(s.assigned, 0) > p.balance
  LOOP
    RAISE NOTICE
      'AI_SPEAKING oversubscribed center_id=% pool=% assigned_remaining=% — pool will floor at 0',
      r.center_id, r.pool_before, r.assigned_remaining;
  END LOOP;
END $$;

UPDATE center_entitlement_pools AS p
SET
  balance = GREATEST(
    0,
    p.balance - COALESCE((
      SELECT SUM(c.cap)::int
      FROM code_entitlement_caps c
      INNER JOIN activation_codes a ON a.id = c.code_id
      WHERE a.center_id = p.center_id
        AND c.product = 'AI_SPEAKING_CREDIT'
    ), 0)
  ),
  updated_at = NOW()
WHERE p.product = 'AI_SPEAKING_CREDIT';
