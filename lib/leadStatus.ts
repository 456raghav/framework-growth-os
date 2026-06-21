// Decides what status a lead should be in based on what we know about them.
// Pure function — no side effects, easy to test, easy to reason about.
// This is the "brain" of the qualification pipeline, kept separate from
// the AI call so the logic is deterministic and auditable.

export type ExtractedLeadData = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  serviceNeeded?: string | null;
  budget?: string | null;
  timeline?: string | null;
  wantsToBook?: boolean;
  preferredCallTime?: string | null;
};

export type LeadStatus =
  | "New"
  | "Qualified"
  | "Hot"
  | "Callback Requested"
  | "Booked";

export function determineLeadStatus(
  data: ExtractedLeadData,
  currentStatus: LeadStatus | null
): LeadStatus {
  const hasContact = Boolean(data.email || data.phone);
  const hasName = Boolean(data.name);
  const hasService = Boolean(data.serviceNeeded);
  const hasBudgetOrTimeline = Boolean(data.budget || data.timeline);
  const hasCallTime = Boolean(data.preferredCallTime);

  // Booked: everything Hot requires, PLUS a specific time they're free.
  // This is now earned by the conversation, not just set manually —
  // though a human can still manually downgrade it later if the
  // callback falls through (e.g. back to "Callback Requested").
  if (
    hasContact &&
    hasName &&
    hasService &&
    hasBudgetOrTimeline &&
    data.wantsToBook &&
    hasCallTime
  ) {
    return "Booked";
  }

  // Once manually confirmed Booked by a human, don't auto-downgrade
  // just because this turn's extraction is missing a field —
  // only downgrade if the visitor's own data no longer supports it
  // AND a human hasn't already locked it in this session.
  if (currentStatus === "Booked" && hasCallTime) {
    return "Booked";
  }

  // Hot: ready to book, but no specific time confirmed yet
  if (hasContact && hasName && hasService && hasBudgetOrTimeline && data.wantsToBook) {
    return "Hot";
  }

  // Qualified: we know what they need and have a way to reach them
  if (hasContact && hasService) {
    return "Qualified";
  }

  // Callback Requested: they gave contact info but conversation is incomplete
  if (hasContact && !hasService) {
    return "Callback Requested";
  }

  return "New";
}

// Simple 0-100 score for sorting/prioritizing in the dashboard.
// Not used for status — status is the source of truth for pipeline stage.
// Score is just a quick visual signal of "how much do we know about this lead."
export function calculateQualificationScore(data: ExtractedLeadData): number {
  let score = 0;

  if (data.name) score += 12;
  if (data.email) score += 18;
  if (data.phone) score += 18;
  if (data.serviceNeeded) score += 18;
  if (data.budget) score += 10;
  if (data.timeline) score += 7;
  if (data.wantsToBook) score += 5;
  if (data.preferredCallTime) score += 12;

  return Math.min(score, 100);
}
