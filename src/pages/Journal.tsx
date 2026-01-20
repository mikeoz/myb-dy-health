import { BookOpen } from "lucide-react";

/**
 * Journal Page - Placeholder for journal entries
 * 
 * GUARDRAIL: No PHI in logs
 */
const Journal = () => {
  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="page-header">
          <h1 className="page-title">Journal</h1>
          <p className="page-description">
            Record your health observations and notes.
          </p>
        </div>

        <div className="empty-state">
          <BookOpen className="empty-state-icon" />
          <h3 className="empty-state-title">Journal Coming Soon</h3>
          <p className="empty-state-description">
            This feature is under development. You'll be able to add journal entries here.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Journal;
