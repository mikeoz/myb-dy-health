/**
 * Event-Based Data Model Type Definitions
 * 
 * GUARDRAIL: Event-first data model
 * - All health-related information is stored as immutable events
 * - No "current state overwrite" patterns
 * 
 * GUARDRAIL: Provenance is mandatory
 * - Every health-related event must reference a provenance record
 * - Provenance records capture source, method, and timestamp
 * 
 * GUARDRAIL: Consent is explicit and snapshot-based
 * - Consent is captured explicitly
 * - Each data operation references an immutable consent snapshot
 */

/**
 * Provenance record - captures the source and method of data entry.
 * Every health event MUST reference a provenance record.
 */
export interface Provenance {
  /** Unique identifier for this provenance record */
  readonly id: string;
  
  /** Source of the data */
  readonly source: ProvenanceSource;
  
  /** Method by which data was captured */
  readonly method: ProvenanceMethod;
  
  /** ISO timestamp when the provenance was recorded */
  readonly recordedAt: string;
  
  /** Optional external system identifier */
  readonly externalSystemId?: string;
  
  /** Optional reference to the user who entered the data */
  readonly enteredByUserId?: string;
}

/**
 * Source types for provenance tracking.
 */
export type ProvenanceSource = 
  | 'user_entry'      // Manually entered by user
  | 'provider_import' // Imported from healthcare provider
  | 'device_sync'     // Synced from health device
  | 'document_ocr'    // Extracted from uploaded document
  | 'api_integration' // From external API (e.g., Fasten)
  | 'system_derived'; // Calculated/derived by system

/**
 * Methods for data capture.
 */
export type ProvenanceMethod =
  | 'manual_form'     // User filled out a form
  | 'file_upload'     // User uploaded a file
  | 'api_fetch'       // Fetched from external API
  | 'device_push'     // Pushed from connected device
  | 'bulk_import'     // Bulk import operation
  | 'system_process'; // System processing

/**
 * Consent snapshot - immutable record of user consent at a point in time.
 */
export interface ConsentSnapshot {
  /** Unique identifier for this consent snapshot */
  readonly id: string;
  
  /** User who gave consent */
  readonly userId: string;
  
  /** ISO timestamp when consent was captured */
  readonly capturedAt: string;
  
  /** Version of the consent terms */
  readonly termsVersion: string;
  
  /** Specific consent grants */
  readonly grants: ConsentGrant[];
  
  /** How consent was captured */
  readonly captureMethod: 'explicit_checkbox' | 'signed_document' | 'verbal_recorded';
}

/**
 * Individual consent grant within a snapshot.
 */
export interface ConsentGrant {
  /** Type of consent */
  readonly type: ConsentType;
  
  /** Whether consent was granted */
  readonly granted: boolean;
  
  /** Optional scope limitations */
  readonly scope?: string;
}

/**
 * Types of consent that can be granted.
 */
export type ConsentType =
  | 'data_collection'       // Consent to collect health data
  | 'data_storage'          // Consent to store health data
  | 'data_processing'       // Consent to process/analyze data
  | 'provider_sharing'      // Consent to share with healthcare providers
  | 'research_participation' // Consent to use data for research
  | 'marketing_communications'; // Consent for marketing (non-health)

/**
 * Base interface for all health-related events.
 * Events are immutable - never updated, only appended.
 */
export interface BaseHealthEvent {
  /** Unique identifier for this event */
  readonly id: string;
  
  /** User this event belongs to */
  readonly userId: string;
  
  /** Reference to provenance record (MANDATORY) */
  readonly provenanceId: string;
  
  /** Reference to consent snapshot (MANDATORY) */
  readonly consentSnapshotId: string;
  
  /** ISO timestamp when the event occurred */
  readonly occurredAt: string;
  
  /** ISO timestamp when the event was recorded in system */
  readonly recordedAt: string;
  
  /** Event type discriminator */
  readonly eventType: string;
}

/**
 * Example: Document upload event.
 * Stores metadata only - actual document content is in secure storage.
 */
export interface DocumentUploadEvent extends BaseHealthEvent {
  readonly eventType: 'document_upload';
  
  /** Reference to document in secure storage (NOT the content) */
  readonly documentStorageRef: string;
  
  /** Document type classification */
  readonly documentType: DocumentType;
  
  /** MIME type of the document */
  readonly mimeType: string;
  
  /** File size in bytes */
  readonly sizeBytes: number;
}

/**
 * Document type classifications.
 */
export type DocumentType =
  | 'lab_result'
  | 'imaging_report'
  | 'prescription'
  | 'clinical_note'
  | 'insurance_document'
  | 'other';

/**
 * Job status for async operations.
 * 
 * GUARDRAIL: Asynchronous by default
 * - Any operation that could exceed a request lifecycle is modeled as a job
 */
export interface AsyncJob {
  /** Unique job identifier */
  readonly id: string;
  
  /** User who initiated the job */
  readonly userId: string;
  
  /** Type of job */
  readonly jobType: JobType;
  
  /** Current status */
  readonly status: JobStatus;
  
  /** ISO timestamp when job was created */
  readonly createdAt: string;
  
  /** ISO timestamp when job was last updated */
  readonly updatedAt: string;
  
  /** ISO timestamp when job completed (if applicable) */
  readonly completedAt?: string;
  
  /** Error code if job failed (no PHI in error messages) */
  readonly errorCode?: string;
}

/**
 * Types of async jobs.
 */
export type JobType =
  | 'document_processing'
  | 'data_import'
  | 'data_export'
  | 'provider_sync';

/**
 * Job status values.
 */
export type JobStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * GUARDRAIL: User isolation
 * - Users can only access their own data
 * - No shared data, no admin bypass, no cross-user queries
 * 
 * This type helper ensures all queries include userId filter.
 */
export type UserScopedQuery<T> = T & {
  readonly userId: string;
};
