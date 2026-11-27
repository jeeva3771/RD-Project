import React from "react";

/**
 * DeliveryApprovalHistoryModal
 * Displays the historical audit trail of previously approved delivery charges.
 * Shown when user clicks "View Delivery Approval History" in DetailsStep or PackDelivery.
 */
export default function DeliveryApprovalHistoryModal({ isOpen, onClose, history = [] }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">📜</span>
            <div>
              <h3 className="font-extrabold text-sm text-gray-900">
                Delivery Approval History
              </h3>
              <p className="text-[11px] text-gray-500 font-medium">
                Audit trail of previous delivery rate approvals and revisions
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

        {/* Content list */}
        <div className="p-5 max-h-[70vh] overflow-y-auto space-y-4">
          {(!history || history.length === 0) ? (
            <div className="text-center py-8 text-gray-400 text-xs">
              No previous delivery approvals found in history.
            </div>
          ) : (
            history.map((item, idx) => {
              const addr = item.address_snapshot || {};
              const revNum = item.revision || (history.length - idx);
              const approvedDate = item.approved_at
                ? new Date(item.approved_at).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "Approved earlier";
              const invalidatedDate = item.invalidated_at
                ? new Date(item.invalidated_at).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : null;

              return (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-gray-200 bg-slate-50/40 space-y-3 text-xs"
                >
                  {/* Revision tag & Amount */}
                  <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-700">
                        Revision #{revNum}
                      </span>
                      <span className="font-extrabold text-sm text-gray-900">
                        ₹{Number(item.amount || 0).toLocaleString("en-IN")}
                        <span className="text-[10px] font-normal text-gray-500 ml-1">+ 18% GST</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700">
                        {item.carrier || "Tempo"}{item.courier_partner ? ` (${item.courier_partner})` : ""}
                      </span>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.payer === "client"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-purple-100 text-purple-700"
                      }`}
                    >
                      {item.payer === "client" ? "Client pays" : "RD pays"}
                    </span>
                  </div>

                  {/* Address Snapshot that was approved */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                      📍 Approved Delivery Address
                    </span>
                    <div className="font-semibold text-gray-800">
                      {addr.full_address || addr.label || "Customer site address"}
                    </div>
                    {(addr.city || addr.pin) && (
                      <div className="text-[11px] text-gray-500">
                        {addr.city && `${addr.city}, `}
                        {addr.pin && `PIN: ${addr.pin}`}
                      </div>
                    )}
                    {(addr.site_contact || addr.site_phone) && (
                      <div className="text-[11px] text-gray-600 font-medium">
                        Contact: {addr.site_contact || "Site Contact"}
                        {addr.site_phone && ` (${addr.site_phone})`}
                      </div>
                    )}
                  </div>

                  {/* Approval Details */}
                  <div className="pt-2 border-t border-gray-100/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <div className="flex items-center gap-1.5 text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <span>✓</span>
                      <span>Approved via {item.approval_method || "WhatsApp"}</span>
                      <span className="text-gray-400 font-normal">on {approvedDate}</span>
                    </div>

                    {item.approved_by?.user_name && (
                      <div className="text-gray-500">
                        By: <strong className="text-gray-700">{item.approved_by.user_name}</strong>
                      </div>
                    )}
                  </div>

                  {/* Reason for Invalidation / Revision */}
                  <div className="pt-2 border-t border-dashed border-gray-200 text-[11px] text-amber-900 bg-amber-50/60 p-2 rounded-lg flex items-start gap-2">
                    <span className="text-xs">⚠️</span>
                    <div className="space-y-0.5">
                      <div className="font-bold">
                        {item.re_request_reason === "address_change"
                          ? "Re-requested due to Delivery Address Change"
                          : item.re_request_reason === "client_revision"
                          ? "Re-requested due to Client Rate Revision"
                          : "Re-requested for new estimation"}
                      </div>
                      {item.re_request_notes && (
                        <div className="text-gray-600 italic">
                          "{item.re_request_notes}"
                        </div>
                      )}
                      {invalidatedDate && (
                        <div className="text-[10px] text-gray-400">
                          Superseded on: {invalidatedDate}
                          {item.invalidated_by?.user_name ? ` by ${item.invalidated_by.user_name}` : ""}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-xl text-xs font-bold hover:bg-gray-100 transition shadow-2xs cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
