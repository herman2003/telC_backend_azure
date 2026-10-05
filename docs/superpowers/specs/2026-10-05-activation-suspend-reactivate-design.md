# Design: Suspend / Reactivate / Immediate Reset Wipe

**Date:** 2026-10-05  
**Status:** agreed (product) — ready for implementation plan  
**Supersedes (in part):** D18 “deactivate = take seat back”, D39 “7-day hide then erase”

## Problem

Center managers need two different intents that today’s API conflates:

1. **Pause a student** (unpaid fees, sick, temporary block) and later **bring the same student back with their progress**.
2. **Replace the person on a seat** and **destroy that seat’s learning data immediately**.

Today: deactivate is terminal for the code value, there is no reactivate, and reset waits 7 days before hard delete. That cannot support (1), and softens (2).

## Product rules

| Intent | Action | Same student? | Code value | Learning data | Seat still paid / held? |
|--------|--------|---------------|------------|---------------|-------------------------|
| Pause access | **Deactivate** (suspend) | Yes | **Same** | **Kept** | **Yes** — still counts as a held seat |
| Resume access | **Reactivate** | Yes | **Same** | **Still there** | Yes → back to connected |
| Give seat to someone else | **Reset** | No | **New** | **Deleted immediately** | Yes (same paid seat, new occupant) |

There is **no** “reactivate same value after a permanent take-back.” Permanent take-back stays **remove student** / system retire → terminal `DEACTIVATED` without reactivate.

## Status model

Add **`SUSPENDED`** (preferred over overloading `DEACTIVATED`):

```
ACTIVATED  --redeem-->  CONNECTED
CONNECTED  --deactivate-->  SUSPENDED
SUSPENDED  --reactivate-->  CONNECTED
CONNECTED|ACTIVATED|SUSPENDED  --reset-->  ACTIVATED (new code value)
CONNECTED|ACTIVATED  --remove student / shrink / trial retire-->  DEACTIVATED (terminal)
```

### Why `SUSPENDED` ≠ `DEACTIVATED`

Payment mint rule: `holding = count(status NOT DEACTIVATED)`.

- If pause used `DEACTIVATED`, the next payment would **mint a replacement code** while the paused student still “owns” a row → school gets an extra live seat for free, or the pause seat is lost economically.
- `SUSPENDED` **counts as held** (same as `CONNECTED`): pack size stays honest mid-period.
- `DEACTIVATED` stays **terminal**: does not count; reminted on next payment.

## Behaviour detail

### Deactivate (manager, on `CONNECTED` only)

1. Status → `SUSPENDED`.
2. Keep `student_id`, `linked_name`, `linked_email`, `connected_at` (identity of who is parked).
3. Clear `student.center_id` for this center (access ends) — same cut as today.
4. Do **not** touch learning data.
5. Same code string; student must **not** need a new code when resumed.
6. Log event `CONNECTED → SUSPENDED`.
7. Refuse deactivate on `ACTIVATED` for “pause” semantics — unused codes use **reset** (new value) or a separate retire path if needed. *(Optional later: allow deactivate on `ACTIVATED` → `DEACTIVATED` terminal; out of MVP if unused.)*

**MVP:** `POST .../deactivate` only from `CONNECTED` → `SUSPENDED`.  
Already-suspended → idempotent 200.

### Reactivate

1. Only from `SUSPENDED`, owned by center.
2. Require `student_id` still set; student must exist.
3. Refuse if that student already has another live center hold / connected code elsewhere (`STUDENT_ALREADY_ACTIVE` or dedicated conflict).
4. Status → `CONNECTED`; set `student.center_id` back to this center.
5. Do **not** change code value; do **not** clear or restore data (data was never hidden).
6. Log `SUSPENDED → CONNECTED`.
7. Subscription guard: same as reset (`centerMayProvision` / not `BLOCKED`); account finalized.

### Reset (unchanged seat economics, harder wipe)

1. New code value; status → `ACTIVATED`; clear student link fields.
2. Kick connected/suspended student (`center_id` null) if present.
3. **Immediately delete** learning data for that seat window (no 7-day hide, no support restore for this path).
4. Reset allowance (D39 limits) unchanged: free if never connected since last reset; else 2/period (1 trial).
5. May run from `CONNECTED`, `SUSPENDED`, or `ACTIVATED`.

### Access / redeem

- Student with suspended code: learning denied with reason `CODE_SUSPENDED` (or map to existing `CODE_DEACTIVATED` only if FE not ready — prefer new reason).
- Redeem of a suspended code’s value by the parked student: either idempotent “still yours but suspended” or refuse `CODE_SUSPENDED`. Prefer refuse with clear message until reactivated.
- Redeem by anyone else while suspended: `CODE_ALREADY_USED` / conflict — seat reserved.

### Entitlements

- Caps on the code row stay on suspend/reactivate (same `code_id`).
- Spend requires live connected access (existing checks); suspended cannot spend.

## Frontend contract (summary)

| Status | Primary actions |
|--------|-----------------|
| `activated` | Copy code; Reset (fresh value); no Reactivate |
| `connected` | **Deactivate** (pause); **Reset** (replace + wipe now) |
| `suspended` | **Reactivate**; **Reset** (replace + wipe now) |
| `deactivated` | No reactivate; wait for payment remint or Reset only if product still allows recovery |

Copy:

- Deactivate: “Pause this student’s access. Their progress is kept. You can reactivate later.”
- Reactivate: “Restore access for {name} with their existing progress.”
- Reset: “Issue a new code. The current student’s progress on this seat is permanently deleted now.”

## Out of scope

- Changing pack pricing, pro rata, or reset limits.
- Support restore UI for resets (removed for the reset path).
- Migrating historical `DEACTIVATED` rows that still have `student_id` (treat as terminal unless a one-off script is requested).
