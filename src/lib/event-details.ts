/**
 * Safe accessors for timeline event details JSON
 * 
 * These helpers eliminate unsafe casts like `as string` when reading
 * from the loosely-typed `details` JSON column.
 * 
 * GUARDRAIL: No PHI in logs - these functions never log values
 */

/**
 * Safely get a string value from details object
 */
export function getString(details: unknown, key: string): string | null {
  if (
    details !== null &&
    typeof details === "object" &&
    key in details &&
    typeof (details as Record<string, unknown>)[key] === "string"
  ) {
    return (details as Record<string, unknown>)[key] as string;
  }
  return null;
}

/**
 * Alias for getString - explicitly marks optional intent
 */
export function getOptionalString(details: unknown, key: string): string | null {
  return getString(details, key);
}

/**
 * Get category from details with safe access
 */
export function getOptionalCategory(details: unknown): string | null {
  return getString(details, "category");
}

/**
 * Get document artifact ID from details
 */
export function getDocumentArtifactId(details: unknown): string | null {
  return getString(details, "document_artifact_id");
}

/**
 * Get amended event ID from details
 */
export function getAmendsEventId(details: unknown): string | null {
  return getString(details, "amends_event_id");
}

/**
 * Get amended event type from details
 */
export function getAmendedEventType(details: unknown): string | null {
  return getString(details, "amended_event_type");
}

/**
 * Get text content from details (for journal entries)
 */
export function getText(details: unknown): string | null {
  return getString(details, "text");
}

/**
 * Get doc_type from details
 */
export function getDocType(details: unknown): string | null {
  return getString(details, "doc_type");
}

/**
 * Get notes from details
 */
export function getNotes(details: unknown): string | null {
  return getString(details, "notes");
}
