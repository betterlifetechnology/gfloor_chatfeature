-- ============================================================================
-- G-FLOOR CUSTOM CHAT
-- STEP 20J.6A
-- APPROVED KNOWLEDGE ACTIVATION STATUS AUDIT
-- ============================================================================
--
-- Purpose:
--
-- Add safe deactivation and reactivation audit fields to the existing
-- chat_approved_knowledge table.
--
-- This migration does not delete approved knowledge or reporting history.
--
-- ============================================================================


-- ============================================================================
-- ADD DEACTIVATION FIELDS
-- ============================================================================

ALTER TABLE
  chat_approved_knowledge

ADD COLUMN IF NOT EXISTS
  deactivated_by VARCHAR(200),

ADD COLUMN IF NOT EXISTS
  deactivated_at TIMESTAMPTZ,

ADD COLUMN IF NOT EXISTS
  deactivation_reason TEXT;


-- ============================================================================
-- ADD REACTIVATION FIELDS
-- ============================================================================

ALTER TABLE
  chat_approved_knowledge

ADD COLUMN IF NOT EXISTS
  reactivated_by VARCHAR(200),

ADD COLUMN IF NOT EXISTS
  reactivated_at TIMESTAMPTZ,

ADD COLUMN IF NOT EXISTS
  reactivation_reason TEXT;


-- ============================================================================
-- STATUS UPDATE TIMESTAMP
-- ============================================================================

ALTER TABLE
  chat_approved_knowledge

ADD COLUMN IF NOT EXISTS
  status_updated_at TIMESTAMPTZ;


-- ============================================================================
-- STATUS CONSTRAINT
-- ============================================================================
--
-- Active records must not have an active deactivation timestamp.
--
-- Inactive records must have deactivation audit information.
--
-- This is intentionally added as NOT VALID first so existing records can be
-- normalized before PostgreSQL validates the entire table.
--
-- ============================================================================

ALTER TABLE
  chat_approved_knowledge

DROP CONSTRAINT IF EXISTS
  chat_approved_knowledge_deactivation_audit;


ALTER TABLE
  chat_approved_knowledge

ADD CONSTRAINT
  chat_approved_knowledge_deactivation_audit

CHECK (
  (
    active = TRUE
  )
  OR
  (
    active = FALSE
    AND deactivated_by IS NOT NULL
    AND deactivated_at IS NOT NULL
    AND deactivation_reason IS NOT NULL
    AND LENGTH(
      TRIM(
        deactivation_reason
      )
    ) > 0
  )
)

NOT VALID;


-- ============================================================================
-- NORMALIZE EXISTING RECORDS
-- ============================================================================

UPDATE
  chat_approved_knowledge

SET
  status_updated_at =
    COALESCE(
      status_updated_at,
      updated_at,
      approved_at,
      NOW()
    )

WHERE
  status_updated_at IS NULL;


-- ============================================================================
-- NORMALIZE ANY EXISTING INACTIVE RECORDS
-- ============================================================================

UPDATE
  chat_approved_knowledge

SET
  deactivated_by =
    COALESCE(
      NULLIF(
        TRIM(
          deactivated_by
        ),
        ''
      ),
      'Legacy System'
    ),

  deactivated_at =
    COALESCE(
      deactivated_at,
      updated_at,
      approved_at,
      NOW()
    ),

  deactivation_reason =
    COALESCE(
      NULLIF(
        TRIM(
          deactivation_reason
        ),
        ''
      ),
      'Inactive before approved knowledge status auditing was enabled.'
    ),

  status_updated_at =
    COALESCE(
      status_updated_at,
      updated_at,
      approved_at,
      NOW()
    )

WHERE
  active = FALSE;


-- ============================================================================
-- VALIDATE STATUS CONSTRAINT
-- ============================================================================

ALTER TABLE
  chat_approved_knowledge

VALIDATE CONSTRAINT
  chat_approved_knowledge_deactivation_audit;


-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS
  idx_chat_approved_knowledge_active

ON
  chat_approved_knowledge (
    active
  );


CREATE INDEX IF NOT EXISTS
  idx_chat_approved_knowledge_status_updated

ON
  chat_approved_knowledge (
    status_updated_at DESC
  );


CREATE INDEX IF NOT EXISTS
  idx_chat_approved_knowledge_deactivated_at

ON
  chat_approved_knowledge (
    deactivated_at DESC
  )

WHERE
  active = FALSE;


-- ============================================================================
-- STATUS VIEW
-- ============================================================================

CREATE OR REPLACE VIEW
  chat_approved_knowledge_status

AS

SELECT

  knowledge.id,

  knowledge.training_review_id,

  knowledge.knowledge_id,

  knowledge.category,

  knowledge.question,

  knowledge.variations,

  knowledge.answer,

  knowledge.source_url,

  knowledge.response_type,

  knowledge.active,

  knowledge.approved_by,

  knowledge.approved_at,

  knowledge.deactivated_by,

  knowledge.deactivated_at,

  knowledge.deactivation_reason,

  knowledge.reactivated_by,

  knowledge.reactivated_at,

  knowledge.reactivation_reason,

  knowledge.status_updated_at,

  knowledge.created_at,

  knowledge.updated_at,

  CASE
    WHEN knowledge.active = TRUE
    THEN 'active'

    ELSE 'inactive'
  END AS activation_status

FROM
  chat_approved_knowledge knowledge;