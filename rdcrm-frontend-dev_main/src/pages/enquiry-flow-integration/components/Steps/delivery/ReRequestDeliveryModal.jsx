import React, { useState } from "react";

/**
 * ReRequestDeliveryModal
 * Confirms re-requesting delivery rate from Packing Team due to Address Change or Client Revision.
 * Informs user that current approval will be archived and invalidated.
 */
export default function ReRequestDeliveryModal({
  isOpen,
  onClose,
  onConfirm,
  currentAmount = 0,
  oldAddress = "",
  newAddress = "",
  defaultReason = "address_change",
}) {
  const [reason, setReason] = useState(defaultReason);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onConfirm({ reason, notes });
      onClose();
    } catch (err) {
      console.error("Re-request submission error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-amber-50/50">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🚚</span>
              <div>
                <h3 className="font-extrabold text-sm text-gray-900">
                  Re-request Delivery Rate
                </h3>
                <p className="text-[11px] text-gray-500 font-medium">
                  Dispatch new freight estimation request to Packing Team
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 rounded-lg text-xs transition cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4 text-xs">
            {/* Warning Banner */}
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
              <div className="font-extrabold text-amber-950 flex items-center gap-1.5">
                <span>⚠️</span>
                <span>Existing Approval Invalidation Notice</span>
              </div>
              <p className="text-[11px] text-amber-900 leading-relaxed">
                The current rate (<strong>₹{Number(currentAmount).toLocaleString("en-IN")}</strong>) was approved for the previous configuration. Sending this re-request will <strong>archive it to History</strong>. Once the Packing team submits the updated rate, <strong>fresh approval must be obtained</strong>.
              </p>
            </div>

            {/* Address comparison if address changed */}
            {(oldAddress || newAddress) && (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                {oldAddress && (
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                      Previous Approved Address:
                    </span>
                    <span className="text-gray-700 font-medium">{oldAddress}</span>
                  </div>
                )}
                {newAddress && (
                  <div className="pt-1 border-t border-gray-200/60">
                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">
                      New Destination Address:
                    </span>
                    <span className="text-gray-900 font-bold">{newAddress}</span>
                  </div>
                )}
              </div>
            )}

            {/* Reason selection */}
            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1">
                Reason for Re-request
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setReason("address_change")}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                    reason === "address_change"
                      ? "border-indigo-600 bg-indigo-50/50 text-indigo-950 font-bold shadow-2xs"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <div className="text-xs">📍 Address Changed</div>
                  <div className="text-[10px] text-gray-400 font-normal mt-0.5">
                    Destination or site address modified
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setReason("client_revision")}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                    reason === "client_revision"
                      ? "border-indigo-600 bg-indigo-50/50 text-indigo-950 font-bold shadow-2xs"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <div className="text-xs">💬 Client Requested Changes</div>
                  <div className="text-[10px] text-gray-400 font-normal mt-0.5">
                    Rate negotiation or partner change
                  </div>
                </button>
              </div>
            </div>

            {/* Remarks / Notes for Packing team */}
            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1">
                Remarks / Instructions for Packing Team
              </label>
              <textarea
                rows={3}
                placeholder={
                  reason === "client_revision"
                    ? "e.g. Client requested lower freight rate or surface cargo instead of air"
                    : "e.g. Venue changed to Lonavala, please re-calculate Tempo charges"
                }
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-2.5 text-xs border border-gray-200 rounded-xl outline-none focus:border-indigo-500 transition resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-xl text-xs font-bold hover:bg-gray-100 transition shadow-2xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-amber-950 text-xs font-extrabold rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <span>🚚</span>
              <span>{submitting ? "Sending..." : "Send Re-request to Packing"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
