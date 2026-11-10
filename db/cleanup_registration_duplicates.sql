-- Lim inn i Supabase → SQL Editor → Run
-- 1) Unik PIN per event
-- 2) Marker åpenbare navne-duplikater som cancelled (beholder beste rad)

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_registrations_pin_unique
  ON event_registrations(event_id, participant_pin)
  WHERE participant_pin IS NOT NULL;

-- For hvert event + normalisert navn: behold 1 rad
-- Preferanse: accepted+pin > accepted > waitlist > invited > declined
WITH ranked AS (
  SELECT
    id,
    event_id,
    lower(trim(name)) AS name_key,
    status,
    participant_pin,
    ROW_NUMBER() OVER (
      PARTITION BY event_id, lower(trim(name))
      ORDER BY
        CASE status
          WHEN 'accepted' THEN 5
          WHEN 'waitlist' THEN 4
          WHEN 'invited' THEN 3
          WHEN 'declined' THEN 2
          ELSE 1
        END DESC,
        CASE WHEN participant_pin IS NOT NULL THEN 1 ELSE 0 END DESC,
        created_at ASC
    ) AS rn
  FROM event_registrations
  WHERE status <> 'cancelled'
    AND nullif(trim(name), '') IS NOT NULL
    AND lower(trim(name)) <> 'anonym'
)
UPDATE event_registrations er
SET status = 'cancelled'
FROM ranked r
WHERE er.id = r.id
  AND r.rn > 1;

-- Flytt PIN fra cancelled-duplikat til beholdt rad hvis den mangler PIN
UPDATE event_registrations keep
SET participant_pin = src.participant_pin
FROM event_registrations src
WHERE keep.status = 'accepted'
  AND keep.participant_pin IS NULL
  AND src.status = 'cancelled'
  AND src.participant_pin IS NOT NULL
  AND src.event_id = keep.event_id
  AND lower(trim(src.name)) = lower(trim(keep.name))
  AND NOT EXISTS (
    SELECT 1 FROM event_registrations other
    WHERE other.event_id = keep.event_id
      AND other.participant_pin = src.participant_pin
      AND other.id <> keep.id
      AND other.status <> 'cancelled'
  );

SELECT status, name, participant_pin, count(*) AS n
FROM event_registrations
GROUP BY status, name, participant_pin
ORDER BY name, status;
