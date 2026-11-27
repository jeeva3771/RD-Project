import React from "react";

const SubJobLifecycleModal = ({
  dialogAction,
  setDialogAction,
  dialogReason,
  setDialogReason,
  isActionLoading,
  handleConfirmLifecycleAction,
}) => {
  if (!dialogAction) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-100 fade">
        <div
          className={`p-4 border-b flex items-center justify-between ${
            dialogAction.type === "drop"
              ? "bg-rose-50 text-rose-900 border-rose-100"
              : "bg-amber-50 text-amber-900 border-amber-100"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">
              {dialogAction.type === "drop" ? "✕" : "⏳"}
            </span>
            <div>
              <h3 className="font-bold text-sm">
                {dialogAction.type === "drop"
                  ? "Drop Sub-Job Completely"
                  : "Put Sub-Job on HOLD"}
              </h3>
              <span className="text-[11px] opacity-75">
                {dialogAction.subJobNo}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDialogAction(null)}
            className="text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-3 text-xs">
          <p className="text-gray-600 leading-relaxed">
            {dialogAction.type === "drop"
              ? "Dropping this sub-job permanently removes it from costing, commercial totals, and production. This cannot be undone."
              : "Holding pauses this sub-job without deleting it. Designers will not work on it and approved sub-jobs can advance to production without waiting."}
          </p>

          <div>
            <label className="block text-gray-700 font-bold mb-1.5">
              Select or enter reason:
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {[
                "Client postponed decision",
                "Budget not cleared",
                "Waiting for quantity confirmation",
                "Design not finalized",
                "Client dropped requirement",
              ].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setDialogReason(r)}
                  className={`text-[10px] px-2.5 py-1 rounded-full border transition cursor-pointer ${
                    dialogReason === r
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={dialogReason}
              onChange={(ev) => setDialogReason(ev.target.value)}
              placeholder="Additional note..."
              className="w-full p-2 border border-gray-200 rounded-lg text-xs outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="p-3 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
          <button
            type="button"
            disabled={isActionLoading}
            onClick={() => setDialogAction(null)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isActionLoading}
            onClick={handleConfirmLifecycleAction}
            className={`px-4 py-1.5 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs ${
              dialogAction.type === "drop"
                ? "bg-rose-600 hover:bg-rose-700"
                : "bg-amber-600 hover:bg-amber-700"
            }`}
          >
            {isActionLoading
              ? "Updating..."
              : dialogAction.type === "drop"
                ? "Confirm Drop"
                : "Confirm HOLD"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubJobLifecycleModal;

