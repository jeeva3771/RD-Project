import React, { useState } from "react";
import { toast } from "react-toastify";
import {
  COLLECTION_STAGES,
  INV_STATUS_LABEL,
  INV_STATUS_STYLE,
} from "../../constants/collectionsConstants";
import {
  inr,
  formatDate,
  isPromiseOverdue,
} from "../../utils/collectionsFormatters";
import CollectionIcon from "../common/CollectionIcon";
import EmailComposeModal from "./EmailComposeModal";
import WhatsAppComposeModal from "./WhatsAppComposeModal";
import ReceiptComposeModal from "./ReceiptComposeModal";
import PromiseToPayModal from "./PromiseToPayModal";
import ReconcileModal from "./ReconcileModal";

export default function CaseDetailModal({
  caseObj,
  onClose,
  onAddHistory,
  onMoveStage,
  onSetFollowUp,
  onRecordPromise,
  onRecordReceipt,
  onRecordUnallocated,
  onAllocate,
  unallocatedForClient = [],
  repeatOffenderIntel = null,
  bankAccounts = [],
  officers = [],
  onReassignOwner,
}) {
  const [noteType, setNoteType] = useState("call");
  const [noteText, setNoteText] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [emailOpen, setEmailOpen] = useState(false);
  const [waOpen, setWaOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [promiseOpen, setPromiseOpen] = useState(false);

  if (!caseObj) return null;
  const stage = COLLECTION_STAGES.find((s) => s.id === caseObj.stage) || COLLECTION_STAGES[0];
  const historyIcon = {
    call: "phone",
    email: "mail",
    whatsapp: "message",
    note: "edit",
    receipt: "check",
  };

  const saveNote = () => {
    if (!noteText.trim()) return;
    onAddHistory(caseObj.id, {
      id: caseObj.id + "-" + Date.now(),
      date: formatDate(new Date()),
      type: noteType,
      by: caseObj.owner,
      text: noteText.trim(),
    });
    setNoteText("");
    toast.success("Follow-up note logged");
  };

  const saveFollowUp = () => {
    if (!followUpDate) return;
    const label = formatDate(new Date(followUpDate));
    onSetFollowUp(caseObj.id, label);
    onAddHistory(caseObj.id, {
      id: caseObj.id + "-fu-" + Date.now(),
      date: formatDate(new Date()),
      type: "note",
      by: caseObj.owner,
      text: "Follow-up scheduled for " + label + ".",
    });
    setFollowUpDate("");
    toast.success("Next follow-up set for " + label);
  };

  const logSent = (type, text) => {
    onAddHistory(caseObj.id, {
      id: caseObj.id + "-" + type + "-" + Date.now(),
      date: formatDate(new Date()),
      type,
      by: caseObj.owner,
      text,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-3 sm:p-5"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div
          className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between"
          style={{ background: stage.color + "12" }}
        >
          <div className="min-w-0">
            <div
              className="text-[10px] font-extrabold uppercase tracking-wider"
              style={{ color: stage.color }}
            >
              Collections Case File
            </div>
            <div className="text-lg font-black text-slate-800 truncate flex items-center gap-2 mt-0.5 flex-wrap">
              <span>{caseObj.client}</span>
              {repeatOffenderIntel && repeatOffenderIntel.tier === "Repeat Offender" && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1 shrink-0">
                  <CollectionIcon name="alert" size={11} /> Repeat Offender
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
              <span className="font-semibold text-slate-700">
                {caseObj.contact.contactPerson}
              </span>
              <span>•</span>
              <span>{caseObj.contact.phone}</span>
              <span>•</span>
              <span className="truncate">{caseObj.contact.email}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white flex items-center justify-center text-slate-400 hover:text-slate-600 shrink-0"
          >
            <CollectionIcon name="x" size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 sm:px-6 py-4 space-y-5 scrollbar-thin scrollbar-thumb-slate-300">
          {/* Top KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <div className="text-[10px] text-slate-400 font-bold uppercase">Outstanding</div>
              <div className="text-base font-extrabold text-slate-800 mt-0.5">
                {caseObj.allPaid ? (
                  <span className="text-emerald-600 font-bold">₹0 — Settled</span>
                ) : (
                  inr(caseObj.total)
                )}
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <div className="text-[10px] text-slate-400 font-bold uppercase">Oldest Overdue</div>
              <div className="text-base font-extrabold text-slate-800 mt-0.5">
                {caseObj.oldest > 0 ? `${caseObj.oldest} days` : "—"}
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <div className="text-[10px] text-slate-400 font-bold uppercase">Assigned Officer</div>
              {officers && officers.length > 0 ? (
                <select
                  value={caseObj.owner}
                  onChange={(e) => onReassignOwner && onReassignOwner(caseObj.id, e.target.value)}
                  className="text-xs font-bold text-slate-800 bg-transparent outline-none cursor-pointer mt-0.5 border-b border-dashed border-slate-300 pb-0.5 w-full truncate"
                  title="Click to reassign to another Accounts Officer"
                >
                  {officers.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-base font-extrabold text-slate-800 mt-0.5">
                  {caseObj.owner}
                </div>
              )}
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <div className="text-[10px] text-slate-400 font-bold uppercase">Next Follow-up</div>
              <div className="text-base font-extrabold text-slate-800 mt-0.5">
                {caseObj.allPaid ? "Not required" : caseObj.nextFollowUp || "Not scheduled"}
              </div>
            </div>
          </div>

          {/* Repeat Offender Advisory */}
          {repeatOffenderIntel && repeatOffenderIntel.tier !== "Normal" && (
            <div
              className={
                "rounded-xl border p-3.5 text-xs flex items-start gap-2.5 " +
                (repeatOffenderIntel.tier === "Repeat Offender"
                  ? "border-rose-200 bg-rose-50 text-rose-800"
                  : "border-amber-200 bg-amber-50 text-amber-800")
              }
            >
              <CollectionIcon name="alert" size={16} className="shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-bold">{repeatOffenderIntel.tier} Alert:</span> Escalated{" "}
                {repeatOffenderIntel.escalationCount} time
                {repeatOffenderIntel.escalationCount === 1 ? "" : "s"} previously. Currently has{" "}
                {repeatOffenderIntel.overdueCount} overdue invoice
                {repeatOffenderIntel.overdueCount === 1 ? "" : "s"}, with average delay of{" "}
                {repeatOffenderIntel.avgDaysOverdue} days.{" "}
                {repeatOffenderIntel.tier === "Repeat Offender" &&
                  "Recommendation: Insist on 100% advance or shorter credit terms on next production batch."}
              </div>
            </div>
          )}

          {/* Unmatched Cash Alert */}
          {unallocatedForClient && unallocatedForClient.length > 0 && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3.5 text-xs text-indigo-900 flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-start gap-2.5">
                <CollectionIcon name="link" size={16} className="shrink-0 mt-0.5 text-indigo-600" />
                <div className="leading-relaxed">
                  <span className="font-bold">Unmatched Payment on File:</span>{" "}
                  {inr(
                    unallocatedForClient.reduce(
                      (s, u) =>
                        s + (u.amount - u.allocations.reduce((a, x) => a + x.amount, 0)),
                      0
                    )
                  )}{" "}
                  received via bank transfer without invoice reference. Please verify before
                  calling — client may have already paid.
                </div>
              </div>
              <button
                onClick={() => setReconcileOpen(true)}
                className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shrink-0 shadow-sm transition"
              >
                <CollectionIcon name="link" size={12} /> Reconcile Now
              </button>
            </div>
          )}

          {/* Stage Switcher */}
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-2">
              Current Stage
            </div>
            <div className="flex flex-wrap gap-1.5">
              {COLLECTION_STAGES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    if (s.id === "promised") {
                      setPromiseOpen(true);
                    } else {
                      onMoveStage(caseObj.id, s.id);
                    }
                  }}
                  className={
                    "text-xs font-bold px-3 py-1.5 rounded-full border transition " +
                    (s.id === caseObj.stage
                      ? "text-white shadow-xs"
                      : "text-slate-600 border-slate-200 hover:bg-slate-50")
                  }
                  style={s.id === caseObj.stage ? { background: s.color, borderColor: s.color } : {}}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Active Promise Details Banner */}
          {caseObj.stage === "promised" && (
            <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-3.5 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center shrink-0 mt-0.5">
                  <CollectionIcon name="calendar" size={15} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-teal-900 flex items-center gap-2">
                    <span>Client Payment Commitment</span>
                    {caseObj.promisedDate && (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-teal-600 text-white">
                        {caseObj.promisedDate}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-teal-800 mt-1 space-y-0.5">
                    <div>
                      Promised Amount:{" "}
                      <span className="font-bold">
                        {caseObj.promisedAmount ? inr(caseObj.promisedAmount) : inr(caseObj.total)}
                      </span>
                    </div>
                    {caseObj.promisedNote && (
                      <div className="italic text-teal-700">"{caseObj.promisedNote}"</div>
                    )}
                  </div>
                  {isPromiseOverdue(caseObj.promisedDateIso) && !caseObj.allPaid && (
                    <div className="text-[11px] font-bold text-rose-600 mt-1.5 flex items-center gap-1 bg-rose-50 border border-rose-200 px-2 py-1 rounded-md">
                      <CollectionIcon name="alert" size={12} /> Overdue Commitment: Promised date ({caseObj.promisedDate}) has passed!
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPromiseOpen(true)}
                className="text-xs font-bold text-teal-800 bg-white border border-teal-300 hover:bg-teal-100 px-3 py-1.5 rounded-lg transition shrink-0 shadow-2xs"
              >
                Reschedule / Edit
              </button>
            </div>
          )}

          {/* Linked Invoices */}
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-2">
              Linked Invoices ({caseObj.invoices.length})
            </div>
            <div className="space-y-2">
              {caseObj.invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between text-xs border border-slate-100 rounded-xl px-3.5 py-2.5 bg-slate-50/50 hover:bg-white transition"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-slate-800">{inv.invoiceNo}</span>
                    <span className="text-slate-400 truncate">• {inv.refNo}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {inv.balance <= 0 ? (
                      <span className="px-2 py-0.5 rounded-full border text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 font-bold flex items-center gap-1">
                        <CollectionIcon name="check" size={10} /> Fully Paid
                      </span>
                    ) : (
                      <React.Fragment>
                        <span className="font-bold text-slate-700 font-mono">
                          {inv.received > 0 ? inr(inv.balance) + " due" : inr(inv.amount)}
                          {inv.received > 0 && (
                            <span className="text-slate-400 font-normal ml-1">
                              (of {inr(inv.amount)})
                            </span>
                          )}
                        </span>
                        <span
                          className={
                            "px-2 py-0.5 rounded-full border text-[10px] font-bold " +
                            INV_STATUS_STYLE[inv.stationId]
                          }
                        >
                          {INV_STATUS_LABEL[inv.stationId]}
                        </span>
                      </React.Fragment>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Row */}
          {caseObj.allPaid ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 font-semibold flex items-center gap-2">
              <CollectionIcon name="check" size={16} className="text-emerald-600" />
              All invoices for this client are fully settled. Follow-up is closed.
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={() => setEmailOpen(true)}
                className="flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-3.5 py-2 rounded-lg hover:bg-amber-100 transition shadow-2xs"
              >
                <CollectionIcon name="mail" size={14} className="text-amber-600" /> Send Email
              </button>
              <button
                onClick={() => setWaOpen(true)}
                className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3.5 py-2 rounded-lg hover:bg-emerald-100 transition shadow-2xs"
              >
                <CollectionIcon name="message" size={14} className="text-emerald-600" /> Send WhatsApp
              </button>
              <button
                onClick={() => setReceiptOpen(true)}
                className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3.5 py-2 rounded-lg hover:bg-emerald-100 transition shadow-2xs"
              >
                <CollectionIcon name="check" size={14} className="text-emerald-600" /> Record Receipt
              </button>
              <div className="flex items-center gap-1.5 ml-auto">
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-indigo-400"
                />
                <button
                  onClick={saveFollowUp}
                  className="flex items-center gap-1 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition"
                >
                  <CollectionIcon name="calendar" size={13} /> Schedule
                </button>
              </div>
            </div>
          )}

          {/* Log Discussion */}
          <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                Log a Discussion / Note
              </span>
              <div className="flex gap-1">
                {[
                  ["call", "Call"],
                  ["email", "Email"],
                  ["whatsapp", "WhatsApp"],
                  ["note", "Note"],
                ].map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setNoteType(val)}
                    className={
                      "text-[10px] font-bold px-2 py-0.5 rounded-md border transition " +
                      (noteType === val
                        ? "bg-slate-800 text-white border-slate-800 shadow-2xs"
                        : "text-slate-600 border-slate-200 hover:bg-white")
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={3}
              placeholder="What did the client say? What are the next steps?"
              className="w-full border border-slate-200 rounded-lg p-2.5 text-xs outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-200 bg-white"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={saveNote}
                className="text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 px-4 py-1.5 rounded-lg shadow-2xs transition"
              >
                Save to History
              </button>
            </div>
          </div>

          {/* Timeline Audit History */}
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-2">
              Follow-up Audit History
            </div>
            <div className="space-y-2">
              {[...caseObj.history].reverse().map((h) => (
                <div
                  key={h.id}
                  className="flex gap-2.5 text-xs border-b border-slate-100 pb-2.5 last:border-0"
                >
                  <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                    <CollectionIcon name={historyIcon[h.type] || "edit"} size={12} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-slate-800 font-medium leading-relaxed">{h.text}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {h.date} • {h.by}
                    </div>
                  </div>
                </div>
              ))}
              {caseObj.history.length === 0 && (
                <div className="text-xs text-slate-400 italic py-2">No notes logged yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Nested Modals */}
      {emailOpen && (
        <EmailComposeModal
          caseObj={caseObj}
          onClose={() => setEmailOpen(false)}
          onSent={(subject, sentTo) => {
            logSent("email", `Email reminder sent to ${sentTo || caseObj.contact.email}: "${subject}"`);
            setEmailOpen(false);
          }}
        />
      )}
      {waOpen && (
        <WhatsAppComposeModal
          caseObj={caseObj}
          onClose={() => setWaOpen(false)}
          onSent={(sentMsg, targetPhone) => {
            logSent(
              "whatsapp",
              `WhatsApp payment reminder sent via 2Factor to ${targetPhone || caseObj.contact.phone || caseObj.contact.contactPerson}.`
            );
            setWaOpen(false);
          }}
        />
      )}
      {receiptOpen && (
        <ReceiptComposeModal
          caseObj={caseObj}
          bankAccounts={bankAccounts}
          onClose={() => setReceiptOpen(false)}
          onConfirm={(data) => {
            onRecordReceipt(caseObj.id, data);
            setReceiptOpen(false);
          }}
          onConfirmUnallocated={(data) => {
            onRecordUnallocated(caseObj.id, caseObj.client, data);
            setReceiptOpen(false);
          }}
        />
      )}
      {reconcileOpen && (
        <ReconcileModal
          unallocated={unallocatedForClient[0]}
          invoices={caseObj.invoices.filter((i) => i.balance > 0)}
          onClose={() => setReconcileOpen(false)}
          onAllocate={(unallocId, invoiceId, amt, tdsDetails) => {
            onAllocate(caseObj.id, unallocId, invoiceId, amt, tdsDetails);
            setReconcileOpen(false);
          }}
          clientName={caseObj.client}
          clientId={caseObj.client_id}
        />
      )}
      {promiseOpen && (
        <PromiseToPayModal
          caseObj={caseObj}
          onClose={() => setPromiseOpen(false)}
          onConfirm={(data) => {
            onRecordPromise(caseObj.id, data);
            setPromiseOpen(false);
          }}
        />
      )}
    </div>
  );
}

