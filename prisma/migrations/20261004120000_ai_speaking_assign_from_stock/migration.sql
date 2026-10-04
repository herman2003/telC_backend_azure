-- ADR 0003: AI Speaking cap becomes assigned remaining, pool becomes unallocated.
--
-- 1) Convert ceiling/used into remaining on the seat.
-- 2) Reserve that remaining out of the center pool (unallocated = pool − Σ remaining).
--    If caps oversubscribed the pool, pool floors at 0 (audit separately).

UPDATE code_entitlement_caps
SET
  cap = GREATEST(0, cap - used),
  updated_at = NOW()
WHERE product = 'AI_SPEAKING_CREDIT';

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
