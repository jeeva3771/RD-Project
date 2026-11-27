import React, { useState } from "react";
import { formatAddress } from "../utils/helpers";

const PublicSampleConfirmationView = ({
  data,
  parentJobNo,
  subjobsParam,
  onSubmitFeedback,
  submitting,
  docSheetRef,
  onOpenImage,
}) => {
  const [revisionNotes, setRevisionNotes] = useState("");
  const [showRevisionModal, setShowRevisionModal] = useState(false);

  const customer = data?.customer || {};
  const contact = data?.contact || {};
  const coordinator_name = data?.coordinator_name || "Account Coordinator";
  const wizard_state = data?.wizard_state || {};
  const delivery_details = data?.delivery_details || {};
  const uploadedDesigns = data?.uploadedDesigns || {};

  const todayStr = new Date(data?.createdAt || Date.now()).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Filter subjobs by target param if present
  const targetSubJobsParam = subjobsParam
    ? subjobsParam.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
    : null;

  const activeSubJobs = (data?.sub_jobs || []).filter((sj) => {
    if (sj.is_dropped || sj.is_on_hold) return false;
    if (targetSubJobsParam && targetSubJobsParam.length > 0) {
      const sjNo = (sj.sub_job_no || "").toUpperCase();
      return targetSubJobsParam.includes(sjNo) || targetSubJobsParam.some((t) => sjNo.endsWith(t));
    }
    return true;
  });

  const formatSubJobNo = (code, idx = 0) => {
    if (!code) return `${parentJobNo}-A${idx + 1}`;
    let str = String(code).trim();
    if (str.startsWith("RD")) return str;
    if (/^\d/.test(str)) return `RD${str}`;
    if (str.startsWith("-")) return `${parentJobNo}${str}`;
    return `RD${str}`;
  };

  // Check if items were pre-saved in wizard_state.sampleItems
  const savedSampleItems = wizard_state?.sampleItems;
  const isFoc = wizard_state?.charge === "foc" || wizard_state?.sampleCharge === "foc";
  const gstRate = Number(wizard_state?.sampleGst || 18);

  let finalizedItems = [];
  if (Array.isArray(savedSampleItems) && savedSampleItems.length > 0) {
    finalizedItems = savedSampleItems.map((it, idx) => ({
      subJobNo: formatSubJobNo(it.subJobNo, idx),
      theme: it.theme || it.name || "Custom Trophy",
      description: it.description || `${it.theme || "Custom Trophy"} · 1 pc`,
      pieces: Number(it.pieces || 1),
      rate: Number(it.rate || it.sampleRate || 0),
    }));
  } else {
    // Generate from active subjobs
    finalizedItems = activeSubJobs.map((sj, idx) => {
      const subCode = formatSubJobNo(sj.sub_job_no, idx);
      const theme = sj.theme || sj.product_name || "Custom Trophy";
      const spec = sj.spec_line || `${sj.theme || sj.product_name || 'Trophy'} · ${sj.size || 8} in`;
      const sRate = Number(sj.sample_rate || (sj.unit_rate ? sj.unit_rate + 200 : (wizard_state?.sampleRate || 0)));
      return {
        subJobNo: subCode,
        theme,
        description: spec,
        pieces: 1,
        rate: sRate,
      };
    });
  }

  if (finalizedItems.length === 0) {
    finalizedItems = [{
      subJobNo: `${parentJobNo}-A1`,
      theme: "Custom Trophy",
      description: "Custom Trophy Sample",
      pieces: 1,
      rate: Number(wizard_state?.sampleRate || 0),
    }];
  }

  // Ensure items match the latest target sample rate if total was updated
  const targetTotal = isFoc ? 0 : Number(wizard_state?.sampleRate || wizard_state?.sampleTotal || 0);
  const totalKnown = finalizedItems.reduce((acc, it) => acc + (it.rate * it.pieces), 0);
  if (!isFoc && targetTotal > 0 && totalKnown > 0 && Math.abs(totalKnown - targetTotal) > 0.05) {
    finalizedItems = finalizedItems.map((it) => ({
      ...it,
      rate: finalizedItems.length === 1
        ? targetTotal
        : Number(((it.rate / totalKnown) * targetTotal).toFixed(2)),
    }));
  }

  // Totals
  let subtotal = 0;
  let totalPieces = 0;
  finalizedItems.forEach((it) => {
    totalPieces += it.pieces;
    if (!isFoc) {
      subtotal += it.rate * it.pieces;
    }
  });

  const gstAmt = isFoc ? 0 : Math.round(subtotal * (gstRate / 100));
  const grandTotal = isFoc ? 0 : (subtotal + gstAmt);

  // Address & Carrier
  const carrierMode = wizard_state?.sampleCarrier || delivery_details?.delivery_mode || "Our vehicle";
  const isPhotoVideoCarrier = Boolean(/photo|video/i.test(carrierMode));
  const rawDeliveryAddress = wizard_state?.sampleShipTo || wizard_state?.shipTo || delivery_details?.shipping_address || customer?.billing || "Client Office / Venue";
  const deliveryAddressStr = isPhotoVideoCarrier
    ? "Digital Review (Photos & Video via WhatsApp / Email)"
    : (formatAddress(rawDeliveryAddress) || "Client Office / Venue");

  // Decision state
  const isApproved = Boolean(
    wizard_state?.sampleConfirmed === true ||
    wizard_state?.sampleRatesState === "approved" ||
    wizard_state?.sampleDecision?.decision === "approved"
  );
  const isRevision = Boolean(
    wizard_state?.sampleRatesState === "revision" ||
    wizard_state?.sampleDecision?.decision === "revision"
  );
  const decisionDetails = wizard_state?.sampleDecision || {};

  return (
    <div
      ref={docSheetRef}
      className="w-full max-w-4xl mx-auto bg-white shadow-2xl p-6 sm:p-12 rounded-2xl border border-gray-200 print:shadow-none print:border-none print:p-0"
    >
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-indigo-600 pb-5 mb-8">
        <div>
          <div className="mb-3">
            <img
              src="https://rdcustomawards.com/cdn/shop/files/logo.svg?v=1700546283&width=90"
              alt="RD Custom Awards Logo"
              className="h-10 sm:h-12 w-auto object-contain"
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            RD Custom Awards Pvt. Ltd.
          </h1>
          <p className="text-xs text-gray-500 mt-1 font-semibold">
            Sample order confirmation
          </p>
        </div>
        <div className="text-right">
          <h2 className="text-xl sm:text-2xl font-black text-indigo-900 tracking-tight">
            {parentJobNo}
          </h2>
          <p className="text-xs font-bold text-gray-600 mt-0.5">
            {finalizedItems.length > 1
              ? `Sub-jobs: ${finalizedItems.map((t) => t.subJobNo).join(", ")}`
              : `Sub-job: ${finalizedItems[0]?.subJobNo}`}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{todayStr}</p>
        </div>
      </div>

      {/* Bill to / Attention / Sample to / By Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-12 text-xs mb-8 pb-6 border-b border-gray-100">
        <div className="grid grid-cols-[80px_1fr] items-start">
          <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Bill to</span>
          <div className="text-gray-900 font-medium leading-relaxed">
            <span className="font-bold text-gray-950 block text-sm">{customer?.name || "Client Name"}</span>
            {formatAddress(customer?.billing || customer?.address) ? (
              <span className="whitespace-pre-line text-gray-600 block mt-0.5">{formatAddress(customer?.billing || customer?.address)}</span>
            ) : null}
            {customer?.gstin && <span className="text-gray-500 block mt-1">GSTIN: {typeof customer.gstin === "object" ? (customer.gstin?.gst_no || "") : customer.gstin}</span>}
          </div>
        </div>
        <div className="grid grid-cols-[80px_1fr] items-start">
          <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Attention</span>
          <div className="text-gray-900 font-medium leading-relaxed">
            <span className="font-bold text-gray-950 block text-sm">{contact?.name || "Client Contact"}</span>
            {contact?.email && <span className="text-gray-600 block mt-0.5">{contact.email}</span>}
            {contact?.mobile && <span className="text-gray-600 block">{contact.mobile}</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-12 text-xs mb-8 pb-6 border-b border-gray-100">
        <div className="grid grid-cols-[80px_1fr] items-start">
          <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Sample to</span>
          <div className="text-gray-900 font-medium leading-relaxed">
            <span className="font-bold text-gray-950 block text-sm">{deliveryAddressStr}</span>
          </div>
        </div>
        <div className="grid grid-cols-[80px_1fr] items-start">
          <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">By</span>
          <div className="text-gray-900 font-medium leading-relaxed">
            <span className="font-bold text-gray-950 block text-sm">{carrierMode}</span>
            <span className="text-gray-500 block mt-0.5">
              {wizard_state?.sampleWhen || "Office hours dispatch"}
            </span>
          </div>
        </div>
      </div>

      {/* Sample Items Table */}
      <h3 className="text-sm font-black text-gray-900 mb-4 uppercase tracking-wider">
        Sample Order Details ({finalizedItems.length} items)
      </h3>
      <div className="border border-gray-200 rounded-xl overflow-hidden mb-8">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="bg-gray-50/70 border-b border-gray-200 text-gray-600 font-bold">
              <th className="py-3 px-4 w-36">Sub-job No</th>
              <th className="py-3 px-4">Item</th>
              <th className="py-3 px-4 text-center w-24">Pieces</th>
              <th className="py-3 px-4 text-right w-40">Rate (taxable)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {finalizedItems.map((item, idx) => {
              // Try to find image from uploadedDesigns
              const matchGroup = String(item.subJobNo || "").match(/[-_]([A-Za-z])\d*$/);
              const gChar = matchGroup ? matchGroup[1].toUpperCase() : "A";
              const gIdx = gChar.charCodeAt(0) - 65;
              const imgUrl = uploadedDesigns[`${gIdx}-0`] || uploadedDesigns[`${idx}-0`] || Object.values(uploadedDesigns)[0] || null;

              const rateFormatted = isFoc
                ? "Free of cost"
                : `Chargeable · ₹${Number(item.rate).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

              return (
                <tr key={item.subJobNo || idx} className="hover:bg-gray-50/40 transition">
                  <td className="py-4 px-4 align-top font-bold text-gray-900">
                    {item.subJobNo}
                  </td>
                  <td className="py-4 px-4 align-top">
                    <div className="flex items-start gap-3">
                      {imgUrl && (
                        <div
                          onClick={() => onOpenImage && onOpenImage(imgUrl)}
                          className="w-12 h-12 rounded-lg border border-gray-200 overflow-hidden bg-white shrink-0 p-0.5 cursor-pointer hover:border-indigo-500 transition"
                          title="Click to view full image"
                        >
                          <img
                            src={imgUrl}
                            alt={item.theme}
                            className="w-full h-full object-cover rounded-md"
                          />
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-gray-950 text-sm mb-0.5">
                          {item.theme}
                        </div>
                        <div className="text-[11px] text-gray-500 leading-tight">
                          {item.description}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center align-top font-semibold text-gray-800">
                    {item.pieces}
                  </td>
                  <td className="py-4 px-4 text-right align-top font-bold text-gray-900 whitespace-nowrap">
                    {rateFormatted}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-gray-50/50 font-bold">
              <td colSpan="2" className="py-3 px-4 text-right text-gray-600 uppercase text-[11px] tracking-wider">
                Subtotal (taxable):
              </td>
              <td className="py-3 px-4 text-center text-gray-900 font-extrabold">
                {totalPieces}
              </td>
              <td className="py-3 px-4 text-right text-gray-900 font-bold whitespace-nowrap">
                {isFoc ? "₹0.00" : `₹${subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </td>
            </tr>
            <tr className="border-t border-gray-100 bg-gray-50/50 font-bold">
              <td colSpan="3" className="py-2.5 px-4 text-right text-gray-600 uppercase text-[11px] tracking-wider">
                GST @ {gstRate}%:
              </td>
              <td className="py-2.5 px-4 text-right text-gray-900 font-bold whitespace-nowrap">
                {isFoc ? "₹0.00" : `₹${gstAmt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </td>
            </tr>
            <tr className="border-t-2 border-indigo-200 bg-indigo-50/70 font-extrabold text-indigo-950">
              <td colSpan="3" className="py-4 px-4 text-right text-sm uppercase tracking-wider font-black">
                TOTAL SAMPLE ORDER ({finalizedItems.length} ITEMS · {totalPieces} PCS):
              </td>
              <td className="py-4 px-4 text-right text-base font-black text-indigo-900 whitespace-nowrap">
                {isFoc ? "Free of cost (₹0.00)" : `₹${grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Decision Banner: Approved */}
      {isApproved && (
        <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-emerald-950 flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
              ✓
            </span>
            <div>
              <span className="block text-sm font-black text-emerald-950">
                Sample Order & Rates Confirmed
              </span>
              <span className="text-xs text-emerald-800">
                Order acceptance recorded {decisionDetails.at ? `on ${new Date(decisionDetails.at).toLocaleDateString("en-GB")}` : ""}{decisionDetails.by ? ` by "${decisionDetails.by}"` : ""}
              </span>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-200 text-emerald-900 text-xs font-black uppercase">
            CONFIRMED
          </span>
        </div>
      )}

      {/* Decision Banner: Revision */}
      {isRevision && (
        <div className="p-5 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 mb-8 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 font-bold text-xs text-amber-900">
              <span className="text-base">⚠️</span>
              <span className="text-sm font-black">Alterations Requested on Sample Order</span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[10px] font-black uppercase">
              Pending Coordinator Update
            </span>
          </div>
          <p className="text-xs text-amber-900 font-semibold italic bg-amber-100/60 p-2.5 rounded-xl border border-amber-200/80 mb-2.5">
            "{decisionDetails.notes || "Client requested alterations to sample specifications or pricing."}"
          </p>
          <p className="text-[11px] text-amber-800 leading-relaxed">
            Your change request has been submitted to RD Custom Awards. Our team is updating the sample specifications and rates. You will receive an updated confirmation link shortly once revised rates are shared.
          </p>
        </div>
      )}

      {/* Client Action Buttons (only if pending approval and no revision is active) */}
      {!isApproved && !isRevision && (
        <div className="p-5 sm:p-6 bg-gradient-to-br from-indigo-50/70 via-white to-slate-50 border-2 border-indigo-200 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden mb-8">
          <div className="space-y-1">
            <h4 className="text-sm font-black uppercase tracking-wider text-slate-900">
              Confirm Sample Order
            </h4>
            <p className="text-xs text-slate-600">
              Approve sample specifications & rates to initiate sampling on the shop floor.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              disabled={submitting}
              onClick={() => onSubmitFeedback("approved")}
              className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <span>✓</span>
              <span>{submitting ? "Confirming..." : "Approve & Confirm Sample Order"}</span>
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => setShowRevisionModal(true)}
              className="px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <span>✏️</span>
              <span>Request Changes</span>
            </button>
          </div>
        </div>
      )}

      {/* Revision Modal */}
      {showRevisionModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-black text-gray-900">
              Request Alterations on Sample Order
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Please specify the required changes or feedback for your account coordinator.
            </p>
            <textarea
              rows={4}
              value={revisionNotes}
              onChange={(e) => setRevisionNotes(e.target.value)}
              placeholder="e.g. Please update sample dimensions to 10 inches, or revise delivery address..."
              className="w-full border border-gray-300 rounded-xl p-3 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRevisionModal(false)}
                className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting || !revisionNotes.trim()}
                onClick={() => {
                  onSubmitFeedback("revision", revisionNotes.trim());
                  setShowRevisionModal(false);
                }}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Signatures */}
      <div className="pt-6 border-t border-gray-200">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div className="border-t border-gray-400 pt-2 text-[10px] text-gray-500 font-semibold">
            For RD Custom Awards Pvt. Ltd.
          </div>
          <div className="border-t border-gray-400 pt-2 text-[10px] text-gray-500 font-semibold">
            {coordinator_name}, Dispatch & Servicing
          </div>
          <div className="border-t border-gray-400 pt-2 text-[10px] text-gray-500 font-semibold">
            Client Acceptance & Date
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicSampleConfirmationView;
