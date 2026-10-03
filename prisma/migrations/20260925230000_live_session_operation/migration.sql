-- One conversation with Elena, recorded where the other metered AI operations
-- already are. The monthly allowance is then a count of these rows rather than
-- a stored number, so nothing has to reset it.
ALTER TYPE "AiOperation" ADD VALUE 'SPEAKING_LIVE_SESSION';
