-- ============================================================================
-- G-FLOOR CUSTOM CHAT
-- STEP 20A - CUSTOMER SERVICE KNOWLEDGE REVIEW DATABASE
-- ============================================================================
--
-- Purpose:
--
-- Store incoming Customer Service email knowledge in a permanent PostgreSQL
-- review queue before anything is allowed to become chatbot knowledge.
--
-- Workflow:
--
-- Incoming Customer Service Email
--          ↓
-- chat_training_reviews
--          ↓
-- Pending Review
--          ↓
-- APPROVE / EDIT / DENY
--          ↓
-- chat_approved_knowledge
--
-- Nothing in chat_training_reviews automatically becomes chatbot knowledge.
--
-- ============================================================================


-- ============================================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION gfloor_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- TABLE 1
-- CHAT TRAINING REVIEWS
-- ============================================================================
--
-- Stores:
--
-- - incoming Customer Service question
-- - Customer Service response
-- - proposed chatbot wording
-- - review status
-- - sensitive-data flags
-- - reviewer decisions
--
-- This is the approval queue.
--
-- ============================================================================

CREATE TABLE IF NOT EXISTS chat_training_reviews (

    id BIGSERIAL PRIMARY KEY,

    -- ------------------------------------------------------------------------
    -- SOURCE INFORMATION
    -- ------------------------------------------------------------------------

    source_type VARCHAR(100)
        NOT NULL
        DEFAULT 'customer-service-email',

    source_message_id TEXT,

    source_thread_id TEXT,

    source_folder TEXT,

    source_subject TEXT,

    source_sender TEXT,

    source_received_at TIMESTAMPTZ,

    source_url TEXT,


    -- ------------------------------------------------------------------------
    -- ORIGINAL CUSTOMER SERVICE CONTENT
    -- ------------------------------------------------------------------------
    --
    -- These fields preserve what actually came from the email conversation.
    --
    -- They are NOT automatically published to the chatbot.
    -- ------------------------------------------------------------------------

    customer_question TEXT
        NOT NULL,

    customer_service_response TEXT
        NOT NULL,


    -- ------------------------------------------------------------------------
    -- PROPOSED CHATBOT CONTENT
    -- ------------------------------------------------------------------------
    --
    -- These are the editable fields a reviewer will approve or deny.
    -- ------------------------------------------------------------------------

    suggested_question TEXT,

    suggested_answer TEXT,

    suggested_category VARCHAR(150),

    suggested_variations JSONB
        NOT NULL
        DEFAULT '[]'::jsonb,

    suggested_source_url TEXT,

    suggested_response_type VARCHAR(50)
        NOT NULL
        DEFAULT 'AUTO',


    -- ------------------------------------------------------------------------
    -- SENSITIVE INFORMATION REVIEW
    -- ------------------------------------------------------------------------

    sensitive_information_detected JSONB
        NOT NULL
        DEFAULT '[]'::jsonb,

    requires_sensitive_review BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    sensitive_review_completed BOOLEAN
        NOT NULL
        DEFAULT FALSE,


    -- ------------------------------------------------------------------------
    -- DUPLICATE DETECTION
    -- ------------------------------------------------------------------------

    possible_duplicate BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    duplicate_knowledge_id VARCHAR(150),


    -- ------------------------------------------------------------------------
    -- REVIEW STATUS
    -- ------------------------------------------------------------------------
    --
    -- Valid statuses:
    --
    -- pending-review
    -- approved
    -- denied
    --
    -- ------------------------------------------------------------------------

    status VARCHAR(30)
        NOT NULL
        DEFAULT 'pending-review',

    reviewer_name VARCHAR(200),

    reviewer_notes TEXT,

    reviewed_at TIMESTAMPTZ,


    -- ------------------------------------------------------------------------
    -- AUDIT TIMESTAMPS
    -- ------------------------------------------------------------------------

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),


    -- ------------------------------------------------------------------------
    -- VALIDATION
    -- ------------------------------------------------------------------------

    CONSTRAINT chat_training_reviews_valid_status
        CHECK (
            status IN (
                'pending-review',
                'approved',
                'denied'
            )
        ),

    CONSTRAINT chat_training_reviews_valid_response_type
        CHECK (
            suggested_response_type IN (
                'AUTO',
                'HUMAN REVIEW',
                'ALWAYS ESCALATE'
            )
        )
);


-- ============================================================================
-- PREVENT DUPLICATE EMAIL IMPORTS
-- ============================================================================
--
-- Microsoft Graph message IDs should be unique.
--
-- This prevents the same email from being imported repeatedly.
--
-- Rows without a source_message_id are still allowed for manual training.
--
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS
    idx_chat_training_reviews_source_message_id
ON chat_training_reviews (
    source_message_id
)
WHERE source_message_id IS NOT NULL;


-- ============================================================================
-- REVIEW QUEUE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS
    idx_chat_training_reviews_status
ON chat_training_reviews (
    status
);


CREATE INDEX IF NOT EXISTS
    idx_chat_training_reviews_category
ON chat_training_reviews (
    suggested_category
);


CREATE INDEX IF NOT EXISTS
    idx_chat_training_reviews_created_at
ON chat_training_reviews (
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
    idx_chat_training_reviews_sensitive_review
ON chat_training_reviews (
    requires_sensitive_review
);


CREATE INDEX IF NOT EXISTS
    idx_chat_training_reviews_possible_duplicate
ON chat_training_reviews (
    possible_duplicate
);


-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================

DROP TRIGGER IF EXISTS
    trg_chat_training_reviews_updated_at
ON chat_training_reviews;


CREATE TRIGGER
    trg_chat_training_reviews_updated_at
BEFORE UPDATE
ON chat_training_reviews
FOR EACH ROW
EXECUTE FUNCTION
    gfloor_set_updated_at();


-- ============================================================================
-- TABLE 2
-- APPROVED CHAT KNOWLEDGE
-- ============================================================================
--
-- Only human-approved information is copied into this table.
--
-- This table will eventually become the dynamic approved knowledge source
-- used by the G-Floor chatbot.
--
-- ============================================================================

CREATE TABLE IF NOT EXISTS chat_approved_knowledge (

    id BIGSERIAL PRIMARY KEY,


    -- ------------------------------------------------------------------------
    -- LINK BACK TO REVIEW
    -- ------------------------------------------------------------------------

    training_review_id BIGINT
        UNIQUE
        REFERENCES chat_training_reviews(id)
        ON DELETE SET NULL,


    -- ------------------------------------------------------------------------
    -- KNOWLEDGE IDENTIFIER
    -- ------------------------------------------------------------------------

    knowledge_id VARCHAR(150)
        UNIQUE
        NOT NULL,


    -- ------------------------------------------------------------------------
    -- APPROVED CHATBOT CONTENT
    -- ------------------------------------------------------------------------

    category VARCHAR(150)
        NOT NULL,

    question TEXT
        NOT NULL,

    variations JSONB
        NOT NULL
        DEFAULT '[]'::jsonb,

    answer TEXT
        NOT NULL,

    source_url TEXT,

    response_type VARCHAR(50)
        NOT NULL
        DEFAULT 'AUTO',


    -- ------------------------------------------------------------------------
    -- KNOWLEDGE STATUS
    -- ------------------------------------------------------------------------

    active BOOLEAN
        NOT NULL
        DEFAULT TRUE,


    -- ------------------------------------------------------------------------
    -- APPROVAL INFORMATION
    -- ------------------------------------------------------------------------

    approved_by VARCHAR(200)
        NOT NULL,

    approved_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),


    -- ------------------------------------------------------------------------
    -- AUDIT TIMESTAMPS
    -- ------------------------------------------------------------------------

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),


    -- ------------------------------------------------------------------------
    -- VALIDATION
    -- ------------------------------------------------------------------------

    CONSTRAINT chat_approved_knowledge_valid_response_type
        CHECK (
            response_type IN (
                'AUTO',
                'HUMAN REVIEW',
                'ALWAYS ESCALATE'
            )
        )
);


-- ============================================================================
-- APPROVED KNOWLEDGE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS
    idx_chat_approved_knowledge_active
ON chat_approved_knowledge (
    active
);


CREATE INDEX IF NOT EXISTS
    idx_chat_approved_knowledge_category
ON chat_approved_knowledge (
    category
);


CREATE INDEX IF NOT EXISTS
    idx_chat_approved_knowledge_question
ON chat_approved_knowledge (
    question
);


CREATE INDEX IF NOT EXISTS
    idx_chat_approved_knowledge_approved_at
ON chat_approved_knowledge (
    approved_at DESC
);


-- ============================================================================
-- APPROVED KNOWLEDGE UPDATED_AT TRIGGER
-- ============================================================================

DROP TRIGGER IF EXISTS
    trg_chat_approved_knowledge_updated_at
ON chat_approved_knowledge;


CREATE TRIGGER
    trg_chat_approved_knowledge_updated_at
BEFORE UPDATE
ON chat_approved_knowledge
FOR EACH ROW
EXECUTE FUNCTION
    gfloor_set_updated_at();


-- ============================================================================
-- VIEW 1
-- PENDING KNOWLEDGE REVIEWS
-- ============================================================================
--
-- Makes building the Step 20C dashboard easier.
--
-- ============================================================================

CREATE OR REPLACE VIEW
    chat_pending_reviews
AS

SELECT

    id,

    source_type,

    source_subject,

    source_sender,

    source_received_at,

    customer_question,

    customer_service_response,

    suggested_question,

    suggested_answer,

    suggested_category,

    suggested_variations,

    suggested_source_url,

    suggested_response_type,

    sensitive_information_detected,

    requires_sensitive_review,

    sensitive_review_completed,

    possible_duplicate,

    duplicate_knowledge_id,

    reviewer_notes,

    created_at,

    updated_at

FROM
    chat_training_reviews

WHERE
    status = 'pending-review'

ORDER BY
    created_at ASC;


-- ============================================================================
-- VIEW 2
-- REVIEW COUNTS
-- ============================================================================
--
-- Used later for dashboard cards:
--
-- Pending Review
-- Approved
-- Denied
--
-- ============================================================================

CREATE OR REPLACE VIEW
    chat_review_counts
AS

SELECT

    COUNT(*) FILTER (
        WHERE status = 'pending-review'
    ) AS pending_review,

    COUNT(*) FILTER (
        WHERE status = 'approved'
    ) AS approved,

    COUNT(*) FILTER (
        WHERE status = 'denied'
    ) AS denied,

    COUNT(*) AS total

FROM
    chat_training_reviews;


-- ============================================================================
-- VIEW 3
-- ACTIVE APPROVED KNOWLEDGE
-- ============================================================================
--
-- This will eventually be what the chatbot consumes.
--
-- ============================================================================

CREATE OR REPLACE VIEW
    chat_active_knowledge
AS

SELECT

    knowledge_id,

    category,

    question,

    variations,

    answer,

    source_url,

    response_type,

    approved_by,

    approved_at,

    updated_at

FROM
    chat_approved_knowledge

WHERE
    active = TRUE

ORDER BY
    category,
    question;


-- ============================================================================
-- COMPLETE
-- ============================================================================