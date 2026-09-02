-- Flattened view over the analytics log sink, for the Looker Studio dashboard.
-- Cloud Logging lowercases every field name and nests them under `jsonPayload`, so the
-- raw `stdout` table is painful to build charts on. Reporting reads this instead.
--
-- Apply with:
--   bq --project_id=scorecards-v2-prod query --use_legacy_sql=false < docs/analytics-view.sql
--
-- See .github/workflows/README.md section 6 for the sink and dashboard setup.

CREATE OR REPLACE VIEW `scorecards-v2-prod.analytics.events` AS
SELECT
  timestamp,
  DATE(timestamp)                         AS day,
  jsonPayload.event                       AS event,
  jsonPayload.comp.id                     AS competition_id,
  jsonPayload.comp.country                AS country,
  jsonPayload.comp.custom                 AS is_custom,
  -- Looker Studio maps take ONE field typed Geo > Latitude,Longitude. NULL for
  -- session/error rows and for custom competitions, which the map skips.
  IF(jsonPayload.comp.lat IS NULL, NULL,
     CONCAT(CAST(jsonPayload.comp.lat AS STRING), ',',
            CAST(jsonPayload.comp.lng AS STRING)))       AS latlng,
  jsonPayload.comp.lat                    AS latitude,
  jsonPayload.comp.lng                    AS longitude,
  CAST(jsonPayload.size.competitors AS INT64) AS competitors,
  CAST(jsonPayload.size.events      AS INT64) AS event_count,
  CAST(jsonPayload.size.rounds      AS INT64) AS round_count,
  CAST(jsonPayload.size.groups      AS INT64) AS group_count,
  CAST(jsonPayload.size.stages      AS INT64) AS stage_count,
  CAST(jsonPayload.size.days        AS INT64) AS day_count,
  CAST(jsonPayload.output.pdfs       AS INT64) AS pdfs,
  CAST(jsonPayload.output.pages      AS INT64) AS pages,
  CAST(jsonPayload.output.scorecards AS INT64) AS scorecards,
  CAST(jsonPayload.output.covercards AS INT64) AS cover_cards,
  jsonPayload.settings.language           AS language,
  jsonPayload.settings.secondarylanguage  AS secondary_language,
  jsonPayload.settings.uilanguage         AS ui_language,
  jsonPayload.settings.paperformat        AS paper_format,
  jsonPayload.settings.preset             AS preset,
  jsonPayload.settings.logo               AS logo,
  jsonPayload.settings.nametaglayout      AS nametag_layout,
  jsonPayload.settings.nametaglogomode    AS nametag_logo_mode,
  jsonPayload.settings.nametagqrmode      AS nametag_qr_mode,
  jsonPayload.settings.secondroundmode    AS second_round_mode,
  jsonPayload.settings.scorecardcheckmode AS scorecard_check_mode,
  jsonPayload.settings.hidewcaliveid      AS hide_wca_live_id,
  jsonPayload.settings.scrambledoublecheck AS scramble_double_check,
  CAST(jsonPayload.settings.customevents AS INT64) AS custom_events,
  jsonPayload.scope.mode                  AS scope_mode,
  ARRAY_TO_STRING(jsonPayload.scope.documents, ', ') AS documents
  -- The sink adds a column only when an event shape first appears, and no `error`
  -- event has been logged yet. Once one is, re-run this DDL with the two lines below
  -- uncommented to expose them:
  --   jsonPayload.stage   AS error_stage,
  --   jsonPayload.message AS error_message
FROM `scorecards-v2-prod.analytics.stdout`
