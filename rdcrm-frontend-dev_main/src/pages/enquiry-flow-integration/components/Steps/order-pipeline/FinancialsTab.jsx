import React from "react";
import { inr, dfmt, todayISO, deriveDocNo, formatEnquiryNo } from "../../../utils/helpers";
import CommunicationLogForm from "../../common/CommunicationLogForm";
import ApprovalHistoryProof from "../../common/ApprovalHistoryProof";

const FinancialsTab = ({
  s,
  set,
  items,
  client,
  ids,
  totalAmountBeforeGst,
  effectiveAdv,
  prodGst,
  setProdGst,
  adjustSampleCharges,
  setAdjustSampleCharges,
  advFormMode,
  setAdvFormMode,
  rcptAmount,
  setRcptAmount,
  rcptDate,
  setRcptDate,
  rcptMode,
  setRcptMode,
  rcptRef,
  setRcptRef,
  rcptFrom,
  setRcptFrom,
  rcptInto,
  setRcptInto,
  otwAmount,
  setOtwAmount,
  otwFrom,
  setOtwFrom,
  otwMode,
  setOtwMode,
  otwExpectedBy,
  setOtwExpectedBy,
  otwExpectedDate,
  setOtwExpectedDate,
  otwRef,
  setOtwRef,
  otwNote,
  setOtwNote,
  otwHoldProduction,
  setOtwHoldProduction,
  capCost,
  setCapCost,
  autoReminderMode,
  setAutoReminderMode,
  setShowProformaModal,
  setShowReminderModal,
  setSub,
  setEditingRateId,
  setEditingRateVal,
  setEditingReasonVal,
  setRateNegotiateBanner,
  handleRequestPI,
  requestingPI,
  hasChargedSample = false,
  totalSampleCharge = 0,
  sampleQtyVal = 1,
  sampleRatePerUnit = 0,
}) => {
  const isSampleMode = s.mode === "sample";
  const sampleV1Adjusted = isSampleMode ? Number(s.sampleV1Adjusted || 0) : 0;
  const sampleV2Adjusted = isSampleMode ? Number(s.sampleV2Adjusted || 0) : 0;
  const totalSampleAdjusted = (adjustSampleCharges && isSampleMode)
    ? sampleV1Adjusted + sampleV2Adjusted
    : 0;

  const finTaxableValue = Math.max(0, totalAmountBeforeGst - totalSampleAdjusted);
  const finGstRate = prodGst || 18;
  const finHalfRate = finGstRate / 2;
  const finCgst = Math.round(finTaxableValue * (finHalfRate / 100));
  const finSgst = Math.round(finTaxableValue * (finHalfRate / 100));
  const totalGst = Math.round(finTaxableValue * (finGstRate / 100));
  const finInvoiceTotal = finTaxableValue + totalGst;

  const finAdvanceDue = effectiveAdv;
  const finBalanceDue = Math.max(0, finInvoiceTotal - finAdvanceDue);

  const sampleV1Invoice = isSampleMode ? Number(s.sampleV1Invoice || s.sampleInvoices?.[0]?.amount || 0) : 0;
  const sampleV2Invoice = isSampleMode ? Number(s.sampleV2Invoice || s.sampleInvoices?.[1]?.amount || 0) : 0;
  const totalSampleInvoices = sampleV1Invoice + sampleV2Invoice;
  const finTotalJobValue = finInvoiceTotal + totalSampleInvoices;

  const isPiUploaded = Boolean(s.pi?.file_url);
  const isPiSent = Boolean(s.pi?.sent || s.pi?.sent_at);
  const isPiApproved = Boolean(s.costOk || s.piApproved || s.clientApproved || s.wizard_state?.costOk || s.wizard_state?.piApproved);
  const isPiReadyForNext = isPiSent && isPiApproved;

  return (
    <div className="space-y-6 text-xs">
      {/* Top Controls Bar: GST on production & Adjust sample charges */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 border border-gray-200 rounded-2xl bg-white shadow-2xs">
        {/* GST on production */}
        <div>
          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
            GST on production
          </label>
          <div className="inline-flex rounded-xl border border-gray-200 p-0.5 bg-gray-50">
            <button
              type="button"
              onClick={() => {
                setProdGst(5);
                set({ prodGst: 5 });
              }}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                prodGst === 5
                  ? "bg-white text-indigo-700 shadow-2xs border border-gray-200"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              5%
            </button>
            <button
              type="button"
              onClick={() => {
                setProdGst(18);
                set({ prodGst: 18 });
              }}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                prodGst === 18
                  ? "bg-white text-indigo-700 shadow-2xs border border-gray-200"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              18%
            </button>
          </div>
        </div>

        {/* Adjust sample charges toggle switch - only relevant in sample mode with sample charges */}
        {isSampleMode && (sampleV1Adjusted > 0 || sampleV2Adjusted > 0) && (
          <div className="flex-1 max-w-md border border-gray-200 rounded-xl p-3 bg-white flex items-center gap-3.5 shadow-2xs">
            <button
              type="button"
              onClick={() => {
                const next = !adjustSampleCharges;
                setAdjustSampleCharges(next);
                set({ relAdjust: next });
              }}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                adjustSampleCharges ? "bg-indigo-600" : "bg-gray-200"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  adjustSampleCharges ? "transform translate-x-5" : ""
                }`}
              />
            </button>
            <div>
              <div className="font-bold text-xs text-gray-900">
                Adjust sample charges against this order
              </div>
              <div className="text-[11px] text-gray-500">
                {adjustSampleCharges
                  ? "Sample taxable value is deducted from the production invoice"
                  : "Sample invoices stand on their own"}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Financial Statement Detailed Table */}
      <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-2xs">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/70 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              <th className="py-2.5 px-4 font-semibold">DESCRIPTION</th>
              <th className="py-2.5 px-4 text-right font-semibold">AMOUNT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {items.map((it, idx) => (
              <tr key={it.id || idx}>
                <td className="py-3.5 px-4 align-top">
                  <div className="font-bold text-gray-900 text-xs">
                    {idx + 1}. {it.theme}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    {it.desc} · {it.qty} pcs × {inr(it.rate)}
                  </div>
                </td>
                <td className="py-3.5 px-4 text-right align-top font-bold text-gray-900 whitespace-nowrap">
                  {inr(Number(it.qty) * Number(it.rate))}
                </td>
              </tr>
            ))}

            {hasChargedSample && totalSampleCharge > 0 && (
              <tr className="bg-amber-50/60 border-t border-amber-200">
                <td className="py-3.5 px-4 align-top">
                  <div className="font-bold text-amber-950 text-xs flex items-center gap-2">
                    <span>🏆</span>
                    <span>Pre-Production Sample Charges</span>
                    <span className="text-[10px] bg-amber-200/90 text-amber-900 px-1.5 py-0.5 rounded font-bold">Sample Completed</span>
                  </div>
                  <div className="text-[11px] text-amber-800 mt-0.5 font-medium">
                    Pre-production sample run: {sampleQtyVal} pcs × {inr(sampleRatePerUnit)} (taxable)
                  </div>
                </td>
                <td className="py-3.5 px-4 text-right align-top font-bold text-amber-950 whitespace-nowrap">
                  {inr(totalSampleCharge)}
                </td>
              </tr>
            )}

            {adjustSampleCharges && (
              <>
                <tr className="text-emerald-700 bg-emerald-50/30">
                  <td className="py-2.5 px-4">
                    <span className="font-bold">Less: sample v1 charge adjusted</span>
                    <div className="text-[10px] text-emerald-600">
                      2 pc × ₹6,980 · taxable value
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-right font-bold whitespace-nowrap">
                    − {inr(sampleV1Adjusted)}
                  </td>
                </tr>
                <tr className="text-emerald-700 bg-emerald-50/30">
                  <td className="py-2.5 px-4">
                    <span className="font-bold">Less: sample v2 charge adjusted</span>
                    <div className="text-[10px] text-emerald-600">
                      1 pc × ₹6,980 incl. GST · taxable value
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-right font-bold whitespace-nowrap">
                    − {inr(sampleV2Adjusted)}
                  </td>
                </tr>
              </>
            )}

            <tr className="border-t border-gray-200">
              <td className="py-2.5 px-4 text-gray-800 font-bold">Taxable value</td>
              <td className="py-2.5 px-4 text-right font-bold text-gray-900 whitespace-nowrap">
                {inr(finTaxableValue)}
              </td>
            </tr>

            <tr>
              <td className="py-1.5 px-4 text-gray-600 font-medium">
                CGST @ {finHalfRate}%
              </td>
              <td className="py-1.5 px-4 text-right text-gray-900 whitespace-nowrap font-medium">
                {inr(finCgst)}
              </td>
            </tr>

            <tr>
              <td className="py-1.5 px-4 text-gray-600">
                <div className="font-medium">SGST @ {finHalfRate}%</div>
                <div className="text-[10px] text-gray-400">
                  Place of supply: {client?.state || "Maharashtra"} (27)
                </div>
              </td>
              <td className="py-1.5 px-4 text-right text-gray-900 whitespace-nowrap font-medium align-top">
                {inr(finSgst)}
              </td>
            </tr>

            <tr className="border-t-2 border-indigo-100 bg-indigo-50/30">
              <td className="py-3 px-4 font-black text-sm text-indigo-900">
                Invoice total
              </td>
              <td className="py-3 px-4 text-right font-black text-sm text-indigo-900 whitespace-nowrap">
                {inr(finInvoiceTotal)}
              </td>
            </tr>

            <tr>
              <td className="py-2 px-4">
                <span className="font-bold text-gray-800">Advance due now</span>
                <div className="text-[10px] text-gray-400">
                  Amount agreed with the client
                </div>
              </td>
              <td className="py-2 px-4 text-right font-bold text-gray-900 whitespace-nowrap">
                {inr(finAdvanceDue)}
              </td>
            </tr>

            <tr className="border-t border-gray-100">
              <td className="py-2.5 px-4 font-bold text-gray-800">
                Balance due before dispatch
              </td>
              <td className="py-2.5 px-4 text-right font-bold text-gray-900 whitespace-nowrap">
                {inr(finBalanceDue)}
              </td>
            </tr>

            {/* BILLED SEPARATELY - only shown when sample invoices exist in sample mode */}
            {isSampleMode && totalSampleInvoices > 0 && (
              <>
                <tr className="bg-gray-50/80 border-t border-gray-200">
                  <td
                    colSpan={2}
                    className="py-2 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider"
                  >
                    BILLED SEPARATELY
                  </td>
                </tr>

                {sampleV1Invoice > 0 && (
                  <tr>
                    <td className="py-2.5 px-4">
                      <span className="font-semibold text-gray-800">Sample v1 invoice</span>
                      <div className="text-[10px] text-gray-400">
                        {adjustSampleCharges && "· taxable value adjusted above"}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-right font-medium text-gray-800 whitespace-nowrap">
                      {inr(sampleV1Invoice)}
                    </td>
                  </tr>
                )}

                {sampleV2Invoice > 0 && (
                  <tr>
                    <td className="py-2.5 px-4">
                      <span className="font-semibold text-gray-800">Sample v2 invoice</span>
                      <div className="text-[10px] text-gray-400">
                        {adjustSampleCharges && "· taxable value adjusted above"}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-right font-medium text-gray-800 whitespace-nowrap">
                      {inr(sampleV2Invoice)}
                    </td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Total job value incl. GST */}
      <div className="bg-[#EEF2FF] border border-indigo-100 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-2xs">
        <div>
          <div className="font-bold text-xs text-indigo-950">
            Total job value incl. GST
          </div>
          <div className="text-[10px] text-indigo-700/70">
            {totalSampleInvoices > 0 ? "Invoice total + sample invoices" : "Final invoice total"}
          </div>
        </div>
        <div className="text-base sm:text-xl font-black text-indigo-900">
          {inr(finTotalJobValue)}
        </div>
      </div>

      {/* Close the financials in three ticks */}
      <div className="space-y-3 pt-2">
        <h4 className="font-bold text-xs text-gray-800">
          Close the financials in three ticks:
        </h4>

        {/* Tick 1: Quotation & proforma */}
        <div
          className={`p-4 rounded-2xl border transition shadow-2xs ${
            s.pi?.sent
              ? "bg-emerald-50/60 border-emerald-200"
              : s.pi?.file_url
              ? "bg-emerald-50/40 border-emerald-300"
              : s.pi?.status === "requested"
              ? "bg-amber-50/40 border-amber-300"
              : "bg-white border-gray-200"
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                  s.pi?.sent
                    ? "bg-emerald-500 text-white"
                    : s.pi?.file_url
                    ? "bg-emerald-600 text-white"
                    : s.pi?.status === "requested"
                    ? "bg-amber-500 text-white"
                    : "bg-gray-100 text-gray-600 border border-gray-300"
                }`}
              >
                {s.pi?.sent ? "✓" : s.pi?.file_url ? "📄" : s.pi?.status === "requested" ? "⏳" : "1"}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <b className="text-xs font-bold text-gray-900">
                    {s.pi?.file_url
                      ? "Official Proforma Invoice (Ready)"
                      : s.pi?.status === "requested"
                      ? "Official Proforma Invoice (Requested)"
                      : "Request Official Proforma Invoice"}
                  </b>
                  {s.pi?.status === "requested" && !s.pi?.file_url && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                      🟡 Pending Accounts Upload
                    </span>
                  )}
                  {s.pi?.file_url && !s.pi?.sent && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                      🟢 Official PDF Uploaded
                    </span>
                  )}
                  {s.pi?.sent && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                      ✓ Sent via {s.pi.sent}
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                  {s.pi?.sent
                    ? `${s.pi.no || ids.pi || "PI Document"} · sent via ${s.pi.sent} on ${
                        s.pi.sent_at ? dfmt(s.pi.sent_at) : todayISO()
                      }. Ready for client confirmation.`
                    : s.pi?.file_url
                    ? `Official PI (${s.pi.no || s.pi.file_name || "PI.pdf"}) uploaded by Accounts (${
                        s.pi.uploaded_by || "Accounts Desk"
                      }). Review PDF and share with client.`
                    : s.pi?.status === "requested"
                    ? `Order snapshot sent to Accounts Desk on ${
                        s.pi.requested_at ? dfmt(s.pi.requested_at) : todayISO()
                      }. Waiting for Accounts person to upload official Tally/ERP PDF.`
                    : "Official PIs with tax serial numbers, GST breakdown and bank QR are issued by Accounts Desk (/accounts). Request PI to proceed."}
                </p>

                {/* Sub-actions */}
                <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px]">
                  {s.pi?.file_url && (
                    <a
                      href={s.pi.signed_file_url || s.pi.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-emerald-700 hover:text-emerald-900 underline underline-offset-2 flex items-center gap-1"
                    >
                      <span>📄 View Official PI PDF</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowProformaModal(true)}
                    className="font-bold text-indigo-600 hover:text-indigo-800 underline underline-offset-2 cursor-pointer"
                  >
                    {s.pi?.sent ? "Open or resend" : "View Commercial Breakdown"}
                  </button>
                  {s.pi?.status === "requested" && !s.pi?.file_url && (
                    <span className="text-gray-400">· Order is queued in /accounts</span>
                  )}
                </div>
              </div>
            </div>

            {/* Main Action Buttons */}
            <div className="shrink-0 flex items-center gap-2 self-start sm:self-center">
              {!s.pi?.status && !s.pi?.file_url && (
                <button
                  type="button"
                  disabled={requestingPI}
                  onClick={handleRequestPI}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer text-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  {requestingPI ? "Requesting..." : "📤 Request PI from Accounts"}
                </button>
              )}

              {s.pi?.status === "requested" && !s.pi?.file_url && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowProformaModal(true)}
                    className="px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold rounded-xl border border-amber-300 transition cursor-pointer text-xs flex items-center gap-1.5"
                  >
                    👁️ Review Snapshot
                  </button>
                  <button
                    type="button"
                    disabled={requestingPI}
                    onClick={handleRequestPI}
                    title="Re-sync current commercial breakdown to Accounts Desk"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer text-xs flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {requestingPI ? "Syncing..." : "🔄 Re-sync to Accounts"}
                  </button>
                </>
              )}

              {s.pi?.file_url && !s.pi?.sent && (
                <button
                  type="button"
                  onClick={() => setShowProformaModal(true)}
                  className="px-4 py-2 bg-[#009b66] hover:bg-[#008256] text-white font-bold rounded-xl shadow-xs transition cursor-pointer text-xs flex items-center gap-1.5"
                >
                  📤 Share PI with Client
                </button>
              )}

              {s.pi?.sent && (
                <button
                  type="button"
                  onClick={() => setShowProformaModal(true)}
                  className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg text-xs transition cursor-pointer"
                >
                  Resend
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tick 2: Client approves */}
        <div
          className={`p-4 rounded-2xl border transition shadow-2xs ${
            s.costOk
              ? "bg-emerald-50/60 border-emerald-200"
              : "bg-white border-gray-200"
          }`}
        >
          <div className="flex items-start gap-3">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                s.costOk
                  ? "bg-emerald-500 text-white"
                  : "bg-gray-100 text-gray-600 border border-gray-300"
              }`}
            >
              {s.costOk ? "✓" : "2"}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-3">
                <b className="block text-xs font-bold text-gray-900">
                  Client approves
                </b>
                {s.costOk && (
                  <span className="text-xs font-bold text-emerald-700 shrink-0">
                    Approved ✓
                  </span>
                )}
              </div>
              {s.costOk ? (
                <div className="mt-2 pt-2 border-t border-emerald-200/60">
                  <ApprovalHistoryProof
                    type="pi"
                    title="Quotation & proforma approved"
                    data={s.costOk}
                    s={s}
                    client={client}
                    docNo={s.pi?.no || deriveDocNo(s?.seq ? formatEnquiryNo(s.seq) : (ids?.enq || ids?.id || "RD26004"), "PI")}
                    docLabel="Proforma Invoice"
                    defaultOpen={true}
                    collapsible={true}
                  />
                  {!capCost && (
                    <div className="mt-2.5 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCapCost(true)}
                        className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
                      >
                        Update approval log / change proof
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Log how they said yes: WhatsApp, email, verbal or PO.
                </p>
              )}

              {!s.costOk && !capCost && (
                <>
                  <div className="flex flex-wrap items-center gap-2.5 mt-3">
                    <button
                      type="button"
                      disabled={!isPiUploaded}
                      title={
                        !isPiUploaded
                          ? s.pi?.status === "requested"
                            ? "Waiting for Accounts person to upload official PI PDF"
                            : "Please request official PI from Accounts first"
                          : "Log client approval"
                      }
                      className={`px-5 py-2.5 font-bold rounded-xl shadow-2xs transition text-xs flex items-center gap-1.5 ${
                        !isPiUploaded
                          ? "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed opacity-80"
                          : "bg-[#009b66] hover:bg-[#008256] text-white cursor-pointer"
                      }`}
                      onClick={() => {
                        if (isPiUploaded) setCapCost(true);
                      }}
                    >
                      {!isPiUploaded && <span className="text-gray-400">🔒</span>}
                      Client approved
                    </button>
                    <button
                      type="button"
                      className="px-5 py-2.5 bg-[#f4f3fb] hover:bg-[#eae8f7] text-[#4b4376] border border-[#e2dff0] font-bold rounded-xl shadow-2xs transition cursor-pointer text-xs"
                      onClick={() => {
                        setSub(0);
                        if (items[0]) {
                          setEditingRateId(items[0].id);
                          setEditingRateVal(items[0].rate);
                          setEditingReasonVal("Client negotiated a better rate");
                        }
                        setRateNegotiateBanner(true);
                      }}
                    >
                      Wants a better rate · back to Costing
                    </button>
                  </div>

                  {!isPiUploaded && (
                    <p className="text-[11px] text-amber-700 font-medium mt-2 flex items-center gap-1.5">
                      <span className="shrink-0 text-xs">🔒</span>
                      <span>
                        {s.pi?.status === "requested"
                          ? "Client approval is locked until Accounts team uploads the official PI PDF."
                          : "Client approval is locked. Please request the official PI from Accounts above first."}
                      </span>
                    </p>
                  )}
                </>
              )}

              {capCost && (
                <div className="mt-3">
                  <CommunicationLogForm
                    client={client}
                    mode="order"
                    feedbackMode="approve"
                    hideCard={false}
                    title={`Approved at ₹${Number(
                      items[0]?.rate || s.fc?.rate || 0
                    ).toLocaleString("en-IN")}/pc? How did the client confirm?`}
                    subTitle="Record how the client said yes, so there's proof on the job if anything is questioned later."
                    buttonText="Log approval"
                    buttonHint="Paste their message or add a screenshot."
                    amount={items[0]?.rate || s.fc?.rate || 0}
                    onBack={() => setCapCost(false)}
                    onLog={(logData) => {
                      set({
                        costOk: {
                          ...logData,
                          logged_by: logData.logged_by || s.coordinator || "Client Servicing",
                          approval_type: "cs_logged",
                        },
                        piApproved: true,
                        clientApproved: true,
                      });
                      setCapCost(false);
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tick 3: Advance */}
        <div
          className={`p-4 rounded-2xl border transition shadow-2xs ${
            s.rcpt
              ? "bg-emerald-50/60 border-emerald-200"
              : "bg-white border-gray-200"
          }`}
        >
          <div className="flex items-start gap-3">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                s.rcpt
                  ? "bg-emerald-500 text-white"
                  : s.advFollow || s.advLater
                  ? "bg-amber-500 text-white tracking-widest text-[9px]"
                  : "bg-gray-100 text-gray-600 border border-gray-300"
              }`}
            >
              {s.rcpt ? "✓" : s.advFollow || s.advLater ? "···" : "3"}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-3">
                <b className="block text-xs font-bold text-gray-900">
                  Advance {inr(finAdvanceDue)}{" "}
                  <span className="text-gray-400 font-normal text-[11px] bg-gray-100 px-1.5 py-0.5 rounded-full ml-1">
                    optional
                  </span>
                </b>
                {s.rcpt && (
                  <span className="text-xs font-bold text-emerald-700 shrink-0">
                    Settled ✓
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {s.rcpt
                  ? `${inr(s.rcpt.amount)} received (${s.rcpt.mode || "NEFT"} · ${dfmt(
                      s.rcpt.date || todayISO()
                    )}${s.rcpt.into ? " · " + s.rcpt.into : ""})`
                  : s.advFollow || s.advLater
                  ? `${inr(
                      finAdvanceDue
                    )} to follow. Production isn't held for it; record it when it arrives.`
                  : "Amount agreed with the client. Record it now, or go ahead and record it when it arrives."}
              </p>

              {/* Buttons when no form is open */}
              {!s.rcpt && advFormMode === null && (
                <div className="flex flex-wrap items-center gap-2.5 mt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setRcptAmount(finAdvanceDue);
                      setAdvFormMode("record");
                    }}
                    className={`px-5 py-2.5 font-bold rounded-xl shadow-2xs transition cursor-pointer text-xs ${
                      !s.advFollow && !s.advLater
                        ? "bg-amber-400 hover:bg-amber-500 text-amber-950"
                        : "bg-white hover:bg-gray-50 text-gray-700 border border-gray-200"
                    }`}
                  >
                    Record advance received
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOtwAmount(finAdvanceDue);
                      setAdvFormMode("on_the_way");
                    }}
                    className="px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-bold rounded-xl shadow-2xs transition cursor-pointer text-xs"
                  >
                    Advance on the way
                  </button>
                  {!s.advFollow && !s.advLater && (
                    <button
                      type="button"
                      onClick={() => {
                        set({ advFollow: true, advLater: true });
                        setAdvFormMode(null);
                      }}
                      className="px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-bold rounded-xl shadow-2xs transition cursor-pointer text-xs"
                    >
                      Proceed, advance to follow
                    </button>
                  )}
                </div>
              )}

              {/* FORM 1: Record Advance Received */}
              {advFormMode === "record" && (
                <div className="space-y-4 pt-3 mt-3 border-t border-gray-100">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-gray-700 mb-1.5 block">
                        Amount received
                      </label>
                      <div className="flex">
                        <span className="px-3 py-2 text-xs border border-r-0 border-gray-200 rounded-l-xl bg-gray-50 text-gray-500 font-bold">
                          ₹
                        </span>
                        <input
                          type="number"
                          className="w-full p-2 text-xs border border-gray-200 rounded-r-xl bg-white font-bold outline-none"
                          value={rcptAmount}
                          onChange={(e) => setRcptAmount(Number(e.target.value))}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-gray-700 mb-1.5 block">
                        Date received
                      </label>
                      <input
                        type="date"
                        className="w-full p-2 text-xs border border-gray-200 rounded-xl bg-white outline-none"
                        value={rcptDate}
                        onChange={(e) => setRcptDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-gray-700 mb-1.5 block">
                      Mode
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {["NEFT", "RTGS", "IMPS", "UPI", "Cheque", "Cash"].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setRcptMode(m)}
                          className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                            rcptMode === m
                              ? "bg-[#2815f5] text-white shadow-2xs"
                              : "bg-white text-gray-700 border border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-gray-700 mb-1.5 block">
                        UTR / transaction ref
                      </label>
                      <input
                        type="text"
                        className="w-full p-2 text-xs border border-gray-200 rounded-xl bg-white outline-none"
                        value={rcptRef}
                        onChange={(e) => setRcptRef(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-gray-700 mb-1.5 block">
                        Received from
                      </label>
                      <input
                        type="text"
                        className="w-full p-2 text-xs border border-gray-200 rounded-xl bg-white outline-none"
                        value={rcptFrom}
                        onChange={(e) => setRcptFrom(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-gray-700 mb-1.5 block">
                      Received into
                    </label>
                    <input
                      type="text"
                      className="w-full max-w-md p-2 text-xs border border-gray-200 rounded-xl bg-white outline-none"
                      value={rcptInto}
                      onChange={(e) => setRcptInto(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setAdvFormMode(null)}
                      className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-bold rounded-xl text-xs transition cursor-pointer"
                    >
                      ← Back
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        set({
                          rcpt: {
                            amount: rcptAmount,
                            date: rcptDate,
                            mode: rcptMode,
                            ref: rcptRef,
                            from: rcptFrom,
                            into: rcptInto,
                          },
                          advLater: false,
                          advFollow: false,
                        });
                        setAdvFormMode(null);
                      }}
                      className="px-5 py-2 bg-amber-300 hover:bg-amber-400 text-amber-950 font-bold rounded-xl text-xs shadow-2xs transition cursor-pointer"
                    >
                      Save receipt
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdvFormMode("on_the_way")}
                      className="text-xs font-bold text-indigo-700 hover:text-indigo-900 underline underline-offset-2 ml-2 cursor-pointer"
                    >
                      Not credited yet? Mark as on the way
                    </button>
                  </div>
                </div>
              )}

              {/* FORM 2: Advance On The Way */}
              {advFormMode === "on_the_way" && (
                <div className="p-4 bg-[#fffdf0] border border-amber-200 rounded-2xl space-y-4 mt-3">
                  <p className="text-xs font-bold text-amber-950">
                    The client says the payment is on its way. Log it now and mark it received when it's credited.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-gray-700 mb-1.5 block">
                        Amount coming
                      </label>
                      <div className="flex">
                        <span className="px-3 py-2 text-xs border border-r-0 border-gray-200 rounded-l-xl bg-gray-50 text-gray-500 font-bold">
                          ₹
                        </span>
                        <input
                          type="number"
                          className="w-full p-2 text-xs border border-gray-200 rounded-r-xl bg-white font-bold outline-none"
                          value={otwAmount}
                          onChange={(e) => setOtwAmount(Number(e.target.value))}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-gray-700 mb-1.5 block">
                        From
                      </label>
                      <input
                        type="text"
                        className="w-full p-2 text-xs border border-gray-200 rounded-xl bg-white outline-none"
                        value={otwFrom}
                        onChange={(e) => setOtwFrom(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-gray-700 mb-1.5 block">
                      How it's coming
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {["NEFT", "RTGS", "IMPS", "UPI", "Cheque", "Cash"].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setOtwMode(m)}
                          className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                            otwMode === m
                              ? "bg-[#2815f5] text-white shadow-2xs"
                              : "bg-white text-gray-700 border border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-gray-700 mb-1.5 block">
                      Expected by
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      {[
                        { label: "Today", days: 0 },
                        { label: "Tomorrow", days: 1 },
                        { label: "In 3 days", days: 3 },
                        { label: "In a week", days: 7 },
                      ].map((opt) => (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() => {
                            setOtwExpectedBy(opt.label);
                            const d = new Date();
                            d.setDate(d.getDate() + opt.days);
                            setOtwExpectedDate(d.toISOString().slice(0, 10));
                          }}
                          className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                            otwExpectedBy === opt.label
                              ? "bg-[#2815f5] text-white shadow-2xs"
                              : "bg-white text-gray-700 border border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                      <input
                        type="date"
                        className="p-1.5 text-xs border border-gray-200 rounded-xl bg-white outline-none ml-1"
                        value={otwExpectedDate}
                        onChange={(e) => {
                          setOtwExpectedDate(e.target.value);
                          setOtwExpectedBy("Custom");
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-gray-700 mb-1.5 block">
                        UTR / ref (if shared)
                      </label>
                      <input
                        type="text"
                        className="w-full p-2 text-xs border border-gray-200 rounded-xl bg-white outline-none"
                        value={otwRef}
                        onChange={(e) => setOtwRef(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-gray-700 mb-1.5 block">
                        Note
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Accounts said released today"
                        className="w-full p-2 text-xs border border-gray-200 rounded-xl bg-white outline-none"
                        value={otwNote}
                        onChange={(e) => setOtwNote(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="border border-dashed border-gray-300 rounded-xl p-3 flex items-center gap-3 bg-white/70">
                    <span className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-xs font-bold text-indigo-600 shrink-0">
                      📎
                    </span>
                    <div>
                      <span className="text-xs font-bold text-gray-800 block">
                        Payment screenshot (optional)
                      </span>
                      <span className="text-[11px] text-gray-400">
                        Paste with Ctrl+V or choose the transfer or cheque photo
                      </span>
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-xl p-3 bg-white flex items-center gap-3 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setOtwHoldProduction(!otwHoldProduction)}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                        otwHoldProduction ? "bg-indigo-600" : "bg-gray-200"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                          otwHoldProduction ? "transform translate-x-5" : ""
                        }`}
                      />
                    </button>
                    <div>
                      <div className="font-bold text-xs text-gray-900">
                        Hold production until it's credited
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {otwHoldProduction
                          ? "On: production will be held until advance is credited"
                          : "Off: production goes ahead; the advance is tracked as on the way"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setAdvFormMode(null)}
                      className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-bold rounded-xl text-xs transition cursor-pointer"
                    >
                      ← Back
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        set({
                          advLater: true,
                          advFollow: true,
                          advOnTheWay: {
                            amount: otwAmount,
                            from: otwFrom,
                            mode: otwMode,
                            expectedBy: otwExpectedBy,
                            expectedDate: otwExpectedDate,
                            ref: otwRef,
                            note: otwNote,
                            holdProduction: otwHoldProduction,
                          },
                        });
                        setAdvFormMode(null);
                      }}
                      className="px-5 py-2 bg-amber-400 hover:bg-amber-500 text-amber-950 font-bold rounded-xl text-xs shadow-2xs transition cursor-pointer"
                    >
                      Save as on the way
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Warning: Advance not received */}
        {!s.rcpt && (
          <div className="border border-rose-300 bg-rose-50/50 rounded-2xl p-4 space-y-3.5 shadow-2xs">
            <div>
              <div className="font-bold text-xs text-rose-950 flex items-center gap-1.5">
                <span>⚠</span> Advance not received
              </div>
              <p className="text-[11px] text-rose-900/80 mt-1 leading-relaxed">
                Until it's received, the tax invoice won't be generated and dispatch will be delayed.{" "}
                {s.advReminderSent
                  ? `Reminder sent on ${s.advReminderSent}.`
                  : "No reminder sent yet."}{" "}
                Auto reminders are on: one goes when the job is posted, and again 2 working days before dispatch.
              </p>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setShowReminderModal(true)}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-amber-950 font-bold rounded-xl text-xs shadow-2xs transition cursor-pointer"
              >
                Send reminder now
              </button>
            </div>

            <div className="bg-white rounded-xl border border-rose-100 p-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setAutoReminderMode(!autoReminderMode)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                  autoReminderMode ? "bg-[#2815f5]" : "bg-gray-200"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    autoReminderMode ? "transform translate-x-5" : ""
                  }`}
                />
              </button>
              <div>
                <div className="font-bold text-xs text-gray-900">Auto mode</div>
                <div className="text-[11px] text-gray-500">Sends by itself</div>
              </div>
            </div>
          </div>
        )}

        {/* Green Success Banner */}
        {(s.advFollow || s.advLater) && !s.rcpt && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center gap-2.5 text-xs text-emerald-900 font-medium shadow-2xs">
            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
              ✓
            </span>
            <span>
              Invoicing is complete; the <b>{inr(finAdvanceDue)}</b> advance is to follow. The tax invoice is raised from this proforma at dispatch.
            </span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center pt-4 border-t border-gray-100">
        <button
          type="button"
          className="px-6 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold rounded-xl transition cursor-pointer text-xs"
          onClick={() => setSub(0)}
        >
          ← Back
        </button>
        <div className="flex flex-col items-end gap-1.5">
          <button
            type="button"
            disabled={!isPiReadyForNext || (!s.rcpt && !s.advFollow && !s.advLater)}
            className={`px-8 py-3 rounded-xl font-bold transition text-xs shadow-xs ${
              isPiReadyForNext && (s.rcpt || s.advFollow || s.advLater)
                ? "bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                : "bg-gray-100 text-gray-400 border border-gray-200 opacity-80 cursor-not-allowed"
            }`}
            onClick={() => {
              if (isPiReadyForNext && (s.rcpt || s.advFollow || s.advLater)) {
                setSub(2);
              }
            }}
          >
            Next: pack, deliver &amp; post
          </button>
          {!isPiReadyForNext && (
            <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1">
              <span>🔒</span>
              <span>
                {!isPiSent
                  ? "Proforma Invoice must be sent to client first."
                  : "Client approval required on Proforma Invoice before proceeding."}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Cancel Order Link */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Are you sure the client wants to cancel this order?")) {
              set({ abandoned: true });
            }
          }}
          className="text-xs text-gray-400 hover:text-rose-600 transition cursor-pointer font-medium"
        >
          Client wants to cancel the whole order...
        </button>
      </div>
    </div>
  );
};

export default FinancialsTab;

