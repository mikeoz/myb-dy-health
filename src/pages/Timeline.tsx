import { Clock } from "lucide-react";

/**
 * Timeline Page
 * 
 * Displays health events in chronological order.
 * 
 * GUARDRAIL: Event-first data model
 * - All health-related information is stored as immutable events
 * - Events are displayed chronologically, never modified
 * 
 * GUARDRAIL: User isolation
 * - Users can only access their own timeline events
 */
const Timeline = () => {
  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Timeline</h1>
        <p className="page-description">
          Your health events in chronological order
        </p>
      </div>

      {/* Empty state - no events yet */}
      <div className="empty-state">
        <Clock className="empty-state-icon" />
        <h3 className="empty-state-title">No events yet</h3>
        <p className="empty-state-description">
          Your health timeline will appear here as you add documents and connect sources.
        </p>
      </div>

      {/* TODO: Implement timeline event list
       * - Fetch events from database (user-scoped)
       * - Display in reverse chronological order
       * - Show provenance information for each event
       * - Link to source documents/records
       */}
    </div>
  );
};

export default Timeline;
