import React, { useState } from "react";
import { inr, dfmt, todayISO } from "../../utils/helpers";
import PreviewPaymentReminderSheet from "./PreviewPaymentReminderSheet";
import PreviewProformaSheet from "./PreviewProformaSheet";

const FinLedger = ({ s = {}, set, client = {}, f = {}, ids = {} }) => {
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showProformaModal, setShowProformaModal] = useState(false);
  const [showRecordAdvModal, setShowRecordAdvModal] = useState(false);
  const [autoReminderMode, setAutoReminderMode] = useState(
    s.autoRemindClient !== undefined ? s.autoRemindClient : true
  );

  // Form states for recording advance
  const [rcptAmount, setRcptAmount] = useState(100000);
  const [rcptDate, setRcptDate] = useState(todayISO());
  const [rcptMode, setRcptMode] = useState("NEFT");
  const [rcptRef, setRcptRef] = useState("");
  const [rcptFrom, setRcptFrom] = useState(client?.name || "Meridian Pharma Pvt Ltd");
  const [rcptInto, setRcptInto] = useState(s.bankAc || "HDFC Kalina · current a/c");

  const parentJobNo = s?.seq
    ? String(s.seq).startsWith("RD")
      ? s.seq
      : `RD${s.seq}`
    : (ids?.enq?.startsWith("RD") ? ids.enq : ids?.enq?.replace("ENQ/26/", "RD")) || "RD/P/26/0415";

  const cleanSeq = String(parentJobNo).replace(/\D/g, "").slice(-4) || "0415";
  const qtNo = ids?.qt || `QT/26/${cleanSeq}`;
  const piNo = s.pi?.no || ids?.pi || `PI/26/${cleanSeq}`;
  const dcNo = ids?.dc || `DC/26/${cleanSeq}`;
  const s1No = `RD/S/26/${cleanSeq}-v1`;
  const s2No = `RD/S/26/${cleanSeq}-v2`;

  const advanceDue = s.advPlan?.amount || 100000;
  const isAdvReceived = !!s.rcpt;

  const handleSaveAdvance = () => {
    set({
      rcpt: {
        amount: Number(rcptAmount),
        date: rcptDate,
        mode: rcptMode,
        ref: rcptRef,
        from: rcptFrom,
        into: rcptInto
      }
    });
    setShowRecordAdvModal(false);
  };

  return (
    <div className="w-full bg-white border border-gray-200 rounded-2xl p-6 sm:p-7 shadow-xs space-y-6 text-xs text-left">
      {/* Header matching Screenshot 2 */}
      <div className="flex items-start gap-3 pb-2 border-b border-gray-100">
        <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 font-black text-sm flex items-center justify-center shrink-0">
          ₹
        </span>
        <div>
          <h4 className="font-black text-base text-gray-900 tracking-tight">
            Job financials
          </h4>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Every quote, invoice and payment for this job in one place.
          </p>
        </div>
      </div>

      {/* Financial Rows List */}
      <div className="divide-y divide-gray-100 text-xs">
        {/* 1. Enquiry quote */}
        <div className="py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-[#10B981] font-bold text-sm">✓</span>
            <div>
              <b className="text-gray-900 block font-bold">Enquiry quote</b>
              <span className="text-gray-400 text-[11px] font-medium block">
                {qtNo} · Sent via {s.quoteVia || "Hand-delivered / other"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-extrabold text-gray-900">₹3,200/pc</span>
            <button
              type="button"
              onClick={() => setShowProformaModal(true)}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
            >
              Open
            </button>
          </div>
        </div>

        {/* Sample Invoices (Rendered dynamically if sample flow or PP sample occurred) */}
        {s.ppAfter ? (
          <div className="py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-[#10B981] font-bold text-sm">✓</span>
              <div>
                <b className="text-gray-900 block font-bold">Sample v1 (pre-production) invoice</b>
                <span className="text-gray-400 text-[11px] font-medium block">
                  {s1No} · 1 pc test piece · {s.charge === 'foc' ? 'Free of cost' : 'Billed separately'}
                </span>
              </div>
            </div>
            <span className="font-extrabold text-gray-900">
              {s.charge === 'foc' ? '₹0 (FOC)' : inr(s.sampleRate || 3390)}
            </span>
          </div>
        ) : (s.mode !== 'order' || (s.rounds && s.rounds.length > 0)) ? (
          <>
            {/* 2. Sample v1 invoice */}
            <div className="py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-[#10B981] font-bold text-sm">✓</span>
                <div>
                  <b className="text-gray-900 block font-bold">Sample v1 invoice</b>
                  <span className="text-gray-400 text-[11px] font-medium block">
                    {s1No} · Billed separately
                  </span>
                </div>
              </div>
              <span className="font-extrabold text-gray-900">₹16,473</span>
            </div>

            {/* 3. Sample v2 invoice */}
            <div className="py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-[#10B981] font-bold text-sm">✓</span>
                <div>
                  <b className="text-gray-900 block font-bold">Sample v2 invoice</b>
                  <span className="text-gray-400 text-[11px] font-medium block">
                    {s2No} · Billed separately
                  </span>
                </div>
              </div>
              <span className="font-extrabold text-gray-900">₹6,980</span>
            </div>
          </>
        ) : null}

        {/* 4. Quotation & proforma */}
        <div className="py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-[#10B981] font-bold text-sm">✓</span>
            <div>
              <b className="text-gray-900 block font-bold">Quotation & proforma</b>
              <span className="text-gray-400 text-[11px] font-medium block">
                {piNo} · Approved · {s.costOk?.method || "WhatsApp"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-extrabold text-gray-900">₹3,37,008</span>
            <button
              type="button"
              onClick={() => setShowProformaModal(true)}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
            >
              Open
            </button>
          </div>
        </div>

        {/* 5. Advance */}
        <div className="py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className={isAdvReceived ? "text-[#10B981] font-bold text-sm" : "text-gray-400 text-sm"}>
              {isAdvReceived ? "✓" : "·"}
            </span>
            <div>
              <b className="text-gray-900 block font-bold">Advance</b>
              <span className="text-gray-400 text-[11px] font-medium block">
                {isAdvReceived
                  ? `Received via ${s.rcpt.mode} on ${dfmt(s.rcpt.date)}`
                  : "— · Due · to follow"}
              </span>
            </div>
          </div>
          <span className="font-extrabold text-gray-900">{inr(advanceDue)}</span>
        </div>

        {/* 6. Delivery charges */}
        <div className="py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-[#10B981] font-bold text-sm">✓</span>
            <div>
              <b className="text-gray-900 block font-bold">Delivery charges</b>
              <span className="text-gray-400 text-[11px] font-medium block">
                {dcNo} · Borne by RD
              </span>
            </div>
          </div>
          <span className="font-extrabold text-gray-900">₹2,950</span>
        </div>

        {/* 7. Tax invoice */}
        <div className="py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className={s.tinv ? "text-[#10B981] font-bold text-sm" : "text-gray-400 text-sm"}>
              {s.tinv ? "✓" : "·"}
            </span>
            <div>
              <b className="text-gray-900 block font-bold">Tax invoice</b>
              <span className="text-gray-400 text-[11px] font-medium block">
                {s.tinv ? `Raised · ${dfmt(s.tinv.at)}` : "— · Raised at dispatch"}
              </span>
            </div>
          </div>
          <span className="font-extrabold text-gray-900">₹3,37,008</span>
        </div>
      </div>

      {/* 3 Summary Cards matching Screenshot 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
        <div className="p-4 bg-[#F8F9FE] border border-indigo-100 rounded-2xl">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
            Job value incl. GST
          </span>
          <b className="text-base font-black text-gray-900 block mt-1">
            ₹3,60,461
          </b>
        </div>
        <div className="p-4 bg-[#F8F9FE] border border-indigo-100 rounded-2xl">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
            Received
          </span>
          <b className="text-base font-black text-gray-900 block mt-1">
            ₹23,453
          </b>
        </div>
        <div className="p-4 bg-[#F8F9FE] border border-indigo-100 rounded-2xl">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
            Balance due
          </span>
          <b className="text-base font-black text-gray-900 block mt-1">
            ₹3,37,008
          </b>
        </div>
      </div>

      {/* Advance Action and Warning Box (Screenshot 2) */}
      {!s.tinv && !isAdvReceived && (
        <div className="space-y-4 pt-1">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowRecordAdvModal(true)}
              className="px-5 py-2.5 bg-white hover:bg-gray-50 border border-gray-300 text-gray-800 font-bold rounded-xl text-xs shadow-2xs transition cursor-pointer"
            >
              Record the advance
            </button>
            <span className="text-xs text-gray-400 font-medium">
              ₹1,00,000 still to come.
            </span>
          </div>

          {/* Red Alert Box */}
          <div className="bg-[#FFF5F5] border border-[#FED7D7] rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-2xs">
            <div className="flex items-center gap-2 text-rose-900 font-bold text-xs">
              <span>⚠</span>
              <span>Advance not received</span>
            </div>
            <p className="text-[11px] text-rose-800 leading-relaxed font-medium">
              Until it's received, the tax invoice won't be generated and dispatch will be delayed. Last reminder 11 Oct 2026 via Auto-WhatsApp + email. Auto reminders are on; next on Thu, 22 Oct, 2 working days before dispatch.
            </p>

            <div>
              <button
                type="button"
                onClick={() => setShowReminderModal(true)}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-amber-950 font-bold rounded-xl text-xs shadow-2xs transition cursor-pointer"
              >
                Send reminder now
              </button>
            </div>

            {/* Auto mode toggle box */}
            <div className="bg-white rounded-xl border border-rose-200/80 p-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setAutoReminderMode(!autoReminderMode)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                  autoReminderMode ? "bg-indigo-600" : "bg-gray-200"
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
                <div className="text-[10px] text-gray-400 font-medium">Sends by itself</div>
              </div>
            </div>
          </div>

          {/* Bottom Invoice Actions matching Screenshot 2 */}
          <div className="flex flex-wrap items-center gap-4 pt-1">
            <button
              type="button"
              disabled
              className="px-5 py-2.5 bg-gray-100 text-gray-400 font-bold rounded-xl text-xs border border-gray-200 cursor-not-allowed"
            >
              Raise tax invoice (advance pending)
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Raise tax invoice without advance with MD approval?")) {
                  set({
                    tinv: {
                      no: ids.inv || `INV/26/${cleanSeq}`,
                      at: new Date().toISOString()
                    }
                  });
                }
              }}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
            >
              Raise anyway (MD approved)
            </button>
          </div>
        </div>
      )}

      {/* Record Advance Modal */}
      {showRecordAdvModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <h3 className="font-extrabold text-sm text-gray-900">
                Record advance received
              </h3>
              <button
                type="button"
                onClick={() => setShowRecordAdvModal(false)}
                className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">
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
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">
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
                <label className="text-[11px] font-bold text-gray-700 block mb-1">
                  Payment Mode
                </label>
                <div className="flex flex-wrap gap-2">
                  {["NEFT", "RTGS", "IMPS", "UPI", "Cheque", "Cash"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setRcptMode(m)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                        rcptMode === m
                          ? "bg-indigo-600 text-white"
                          : "bg-white text-gray-700 border border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-700 block mb-1">
                  UTR / Transaction Ref
                </label>
                <input
                  type="text"
                  placeholder="e.g. UTR827361928"
                  className="w-full p-2 text-xs border border-gray-200 rounded-xl bg-white outline-none"
                  value={rcptRef}
                  onChange={(e) => setRcptRef(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">
                    Received from
                  </label>
                  <input
                    type="text"
                    className="w-full p-2 text-xs border border-gray-200 rounded-xl bg-white outline-none"
                    value={rcptFrom}
                    onChange={(e) => setRcptFrom(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">
                    Received into
                  </label>
                  <input
                    type="text"
                    className="w-full p-2 text-xs border border-gray-200 rounded-xl bg-white outline-none"
                    value={rcptInto}
                    onChange={(e) => setRcptInto(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowRecordAdvModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 font-bold rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAdvance}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-2xs"
              >
                Save receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reminder Modal */}
      {showReminderModal && (
        <PreviewPaymentReminderSheet
          s={s}
          client={client}
          ids={ids}
          totalInvoiceVal={337008}
          advanceDue={advanceDue}
          deliveryDate={s.relDate || "2026-10-24"}
          currentDeliv={s.deliv || {}}
          onClose={() => setShowReminderModal(false)}
          onSend={() => {
            set({ advReminderSent: dfmt(todayISO()) });
            setShowReminderModal(false);
          }}
        />
      )}

      {/* Proforma Modal */}
      {showProformaModal && (
        <PreviewProformaSheet
          s={s}
          set={set}
          client={client}
          ids={ids}
          advanceDue={advanceDue}
          onClose={() => setShowProformaModal(false)}
          onSend={() => setShowProformaModal(false)}
        />
      )}
    </div>
  );
};

export default FinLedger;
