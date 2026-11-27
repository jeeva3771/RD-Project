export const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

export const COLLECTION_STAGES = [
  { id: "new", label: "New / Outstanding", color: "#64748B", bg: "#F8FAFC", border: "#CBD5E1" },
  { id: "contacted", label: "Contacted", color: "#4F46E5", bg: "#EEF2FF", border: "#C7D2FE" },
  { id: "promised", label: "Promised to Pay", color: "#0D9488", bg: "#F0FDFA", border: "#99F6E4" },
  { id: "followup", label: "Follow-up Scheduled", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
  { id: "escalated", label: "Escalated / At Risk", color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
  { id: "closed", label: "Paid / Closed", color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE" },
];

export const INV_STATUS_LABEL = {
  outstanding: "Outstanding",
  duesoon: "Due Soon",
  overdue: "Overdue",
  followup: "Follow-up Scheduled",
  partial: "Partially Paid",
  paid: "Fully Paid",
};

export const INV_STATUS_STYLE = {
  outstanding: "bg-slate-100 text-slate-700 border-slate-200",
  duesoon: "bg-amber-50 text-amber-800 border-amber-200",
  overdue: "bg-rose-50 text-rose-700 border-rose-200",
  followup: "bg-sky-50 text-sky-800 border-sky-200",
  partial: "bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

