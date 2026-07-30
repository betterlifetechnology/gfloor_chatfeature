-- ============================================================================
-- G-FLOOR CUSTOM CHAT
-- STEP 20J.1 - APPROVED KNOWLEDGE REPORTING DATABASE
-- ============================================================================
--
-- Purpose:
--
-- Store anonymous usage events for human-approved chatbot knowledge.
--
-- This reporting database does NOT store:
--
-- - raw customer questions
-- - chatbot answer text
-- - customer names
-- - customer email addresses
-- - customer phone numbers
-- - order numbers
--
-- Supported events:
--
-- - approved_knowledge_answer
-- - approved_knowledge_helpful_yes
-- - approved_knowledge_helpful_no
--
-- ============================================================================


-- ============================================================================
-- TABLE 1
-- APPROVED KNOWLEDGE ANALYTICS EVENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS chat_approved_knowledge_events (

    id BIGSERIAL PRIMARY KEY,

    -- ------------------------------------------------------------------------
    -- EVENT IDENTIFICATION
    -- ------------------------------------------------------------------------

    client_event_id VARCHAR(150),

    event_type VARCHAR(80)
        NOT NULL,

    -- ------------------------------------------------------------------------
    -- APPROVED KNOWLEDGE IDENTIFICATION
    -- ------------------------------------------------------------------------

    approved_knowledge_id VARCHAR(150)
        NOT NULL,

    approved_knowledge_category VARCHAR(150),

    approved_response_type VARCHAR(50),

    knowledge_source VARCHAR(50)
        NOT NULL
        DEFAULT 'approved_database',

    response_mode VARCHAR(50)
        NOT NULL
        DEFAULT 'approved_database',

    -- ------------------------------------------------------------------------
    -- ANONYMOUS CHAT CONTEXT
    -- ------------------------------------------------------------------------

    conversation_id VARCHAR(150),

    page_type VARCHAR(100),

    product_handle VARCHAR(300),

    collection_handle VARCHAR(300),

    variant_id VARCHAR(100),

    -- ------------------------------------------------------------------------
    -- TIMESTAMPS
    -- ------------------------------------------------------------------------

    occurred_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    received_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    -- ------------------------------------------------------------------------
    -- OPTIONAL SAFE METADATA
    -- ------------------------------------------------------------------------

    metadata JSONB
        NOT NULL
        DEFAULT '{}'::jsonb,

    -- ------------------------------------------------------------------------
    -- VALIDATION
    -- ------------------------------------------------------------------------

    CONSTRAINT chat_approved_knowledge_events_valid_event_type
        CHECK (
            event_type IN (
                'approved_knowledge_answer',
                'approved_knowledge_helpful_yes',
                'approved_knowledge_helpful_no'
            )
        ),

    CONSTRAINT chat_approved_knowledge_events_valid_source
        CHECK (
            knowledge_source = 'approved_database'
        ),

    CONSTRAINT chat_approved_knowledge_events_valid_response_mode
        CHECK (
            response_mode = 'approved_database'
        )
);


-- ============================================================================
-- PREVENT DUPLICATE CLIENT EVENTS
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS
    idx_chat_approved_events_client_event_id
ON chat_approved_knowledge_events (
    client_event_id
)
WHERE client_event_id IS NOT NULL;


-- ============================================================================
-- REPORTING INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS
    idx_chat_approved_events_event_type
ON chat_approved_knowledge_events (
    event_type
);


CREATE INDEX IF NOT EXISTS
    idx_chat_approved_events_knowledge_id
ON chat_approved_knowledge_events (
    approved_knowledge_id
);


CREATE INDEX IF NOT EXISTS
    idx_chat_approved_events_category
ON chat_approved_knowledge_events (
    approved_knowledge_category
);


CREATE INDEX IF NOT EXISTS
    idx_chat_approved_events_occurred_at
ON chat_approved_knowledge_events (
    occurred_at DESC
);


CREATE INDEX IF NOT EXISTS
    idx_chat_approved_events_knowledge_date
ON chat_approved_knowledge_events (
    approved_knowledge_id,
    occurred_at DESC
);


CREATE INDEX IF NOT EXISTS
    idx_chat_approved_events_product
ON chat_approved_knowledge_events (
    product_handle
)
WHERE product_handle IS NOT NULL;


-- ============================================================================
-- VIEW 1
-- REPORTING SUMMARY BY APPROVED KNOWLEDGE ENTRY
-- ============================================================================

CREATE OR REPLACE VIEW
    chat_approved_knowledge_reporting_summary
AS

SELECT

    approved_knowledge_id,

    MAX(
        approved_knowledge_category
    ) AS approved_knowledge_category,

    MAX(
        approved_response_type
    ) AS approved_response_type,

    COUNT(*) FILTER (
        WHERE event_type =
            'approved_knowledge_answer'
    ) AS answer_count,

    COUNT(*) FILTER (
        WHERE event_type =
            'approved_knowledge_helpful_yes'
    ) AS helpful_yes_count,

    COUNT(*) FILTER (
        WHERE event_type =
            'approved_knowledge_helpful_no'
    ) AS helpful_no_count,

    COUNT(*) FILTER (
        WHERE event_type IN (
            'approved_knowledge_helpful_yes',
            'approved_knowledge_helpful_no'
        )
    ) AS feedback_count,

    CASE
        WHEN COUNT(*) FILTER (
            WHERE event_type IN (
                'approved_knowledge_helpful_yes',
                'approved_knowledge_helpful_no'
            )
        ) = 0
        THEN NULL

        ELSE ROUND(
            (
                COUNT(*) FILTER (
                    WHERE event_type =
                        'approved_knowledge_helpful_yes'
                )::NUMERIC
                /
                COUNT(*) FILTER (
                    WHERE event_type IN (
                        'approved_knowledge_helpful_yes',
                        'approved_knowledge_helpful_no'
                    )
                )::NUMERIC
            ) * 100,
            2
        )
    END AS helpful_rate,

    MIN(
        occurred_at
    ) AS first_event_at,

    MAX(
        occurred_at
    ) AS last_event_at

FROM chat_approved_knowledge_events

GROUP BY
    approved_knowledge_id;


-- ============================================================================
-- VIEW 2
-- REPORTING SUMMARY BY CATEGORY
-- ============================================================================

CREATE OR REPLACE VIEW
    chat_approved_knowledge_category_summary
AS

SELECT

    COALESCE(
        NULLIF(
            approved_knowledge_category,
            ''
        ),
        'Uncategorized'
    ) AS category,

    COUNT(*) FILTER (
        WHERE event_type =
            'approved_knowledge_answer'
    ) AS answer_count,

    COUNT(*) FILTER (
        WHERE event_type =
            'approved_knowledge_helpful_yes'
    ) AS helpful_yes_count,

    COUNT(*) FILTER (
        WHERE event_type =
            'approved_knowledge_helpful_no'
    ) AS helpful_no_count,

    COUNT(*) FILTER (
        WHERE event_type IN (
            'approved_knowledge_helpful_yes',
            'approved_knowledge_helpful_no'
        )
    ) AS feedback_count,

    CASE
        WHEN COUNT(*) FILTER (
            WHERE event_type IN (
                'approved_knowledge_helpful_yes',
                'approved_knowledge_helpful_no'
            )
        ) = 0
        THEN NULL

        ELSE ROUND(
            (
                COUNT(*) FILTER (
                    WHERE event_type =
                        'approved_knowledge_helpful_yes'
                )::NUMERIC
                /
                COUNT(*) FILTER (
                    WHERE event_type IN (
                        'approved_knowledge_helpful_yes',
                        'approved_knowledge_helpful_no'
                    )
                )::NUMERIC
            ) * 100,
            2
        )
    END AS helpful_rate

FROM chat_approved_knowledge_events

GROUP BY
    COALESCE(
        NULLIF(
            approved_knowledge_category,
            ''
        ),
        'Uncategorized'
    );


-- ============================================================================
-- VIEW 3
-- DAILY APPROVED KNOWLEDGE REPORTING
-- ============================================================================

CREATE OR REPLACE VIEW
    chat_approved_knowledge_daily_summary
AS

SELECT

    DATE(
        occurred_at AT TIME ZONE
        'America/Chicago'
    ) AS report_date,

    COUNT(*) FILTER (
        WHERE event_type =
            'approved_knowledge_answer'
    ) AS answer_count,

    COUNT(*) FILTER (
        WHERE event_type =
            'approved_knowledge_helpful_yes'
    ) AS helpful_yes_count,

    COUNT(*) FILTER (
        WHERE event_type =
            'approved_knowledge_helpful_no'
    ) AS helpful_no_count,

    COUNT(
        DISTINCT approved_knowledge_id
    ) FILTER (
        WHERE event_type =
            'approved_knowledge_answer'
    ) AS knowledge_entries_used,

    COUNT(
        DISTINCT conversation_id
    ) FILTER (
        WHERE conversation_id IS NOT NULL
    ) AS conversation_count

FROM chat_approved_knowledge_events

GROUP BY
    DATE(
        occurred_at AT TIME ZONE
        'America/Chicago'
    );


-- ============================================================================
-- VIEW 4
-- OVERALL APPROVED KNOWLEDGE REPORTING TOTALS
-- ============================================================================

CREATE OR REPLACE VIEW
    chat_approved_knowledge_reporting_totals
AS

SELECT

    COUNT(*) FILTER (
        WHERE event_type =
            'approved_knowledge_answer'
    ) AS total_answers,

    COUNT(*) FILTER (
        WHERE event_type =
            'approved_knowledge_helpful_yes'
    ) AS total_helpful_yes,

    COUNT(*) FILTER (
        WHERE event_type =
            'approved_knowledge_helpful_no'
    ) AS total_helpful_no,

    COUNT(*) FILTER (
        WHERE event_type IN (
            'approved_knowledge_helpful_yes',
            'approved_knowledge_helpful_no'
        )
    ) AS total_feedback,

    COUNT(
        DISTINCT approved_knowledge_id
    ) FILTER (
        WHERE event_type =
            'approved_knowledge_answer'
    ) AS knowledge_entries_used,

    COUNT(
        DISTINCT conversation_id
    ) FILTER (
        WHERE conversation_id IS NOT NULL
    ) AS conversations,

    CASE
        WHEN COUNT(*) FILTER (
            WHERE event_type IN (
                'approved_knowledge_helpful_yes',
                'approved_knowledge_helpful_no'
            )
        ) = 0
        THEN NULL

        ELSE ROUND(
            (
                COUNT(*) FILTER (
                    WHERE event_type =
                        'approved_knowledge_helpful_yes'
                )::NUMERIC
                /
                COUNT(*) FILTER (
                    WHERE event_type IN (
                        'approved_knowledge_helpful_yes',
                        'approved_knowledge_helpful_no'
                    )
                )::NUMERIC
            ) * 100,
            2
        )
    END AS helpful_rate,

    MIN(
        occurred_at
    ) AS first_event_at,

    MAX(
        occurred_at
    ) AS last_event_at

FROM chat_approved_knowledge_events;