import { JournalEntryForm } from "@/components/journal/JournalEntryForm";

/**
 * Journal Page - Create new journal entries
 * 
 * GUARDRAIL: No PHI in logs
 * GUARDRAIL: Event-first data model with provenance
 */
const Journal = () => {
  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="max-w-md mx-auto">
        <div className="page-header">
          <h1 className="page-title">New Journal Entry</h1>
          <p className="page-description">
            Capture a note about symptoms, meds, mood, questions for your doctor, or anything important.
          </p>
        </div>

        <JournalEntryForm />
      </div>
    </div>
  );
};

export default Journal;
