import React from "react";
import { LOST } from "../../../utils/helpers";

const OrderProgressionSection = ({
  isQuoteApproved,
  isJobBlocked,
  s = {},
  lostOpen,
  setLostOpen,
  selectedLostReason,
  setSelectedLostReason,
  lostNotes,
  setLostNotes,
  isSubmittingDecision,
  handleAttemptOrderMode,
  handleConfirmLost,
}) => {
  // If the job is already lost or cancelled, display the locked state card
  if (isJobBlocked) {
    return (
      <div className="panel p-5 bg-rose-50/60 border border-rose-200 rounded-2xl shadow-2xs fade">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-black text-sm shrink-0">
            ✕
          </span>
          <div>
            <h4 className="font-extrabold text-sm text-rose-950">
              Order Route Terminated (Enquiry Abandoned)
            </h4>
            <p className="text-xs text-rose-700 mt-0.5">
              This enquiry was marked as Lost ({s.lostReason || s.lost || "Client declined"}). Order progression is locked.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Strictly guard: Appears ONLY after Quotation has been Approved
  if (!isQuoteApproved) return null;

  return (
    <div className="panel p-5 bg-white border border-gray-200 rounded-2xl shadow-sm fade">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-100">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 block">
            Next Stage: Order Progression
          </span>
          <h4 className="font-extrabold text-base text-gray-900">
            What did the client say?
          </h4>
        </div>
        <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
          <span>✓</span> Quotation Approved · Choose order route
        </span>
      </div>

      {/* 3-Option Decide Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-4">
        {/* 1. Won: sample first */}
        <button
          type="button"
          onClick={() => handleAttemptOrderMode("sample")}
          className="p-5 rounded-2xl border-2 border-emerald-200 hover:border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50 text-left transition cursor-pointer shadow-xs group"
        >
          <span className="text-3xl block mb-2 group-hover:scale-110 transition-transform origin-left">
            🧪
          </span>
          <div className="font-extrabold text-base text-emerald-950">
            Won: sample first
          </div>
          <div className="text-xs text-emerald-800 mt-1 leading-snug">
            Everything from the enquiry carries over
          </div>
        </button>

        {/* 2. Won: go to production */}
        <button
          type="button"
          onClick={() => handleAttemptOrderMode("production")}
          className="p-5 rounded-2xl border-2 border-indigo-200 hover:border-indigo-600 bg-indigo-50/40 hover:bg-indigo-50 text-left transition cursor-pointer shadow-xs group"
        >
          <span className="text-3xl block mb-2 group-hover:scale-110 transition-transform origin-left">
            🏭
          </span>
          <div className="font-extrabold text-base text-indigo-950">
            Won: go to production
          </div>
          <div className="text-xs text-indigo-800 mt-1 leading-snug">
            Final qty, PO, date. That's all
          </div>
        </button>

        {/* 3. Lost */}
        <button
          type="button"
          onClick={() => setLostOpen((prev) => !prev)}
          className={`p-5 rounded-2xl border-2 text-left transition cursor-pointer shadow-xs group ${
            lostOpen
              ? "border-rose-500 bg-rose-50/90 ring-2 ring-rose-200"
              : "border-rose-200 hover:border-rose-400 bg-rose-50/40 hover:bg-rose-50"
          }`}
        >
          <span className="text-3xl block mb-2 group-hover:scale-110 transition-transform origin-left">
            ✋
          </span>
          <div className="font-extrabold text-base text-rose-950">
            Lost
          </div>
          <div className="text-xs text-rose-800 mt-1 leading-snug">
            One tap for the reason
          </div>
        </button>
      </div>

      {/* Collapsible Lost Reason Chips */}
      {lostOpen && (
        <div className="mt-4 p-4 bg-rose-50/70 border border-rose-200 rounded-2xl fade">
          <div className="text-xs font-bold text-rose-950 mb-2">
            Why did we lose it? (Select reason to cancel & abandon enquiry)
          </div>
          <div className="flex flex-wrap gap-2">
            {LOST.map((reason) => (
              <button
                key={reason}
                type="button"
                onClick={() => setSelectedLostReason(reason)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                  selectedLostReason === reason
                    ? "bg-rose-600 text-white shadow-xs font-bold"
                    : "bg-white text-gray-700 border border-gray-200 hover:border-rose-300"
                }`}
              >
                {reason}
              </button>
            ))}
          </div>

          <div className="mt-3.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="text"
              value={lostNotes}
              onChange={(ev) => setLostNotes(ev.target.value)}
              placeholder="Additional context or remarks (optional)..."
              className="flex-1 text-xs px-3 py-2 bg-white border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-rose-400"
            />
            <button
              type="button"
              disabled={!selectedLostReason || isSubmittingDecision}
              onClick={handleConfirmLost}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-extrabold rounded-xl transition cursor-pointer shadow-xs whitespace-nowrap"
            >
              {isSubmittingDecision ? "Abandoning..." : "Confirm & Cancel Enquiry"}
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-2">
            Marking as Lost drops this enquiry, locks all further edits, and moves it to the Cancelled Orders board.
          </p>
        </div>
      )}
    </div>
  );
};

export default OrderProgressionSection;

