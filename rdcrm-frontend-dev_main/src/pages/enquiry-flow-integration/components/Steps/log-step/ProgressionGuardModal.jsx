import React from "react";

const ProgressionGuardModal = ({
  showProgressionGuard,
  setShowProgressionGuard,
  subJobRows = [],
  pendingOrderMode,
  isActionLoading,
  handleConfirmProgressionGuard,
}) => {
  if (!showProgressionGuard) return null;

  const unapprovedRows = subJobRows.filter(
    (r) =>
      !r.isDrop &&
      !r.isHold &&
      r.clientDecision !== "approved" &&
      r.costingStatus !== "completed"
  );

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 fade">
        <div className="p-4 bg-amber-500 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚠️</span>
            <h3 className="font-bold text-sm">
              Partial Order Progression Guard
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setShowProgressionGuard(false)}
            className="text-white/80 hover:text-white cursor-pointer font-bold"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-3 text-xs leading-relaxed">
          <p className="text-gray-800 font-medium">
            Some sub-jobs on this enquiry are not yet approved by the client:
          </p>

          <div className="border border-amber-200 bg-amber-50/50 rounded-xl p-3 space-y-1.5">
            {unapprovedRows.map((r) => (
              <div
                key={r.subJobNo}
                className="flex justify-between items-center text-[11px] text-amber-950"
              >
                <span className="font-bold">
                  {r.subJobNo} · {r.name}
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-900 font-semibold">
                  Costing: {r.costingStatus}
                </span>
              </div>
            ))}
          </div>

          <p className="text-gray-600">
            To prevent unapproved trophies from delaying your order, RD CRM will automatically place these pending items on{" "}
            <strong className="text-amber-900">HOLD</strong>. The approved trophies will progress immediately to Step 4 (
            {pendingOrderMode === "sample" ? "Sample Order" : "Production Order"}).
          </p>
          <p className="text-[11px] text-gray-500 italic">
            You can easily resume the held sub-jobs later when the client confirms them.
          </p>
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
          <button
            type="button"
            disabled={isActionLoading}
            onClick={() => setShowProgressionGuard(false)}
            className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 transition cursor-pointer"
          >
            Stay on Log & Track
          </button>
          <button
            type="button"
            disabled={isActionLoading}
            onClick={handleConfirmProgressionGuard}
            className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            {isActionLoading
              ? "Holding & Progressing..."
              : "Put Pending on HOLD & Proceed"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProgressionGuardModal;

