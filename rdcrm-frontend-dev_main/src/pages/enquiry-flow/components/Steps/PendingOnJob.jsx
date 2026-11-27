import React, { useState } from "react";
import { inr, dfmt, todayISO } from "../../utils/helpers";
import PreviewPaymentReminderSheet from "./PreviewPaymentReminderSheet";
import PreviewDeliveryChargesSheet from "./PreviewDeliveryChargesSheet";

const PendingOnJob = ({ s = {}, set, client = {}, ids = {}, items = [] }) => {
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showChargesModal, setShowChargesModal] = useState(false);
  const [autoReminderMode, setAutoReminderMode] = useState(
    s.autoRemindClient !== undefined ? s.autoRemindClient : true
  );

  const isAdvPending = !s.rcpt;
  const isPackingListPending = !s.packingListStatus || s.packingListStatus !== "received";
  const isDelivChargesPending = !s.chargesApproved && s.delivChargesPending !== false;
  const isPpPending = !!(s.ppAfter && !s.ppApproved);

  const pendingCount =
    (isAdvPending ? 1 : 0) +
    (isPackingListPending ? 1 : 0) +
    (isDelivChargesPending ? 1 : 0) +
    (isPpPending ? 1 : 0);

  if (pendingCount === 0) return null;

  const parentJobNo = s?.seq
    ? String(s.seq).startsWith("RD")
      ? s.seq
      : `RD${s.seq}`
    : (ids?.enq?.startsWith("RD") ? ids.enq : ids?.enq?.replace("ENQ/26/", "RD")) || "RD/P/26/0415";

  const dcNo = ids?.dc || `DC/26/${String(parentJobNo).replace(/\D/g, "").slice(-4) || "0415"}`;

  const currentDeliv = s.deliv || {
    carrier: "Tempo",
    payer: "rd",
    chargesAmount: 2500,
    shipTo: "Lonavala offsite venue"
  };

  const advanceDue = s.advPlan?.amount || 100000;

  return (
    <div className="w-full bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5 text-left">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-purple-100 text-purple-700">
          {pendingCount}
        </span>
        <div>
          <h3 className="font-extrabold text-sm text-gray-900 tracking-tight">
            Pending on this job
          </h3>
          <p className="text-[11px] text-gray-400 font-medium">
            None of these hold production. Clear them as they come in.
          </p>
        </div>
      </div>

      {/* Main card with left red bar matching Screenshot 3 */}
      <div className="border-l-4 border-rose-500 pl-4 sm:pl-5 space-y-6">
        {/* Item 1: Advance not received */}
        {isAdvPending && (
          <div className="space-y-3">
            <div className="flex items-start gap-2.5">
              <span className="text-base text-rose-600 mt-0.5">⚠</span>
              <div>
                <b className="font-bold text-xs text-gray-900 block">
                  Advance not received · invoice and dispatch on hold
                </b>
                <p className="text-[11px] text-gray-400 mt-0.5 font-medium">
                  Last reminder {s.advReminderSent || "11 Oct 2026"} via Auto · WhatsApp + email · next auto reminder Thu, 22 Oct
                </p>
              </div>
            </div>

            {/* Inner Red Alert Box */}
            <div className="bg-[#FFF5F5] border border-[#FED7D7] rounded-xl p-4 space-y-3.5 shadow-2xs">
              <div className="flex items-start gap-2 text-rose-900 font-bold text-xs">
                <span>⚠</span>
                <span>Advance not received</span>
              </div>
              <p className="text-[11px] text-rose-800 leading-relaxed font-medium">
                Until it's received, the tax invoice won't be generated and dispatch will be delayed. Last reminder {s.advReminderSent || "11 Oct 2026"} via Auto · WhatsApp + email. Auto reminders are on; next on Thu, 22 Oct, 2 working days before dispatch.
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

              {/* Auto mode toggle pill */}
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
          </div>
        )}

        {/* Item 2: Packing list */}
        {isPackingListPending && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-gray-100">
            <div className="flex items-start gap-2.5">
              <span className="text-base text-gray-400 mt-0.5">📋</span>
              <div>
                <b className="font-bold text-xs text-gray-900 block">
                  Packing list
                </b>
                <p className="text-[11px] text-gray-400 mt-0.5 font-medium">
                  Needed for individual packing
                </p>
              </div>
            </div>
            <label className="px-5 py-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-bold rounded-xl text-xs shadow-2xs transition cursor-pointer text-center shrink-0">
              Attach
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    set({
                      packingListStatus: "received",
                      packingListFileName: file.name
                    });
                  }
                }}
              />
            </label>
          </div>
        )}

        {/* Item 3: Delivery charges */}
        {isDelivChargesPending && (
          <div className="space-y-2.5 pt-3 border-t border-gray-100">
            <div className="flex items-start gap-2.5">
              <span className="text-base text-gray-400 mt-0.5">💸</span>
              <div>
                <b className="font-bold text-xs text-gray-900 block">
                  Delivery charges
                </b>
                <p className="text-[11px] text-gray-400 mt-0.5 font-medium">
                  Get the cost from Dispatch for job costing
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pl-6 sm:pl-7">
              <span className="font-extrabold text-xs text-gray-900">
                ₹{Number(currentDeliv.chargesAmount || 2500).toLocaleString("en-IN")}
              </span>
              <span className="text-gray-500 text-[11px] font-medium">
                + GST · {currentDeliv.carrier || "Tempo"} · {dcNo}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-700">
                {currentDeliv.payer === "client"
                  ? "Client pays · added to invoice"
                  : "RD pays · logged to job cost"}
              </span>
            </div>

            <div className="flex items-center gap-3 pl-6 sm:pl-7 pt-1">
              <button
                type="button"
                onClick={() => setShowChargesModal(true)}
                className="px-4 py-1.5 bg-amber-400 hover:bg-amber-500 text-amber-950 font-bold rounded-lg text-xs shadow-2xs transition cursor-pointer"
              >
                Send to client for approval
              </button>
              <button
                type="button"
                onClick={() => set({ delivChargesPending: false })}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
              >
                Reset
              </button>
            </div>

            <div className="text-[11px] text-gray-400 pl-6 sm:pl-7">
              {currentDeliv.payer === "rd" ? (
                <>
                  RD is paying this freight. Should the client pay instead?{" "}
                  <button
                    type="button"
                    onClick={() =>
                      set({
                        deliv: { ...currentDeliv, payer: "client" }
                      })
                    }
                    className="font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                  >
                    Switch to client pays
                  </button>
                </>
              ) : (
                <>
                  Once approved, the charges go on the invoice.{" "}
                  <button
                    type="button"
                    onClick={() =>
                      set({
                        deliv: { ...currentDeliv, payer: "rd" }
                      })
                    }
                    className="font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                  >
                    Switch to RD pays
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Item 4: Pre-production sample pending */}
        {isPpPending && (
          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-2.5">
              <span className="text-base text-amber-500 mt-0.5">🔬</span>
              <div>
                <b className="font-bold text-xs text-gray-900 block">
                  Pre-production sample v1 · client approval pending
                </b>
                <p className="text-[11px] text-gray-400 mt-0.5 font-medium">
                  Release is active, but bulk production holds until the 1 pre-production sample is approved by the client.
                </p>
              </div>
            </div>

            <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-2xs">
              <div className="text-xs text-amber-950 font-medium leading-relaxed">
                Client reviewed and approved the pre-production sample?
              </div>
              <button
                type="button"
                onClick={() =>
                  set({
                    ppApproved: true,
                    ppApprovedAt: new Date().toISOString()
                  })
                }
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-2xs transition cursor-pointer shrink-0"
              >
                ✓ Mark PP Approved
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reminder Preview Modal */}
      {showReminderModal && (
        <PreviewPaymentReminderSheet
          s={s}
          client={client}
          ids={ids}
          items={items}
          totalInvoiceVal={s.totalInvoiceVal || 337008}
          advanceDue={advanceDue}
          deliveryDate={s.relDate || "2026-10-24"}
          currentDeliv={currentDeliv}
          onClose={() => setShowReminderModal(false)}
          onSend={() => {
            set({ advReminderSent: dfmt(todayISO()) });
            setShowReminderModal(false);
          }}
        />
      )}

      {/* Charges Preview Modal */}
      {showChargesModal && (
        <PreviewDeliveryChargesSheet
          s={{
            ...s,
            chargesAmount: currentDeliv.chargesAmount || 2500,
            carrier: currentDeliv.carrier || "Tempo",
            payer: currentDeliv.payer || "rd",
            shipTo: currentDeliv.shipTo || "Lonavala offsite venue"
          }}
          client={client}
          onClose={() => setShowChargesModal(false)}
          onSend={() => {
            set({ chargesApproved: true, delivChargesPending: false });
            setShowChargesModal(false);
          }}
        />
      )}
    </div>
  );
};

export default PendingOnJob;
