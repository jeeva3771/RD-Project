import React, { useState } from "react";
import { toast } from "react-toastify";
import { axiosInstance } from "../../../../../utils/url/config";
import { inr } from "../../utils/collectionsFormatters";
import CollectionIcon from "../common/CollectionIcon";

export default function EmailComposeModal({
  caseObj,
  onClose,
  onSent,
  subjectOverride,
  bodyOverride,
}) {
  const defaultSubject =
    subjectOverride ||
    "Payment Reminder — Outstanding Invoices (" + inr(caseObj.total) + ")";
  const defaultBody =
    bodyOverride ||
    "Dear " +
    caseObj.contact.contactPerson +
    ",\n\nThis is a reminder that your account currently has " +
    inr(caseObj.total) +
    " outstanding" +
    (caseObj.oldest > 0
      ? ", with the oldest invoice overdue by " + caseObj.oldest + " days."
      : ".") +
    " Kindly arrange payment at the earliest, or let us know a suitable date.\n\nRegards,\n" +
    caseObj.owner +
    "\nRD Custom Awards Pvt. Ltd.";

  const [to, setTo] = useState(caseObj.contact.email || "");
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [isSending, setIsSending] = useState(false);

  const mailtoHref =
    "mailto:" +
    encodeURIComponent(to) +
    "?subject=" +
    encodeURIComponent(subject) +
    "&body=" +
    encodeURIComponent(body);

  const handleSendEmail = async () => {
    if (!to || !to.trim()) {
      toast.warning("Please enter a valid recipient email address");
      return;
    }

    setIsSending(true);
    try {
      const res = await axiosInstance.post("/accounts/send-email-reminder", {
        to: to.trim(),
        subject: subject.trim(),
        body: body.trim(),
        client_name: caseObj.client,
        outstanding: caseObj.total,
        amount: caseObj.total,
        invoices: caseObj.invoices || [],
        caseId: caseObj.id,
      });

      if (res.data?.success) {
        toast.success(`Payment reminder email sent successfully to ${to}!`);
        if (onSent) onSent(subject, to);
      } else {
        toast.error(res.data?.message || "Failed to send email reminder");
      }
    } catch (err) {
      console.error("Error sending email reminder:", err);
      toast.error(err.response?.data?.message || err.message || "Failed to send email");
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
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-amber-50/70">
          <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
            <CollectionIcon name="mail" size={16} className="text-amber-600" /> Send Email Reminder (Nodemailer)
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full hover:bg-white flex items-center justify-center text-slate-400 hover:text-slate-600"
          >
            <CollectionIcon name="x" size={15} />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              To Email <span className="text-rose-500">*</span>
            </label>
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="client@company.com"
              className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-200"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Subject Line
            </label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-200"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Message Body (Will be formatted into branded HTML email)
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-200"
            />
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-200/80 p-2.5 text-[11px] text-amber-900 flex items-center justify-between">
            <span>Outstanding Balance: <strong>{inr(caseObj.total)}</strong></span>
            <span className="text-[10px] text-amber-700">Includes Official Logo &amp; Invoice Breakdown</span>
          </div>
        </div>
        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
          <a
            href={mailtoHref}
            onClick={() => onSent && onSent(subject, to)}
            className="text-xs font-semibold text-slate-600 hover:text-slate-800 flex items-center gap-1 transition"
            title="Open locally in Outlook / Thunderbird"
          >
            <CollectionIcon name="tag" size={12} /> Open in Email App
          </a>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isSending}
              className="text-xs font-semibold text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-200 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSendEmail}
              disabled={isSending}
              className="text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition"
            >
              <CollectionIcon name="mail" size={13} />
              {isSending ? "Sending Mail..." : "Send Reminder"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
