import React, { useState } from "react";
import { toast } from "react-toastify";
import { axiosInstance } from "../../../../../utils/url/config";
import { inr } from "../../utils/collectionsFormatters";
import CollectionIcon from "../common/CollectionIcon";

export default function WhatsAppComposeModal({
  caseObj,
  onClose,
  onSent,
  msgOverride,
}) {
  const [phone, setPhone] = useState(caseObj.contact.phone || "");
  const [isSending, setIsSending] = useState(false);

  const clientName = caseObj.client || "Client";
  const jobIdentifier =
    caseObj.invoices?.[0]?.sub_job_no ||
    caseObj.invoices?.[0]?.invoiceNo ||
    caseObj.client;
  const totalAmt =
    caseObj.invoices?.reduce((s, i) => s + Number(i.amount || i.balance || 0), 0) ||
    caseObj.total ||
    0;
  const pendingAmt = caseObj.total || 0;

  const defaultMsg =
    msgOverride ||
    "Hello " +
    clientName +
    ",\nReminder from *RD Custom Awards*:\nA pending balance of *₹" +
    inr(pendingAmt) +
    "* is due for your Order *#" +
    jobIdentifier +
    "* (Total: " +
    inr(totalAmt) +
    ").\nKindly clear the balance for prompt delivery.\nThank you!\nAccounts Team, RD Custom Awards";

  const [msg, setMsg] = useState(defaultMsg);

  const handleSend2Factor = async () => {
    const rawClean = phone.replace(/[^0-9]/g, "");
    if (rawClean.length < 10) {
      toast.warning("Please enter a valid 10-digit mobile number");
      return;
    }

    setIsSending(true);
    try {
      const res = await axiosInstance.post("/accounts/send-whatsapp-reminder", {
        job_no: jobIdentifier,
        sub_job_no: jobIdentifier,
        client_name: clientName,
        amount: totalAmt,
        outstanding: pendingAmt,
        phone: rawClean,
        numbers: [rawClean],
        caseId: caseObj.id,
      });

      if (res.data?.success) {
        toast.success(`WhatsApp payment reminder sent via 2Factor to ${phone}!`);
        if (onSent) onSent(msg, phone);
      } else {
        toast.error(res.data?.message || "Failed to dispatch WhatsApp reminder via 2Factor");
      }
    } catch (err) {
      console.error("Error sending 2Factor WhatsApp reminder:", err);
      toast.error(err.response?.data?.message || err.message || "Failed to send 2Factor WhatsApp");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="px-5 py-3.5 border-b border-emerald-100 flex items-center justify-between bg-emerald-50/70">
          <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
            <CollectionIcon name="message" size={16} className="text-emerald-600" /> Send WhatsApp Reminder (2Factor)
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full hover:bg-white flex items-center justify-center text-slate-400 hover:text-slate-600"
          >
            <CollectionIcon name="x" size={15} />
          </button>
        </div>
        <div className="p-5 space-y-3.5">
          {/* Client & Balance Bar */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs">
            <div>
              <div className="text-slate-400 font-medium">Client</div>
              <div className="font-bold text-slate-800 text-sm">{clientName}</div>
              <div className="text-[11px] text-slate-500 font-semibold mt-0.5">
                Ref: <span className="font-mono text-emerald-700">{jobIdentifier}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-slate-400 font-medium">Pending Balance</div>
              <div className="font-extrabold text-emerald-700 text-sm font-mono">{inr(pendingAmt)}</div>
              <div className="text-[10px] text-slate-400">Total: {inr(totalAmt)}</div>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              WhatsApp Mobile Number <span className="text-rose-500">*</span>
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 9876543210"
              className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 font-semibold"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Supports 10-digit Indian numbers (country code 91 is automatically added).
            </p>
          </div>

          {/* 2Factor Live Template Preview */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
              💬 2Factor WhatsApp Template Preview (Live)
            </label>
            <div className="bg-slate-100/80 rounded-xl p-3 border border-slate-200">
              <div className="bg-[#DCF8C6] p-3 rounded-lg rounded-tr-none shadow-xs text-xs text-slate-800 leading-relaxed font-sans max-w-[95%]">
                <div>Hello <strong className="text-emerald-900">{clientName}</strong>,</div>
                <div>Reminder from <strong>*RD Custom Awards*</strong>:</div>
                <div className="my-1">
                  A pending balance of <strong className="text-rose-700">*{inr(pendingAmt)}*</strong> is due for your Order <strong className="text-teal-800">*#{jobIdentifier}*</strong> (Total: {inr(totalAmt)}).
                </div>
                <div>Kindly clear the balance for prompt delivery.</div>
                <div className="mt-1">Thank you!</div>
                <div className="text-slate-600">Accounts Team, RD Custom Awards</div>
                <div className="text-right text-[10px] text-slate-400 mt-1">Just now · ✓✓</div>
              </div>
            </div>
          </div>

        </div>

        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isSending}
            className="text-xs font-semibold text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-200 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSend2Factor}
            disabled={isSending || !phone.trim()}
            className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition"
            style={{
              background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)",
            }}
          >
            <CollectionIcon name="send" size={13} />
            {isSending ? "Dispatching 2Factor..." : "Send Reminder (2Factor)"}
          </button>
        </div>
      </div>
    </div>
  );
}
