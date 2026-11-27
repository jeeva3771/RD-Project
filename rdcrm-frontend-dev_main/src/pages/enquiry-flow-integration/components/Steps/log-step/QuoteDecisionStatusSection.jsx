import React from "react";
import CommunicationLogForm from "../../common/CommunicationLogForm";

/**
 * QuoteDecisionStatusSection
 * Renders the Quotation Approval & Decision Status UI:
 * 1. CommunicationLogForm when logging internal CS / Admin decision
 * 2. Approved confirmation strip with details and update button
 * 3. Awaiting client nod strip with quick action buttons (Approve / Revision / Decline)
 * 4. Not yet sent placeholder strip
 */
const QuoteDecisionStatusSection = ({
  decisionMode,
  setDecisionMode,
  client,
  parentJobNo,
  handleSaveCommunicationLog,
  isQuoteApproved,
  formattedApprovalDate,
  approvedVia,
  approvedNote,
  isQuoteShared,
  isQuoteRevision,
  isQuoteRejected,
  checkLiveQuoteStatus,
  isCheckingStatus,
  isJobBlocked = false,
}) => {
  if (decisionMode !== null) {
    return (
      <div className="panel p-0 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden fade">
        <CommunicationLogForm
          client={client}
          pName={parentJobNo}
          feedbackMode={decisionMode}
          mode="quote"
          title={
            decisionMode === "approve"
              ? "Quotation approved. How did the client confirm?"
              : decisionMode === "revision"
              ? "Quotation revision requested. How did the client communicate?"
              : "Quotation declined. How did the client communicate?"
          }
          subTitle="Record proof of the client's decision so there is a verified record on the job before proceeding."
          buttonText={
            decisionMode === "approve"
              ? "Log approval & confirm quote"
              : decisionMode === "revision"
              ? "Log change request"
              : "Log decline & mark lost"
          }
          onBack={() => setDecisionMode(null)}
          onLog={handleSaveCommunicationLog}
        />
      </div>
    );
  }

  if (isQuoteApproved) {
    const isDirect = approvedVia?.toLowerCase().includes("link") || approvedVia?.toLowerCase().includes("online");
    return (
      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-base shrink-0 shadow-xs">
            ✓
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-extrabold text-sm text-emerald-950">
                Quotation Accepted &amp; Confirmed
              </h4>
              {isDirect ? (
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold inline-flex items-center gap-1">
                  🟢 Client Direct Approval
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300 text-[10px] font-bold inline-flex items-center gap-1">
                  🔵 Logged by Staff
                </span>
              )}
            </div>
            <p className="text-xs text-emerald-800 mt-0.5">
              Order acceptance recorded on {formattedApprovalDate} via{" "}
              <strong>{approvedVia}</strong>.
            </p>
            {approvedNote && (
              <p className="text-xs text-emerald-900 italic mt-1 bg-white/80 px-2.5 py-1 rounded-lg border border-emerald-200">
                "{approvedNote}"
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isQuoteShared) {
    return (
      <div className="panel p-5 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div className="flex items-start gap-2.5">
            <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0">
              ✉️
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-extrabold text-sm text-gray-900">
                  {isQuoteRevision
                    ? "Quotation Sent · Revision Requested by Client"
                    : isQuoteRejected
                    ? "Quotation Declined / Marked Lost"
                    : "Quotation Sent · Awaiting Client Decision"}
                </h4>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    isQuoteRevision
                      ? "bg-amber-100 text-amber-800"
                      : isQuoteRejected
                      ? "bg-rose-100 text-rose-800"
                      : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {isQuoteRevision
                    ? "REVISION"
                    : isQuoteRejected
                    ? "DECLINED"
                    : "PENDING NOD"}
                </span>
                {!isJobBlocked && (
                  <button
                    type="button"
                    onClick={() => checkLiveQuoteStatus(true)}
                    disabled={isCheckingStatus}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 ml-2 cursor-pointer inline-flex items-center gap-1"
                    title="Check if client has approved via their link"
                  >
                    <span className={isCheckingStatus ? "animate-spin" : ""}>↻</span>
                    <span>{isCheckingStatus ? "Checking..." : "Check Status"}</span>
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Client can approve via their public link. If the client communicated
                their decision via Call, WhatsApp, Email, or Meeting, record it below:
              </p>
            </div>
          </div>
        </div>

        {!isJobBlocked && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="text-xs text-gray-600 font-semibold">
              Client Servicing / Admin Decision Entry:
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setDecisionMode("approve")}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <span>✓</span>
                <span>Approve Quotation</span>
              </button>
              <button
                type="button"
                onClick={() => setDecisionMode("revision")}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <span>✏️</span>
                <span>Request Changes</span>
              </button>
              <button
                type="button"
                onClick={() => setDecisionMode("rejected")}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <span>✕</span>
                <span>Decline / Lost</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-50/80 border border-dashed border-gray-300 rounded-xl text-center space-y-1">
      <div className="text-xs font-bold text-gray-700">
        Quotation Not Yet Sent to Client
      </div>
      <p className="text-[11px] text-gray-500">
        Click "Preview &amp; Share Quote" above to dispatch quotation to the client. Next
        Stage Order Progression unlocks once the quotation is approved.
      </p>
    </div>
  );
};

export default QuoteDecisionStatusSection;

