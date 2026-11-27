import React, { useState } from "react";
import { axiosInstance } from "../../../../utils/url/config";
import { toast } from "react-toastify";

const QUICK_CARRIER_OPTIONS = [
  "Porter (3-Wheeler)",
  "Porter (2-Wheeler / Bike)",
  "Local Tempo",
  "V-Trans (Road Freight)",
  "BlueDart Express",
  "DTDC Courier",
  "Air Cargo Express",
  "By Hand Delivery",
];

export default function DeliveryRateModal({ request, onClose, onSuccess }) {
  const [amount, setAmount] = useState(request.delivery_charges?.amount || "");
  const [courierPartner, setCourierPartner] = useState(
    request.delivery_charges?.courier_partner || request.delivery_charges?.carrier || ""
  );
  const [notes, setNotes] = useState(request.delivery_charges?.notes || "");
  const [submitting, setSubmitting] = useState(false);

  if (!request) return null;

  const dc = request.delivery_charges || {};
  const addr = dc.address_snapshot || {};
  const isQuoted = dc.status === "quoted" || dc.status === "client_approved";

  const handleSubmit = async (e) => {
    e.preventDefault();
    const numAmt = Number(amount);
    if (isNaN(numAmt) || numAmt <= 0) {
      toast.error("Please enter a valid positive delivery rate amount (₹)");
      return;
    }

    setSubmitting(true);
    try {
      const res = await axiosInstance.post(
        `/enquiry-flow-integration/${request._id}/submit-delivery-charge`,
        {
          amount: numAmt,
          courier_partner: courierPartner,
          notes,
        }
      );

      if (res.data?.success) {
        toast.success(`Delivery rate ₹${numAmt.toLocaleString("en-IN")} submitted to coordinator!`);
        if (onSuccess) onSuccess();
        onClose();
      } else {
        toast.error(res.data?.message || "Failed to submit rate");
      }
    } catch (err) {
      console.error("Error submitting delivery charge:", err);
      toast.error(err.response?.data?.message || "Failed to submit delivery rate");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-gray-200 animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚚</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  {request.enquiry_no || `RD${request.seq}`}
                </span>
                <span className="font-extrabold text-base">{request.client_name}</span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Delivery Charge Estimation &middot; Requested by {request.coordinator_name || "CS Team"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 text-xs text-slate-700 max-h-[75vh] overflow-y-auto">
          {/* Re-request Notice if applicable */}
          {Boolean(dc.re_request_reason || (dc.approval_history && dc.approval_history.length > 0)) && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 font-extrabold text-amber-950 text-xs">
                <span>🔄</span>
                <span>
                  {dc.re_request_reason === "address_change"
                    ? "Re-request: Delivery Address Changed"
                    : dc.re_request_reason === "client_revision"
                    ? "Re-request: Client Requested Rate Revision"
                    : "Delivery Rate Re-request"}
                </span>
                {dc.approval_history?.[0]?.amount && (
                  <span className="text-[10px] text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded-full font-bold ml-auto">
                    Previous Rate: ₹{Number(dc.approval_history[0].amount).toLocaleString("en-IN")}
                  </span>
                )}
              </div>
              {dc.re_request_notes && (
                <p className="text-[11px] text-amber-900 italic pl-5">
                  Coordinator remarks: &ldquo;{dc.re_request_notes}&rdquo;
                </p>
              )}
            </div>
          )}

          {/* Quick Info Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Carrier Mode</span>
              <span className="font-extrabold text-xs text-slate-900 mt-0.5 flex items-center gap-1">
                {dc.carrier || "Tempo"}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Freight Payer</span>
              <span
                className={`font-bold text-[11px] px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                  dc.payer === "client" ? "bg-amber-100 text-amber-800" : "bg-purple-100 text-purple-700"
                }`}
              >
                {dc.payer === "client" ? "Client pays" : "RD pays"}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Needed By Date</span>
              <span className="font-extrabold text-xs text-slate-900 mt-0.5 block">
                {request.needed_by_date || request.delivery_date || "Not specified"}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Destination Area</span>
              <span className="font-bold text-xs text-slate-800 mt-0.5 block">
                {dc.destination_area || "Local"}
              </span>
            </div>
          </div>

          {/* Delivery Destination Address */}
          <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-base text-rose-500">📍</span>
              <span className="font-bold text-slate-900 text-xs">Destination Delivery Address</span>
            </div>
            <div className="font-medium text-slate-800 text-xs leading-relaxed pl-6">
              {addr.full_address ? (
                <>
                  {addr.label && <div className="font-bold text-slate-900 mb-0.5">{addr.label}</div>}
                  <div>{addr.full_address}</div>
                  <div>
                    {addr.city && `${addr.city}, `}
                    {addr.state && `${addr.state} `}
                    {addr.pin && `- ${addr.pin}`}
                  </div>
                </>
              ) : (
                <div className="text-slate-500 italic">Address details from enquiry: {dc.destination_city || "Local Venue"}</div>
              )}
            </div>

            {(addr.site_contact || addr.site_phone || request.contact_person || request.contact_mobile) && (
              <div className="mt-3 pt-2.5 border-t border-emerald-200/60 flex flex-wrap items-center gap-4 text-[11px] text-slate-600 pl-6">
                <span>
                  <strong>Site Contact:</strong> {addr.site_contact || request.contact_person || "Contact Person"}
                </span>
                {(addr.site_phone || request.contact_mobile) && (
                  <span className="flex items-center gap-1.5 font-bold text-emerald-800">
                    <span>📞</span> {addr.site_phone || request.contact_mobile}
                  </span>
                )}
                {dc.when && (
                  <span className="text-slate-500">
                    &bull; Timing: <strong>{dc.when}</strong>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Products & Packing Specs */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-xs">📦 Items to Pack &amp; Deliver</span>
              <span className="font-bold text-[11px] text-slate-500">
                Total: {request.total_quantity || 1} pcs
              </span>
            </div>
            <div className="divide-y divide-slate-200/60">
              {(request.items || []).map((it, idx) => (
                <div key={idx} className="py-2 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-800">{it.product_name}</span>
                    <span className="text-[11px] text-slate-500 ml-2">({it.size}&quot;)</span>
                  </div>
                  <span className="font-mono font-bold text-slate-900 px-2 py-0.5 bg-white border border-slate-200 rounded">
                    Qty: {it.quantity}
                  </span>
                </div>
              ))}
            </div>
            {request.packaging_summary && (
              <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-500 flex items-center gap-1.5">
                <span className="font-semibold text-slate-700">Packaging Type:</span>
                <span>{request.packaging_summary}</span>
              </div>
            )}
          </div>

          {/* Rate Submission Form */}
          <form onSubmit={handleSubmit} className="space-y-4 pt-2 border-t border-slate-200">
            <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
              <span>💰</span>
              <span>{isQuoted ? "Update Delivery Rate" : "Enter Delivery Charge Quote"}</span>
            </div>

            {/* Rate Input */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Delivery / Freight Amount (₹) <span className="text-rose-500">*</span>
              </label>
              <div className="relative max-w-xs">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">
                  ₹
                </span>
                <input
                  type="number"
                  required
                  autoFocus
                  min="0"
                  step="1"
                  placeholder="e.g. 1500"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-8 pr-4 py-2 text-sm font-extrabold text-slate-900 border-2 border-indigo-500 rounded-xl outline-none focus:ring-2 focus:ring-indigo-300 shadow-2xs"
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Enter net freight charge (GST 18% will be automatically added by CRM on invoice).
              </span>
            </div>

            {/* Transporter / Courier Partner */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Courier / Transporter Name
              </label>
              <input
                type="text"
                placeholder="e.g. Porter, V-Trans, DTDC, Local Tempo"
                value={courierPartner}
                onChange={(e) => setCourierPartner(e.target.value)}
                className="w-full p-2.5 text-xs font-medium text-slate-800 border border-slate-300 rounded-xl outline-none focus:border-indigo-500 bg-white shadow-2xs mb-2"
              />
              <div className="flex flex-wrap gap-1.5">
                {QUICK_CARRIER_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCourierPartner(c)}
                    className={`px-2.5 py-1 text-[10px] font-semibold rounded-lg border transition cursor-pointer ${
                      courierPartner === c
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes / Remarks */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Packing &amp; Transit Remarks (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Approx 2 cartons (16 kg); same day delivery"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl outline-none focus:border-indigo-500 bg-white shadow-2xs"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-extrabold text-xs rounded-xl shadow-md transition cursor-pointer flex items-center gap-2"
              >
                {submitting ? (
                  <span>Saving...</span>
                ) : (
                  <>
                    <span>✓</span>
                    <span>Submit Rate to Coordinator</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
