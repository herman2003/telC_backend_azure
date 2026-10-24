/**
 * Pilote Exam Day — the free-trial gift pack.
 *
 * Product constants, not defaults. Changing them changes what every new trial
 * receives; keep D3 (`docs/contracts/center-dashboard-sync.md`) in sync.
 */

/** Clock length. Already enforced by `CenterTrialService`. */
export const TRIAL_DURATION_DAYS = 14;

/** Seats / activation codes minted when the manager starts the trial. */
export const TRIAL_PACKAGE_SEATS = 3;

/** Manual Exam Day slots: two sittings × three candidates. */
export const TRIAL_EXAM_SLOTS = 6;

/** Mit Elena credits into the centre pool (centre assigns). */
export const TRIAL_ELENA_CREDITS = 9;

/** Corrections Schreiben IA credits into the centre pool. */
export const TRIAL_SCHREIBEN_CREDITS = 6;
