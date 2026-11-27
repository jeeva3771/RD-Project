import React, { useState } from "react";
import { dfmt, todayISO, contactsOf, formatEnquiryNo, deriveDocNo } from "../../utils/helpers";

/**
 * Reusable Approval History & Proof Badge Component
 * Displays distinct audit trails for:
 * 1. Client Direct Approval (via online link - showing who it was shared to, medium, sender, decision time, and client notes)
 * 2. Client Servicing / Admin Logged Approval (showing staff name, client contact who confirmed, channel, timestamp, and message/proof)
 */
const ApprovalHistoryProof = ({
  type = "pi", // "pi" | "design" | "sample" | "delivery" | "enquiry"
  title = "Quotation & proforma approved",
  data = null, // e.g. s.costOk, s.sampleOk, s.ppOk, fb
  s = {},
  client = {},
  docNo = "",
  docLabel = "",
  onViewDoc = null,
  collapsible = true,
  defaultOpen = false,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // 1. Resolve Contact & Staff details
  const contacts = client ? contactsOf(client, s) : [];
  const primaryContact = contacts.find((c) => c.id === s.contactId) || contacts[0] || {};
  const clientPhone = primaryContact.mobile || primaryContact.phone || client?.mobile || client?.mobile_no || s.e?.contactMobile || "";
  const clientEmail = primaryContact.email || client?.email || s.e?.contactEmail || "";
  const clientContactName = primaryContact.name || client?.contact || client?.name || s.e?.contactPerson || "Client";
  const coordinatorName = s.coordinator || s.created_by_name || "Client Servicing";
  const parentJobCode = s?.seq ? formatEnquiryNo(s.seq) : (s.enquiry_no || s.id || "RD26004");
  const effectiveDocNo = docNo || (type === "pi" ? (s.pi?.no || deriveDocNo(parentJobCode, "PI")) : "");

  // 2. Determine Approval Mode: Client Direct vs CS/Admin Logged
  const isClientDirect = Boolean(
    data?.method === "client_link" ||
    data?.approval_type === "client_direct" ||
    data?.channel === "Client Link (Direct)" ||
    (type === "pi" && (s.clientApprovedVia === "Client Link" || s.pi?.client_decision?.decision === "approved")) ||
    (type === "design" && s.designApprovedVia === "Client Link") ||
    (type === "sample" && s.sampleApprovedVia === "Client Link")
  );

  // 3. Resolve Channel / Method Details
  const rawMethod = data?.method || (type === "pi" ? s.pi?.sent : "") || (isClientDirect ? "Online Link" : "WhatsApp");
  const methodLabel = rawMethod === "client_link"
    ? "Online Link"
    : rawMethod === "whatsapp"
    ? "WhatsApp"
    : rawMethod === "email"
    ? "Email"
    : rawMethod === "verbal"
    ? "Phone Call (Verbal)"
    : rawMethod === "written"
    ? "Purchase Order (PO)"
    : rawMethod.charAt(0).toUpperCase() + rawMethod.slice(1);

  const channelIcon = rawMethod === "client_link"
    ? "🔗"
    : rawMethod === "email"
    ? "✉️"
    : rawMethod === "verbal"
    ? "📞"
    : rawMethod === "written"
    ? "📋"
    : "💬";

  // 4. Resolve Date & Time
  const approvedDateStr = data?.date
    ? `${dfmt(data.date)} ${data.time || ""}`
    : data?.at
    ? new Date(data.at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : (type === "pi" && s.pi?.client_decision?.at)
    ? new Date(s.pi.client_decision.at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : (s.clientApprovedAt)
    ? new Date(s.clientApprovedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : (s.createdAt)
    ? new Date(s.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : `${dfmt(todayISO())} 12:00`;

  // 5. Client Direct Approval Metadata (Who shared to, which channel, sent by whom)
  const sharedToName = primaryContact.name || client?.contact || client?.name || "Client";
  const sharedToAddress = (type === "pi" && s.pi?.sent_to) || (rawMethod === "email" ? clientEmail : clientPhone);
  const sharedChannel = (type === "pi" && s.pi?.sent) || (s.pi?.sent_to?.includes("@") ? "Email" : "WhatsApp");
  const sharedBy = (type === "pi" && s.pi?.sent_by) || coordinatorName;
  const sharedAt = (type === "pi" && s.pi?.sent_at)
    ? new Date(s.pi.sent_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "";

  const clientDecisionBy = (type === "pi" && s.pi?.client_decision?.by) || data?.whoConfirmed || sharedToName;
  const clientDirectComment = (type === "pi" && s.pi?.client_decision?.notes) || data?.notes || "";

  // 6. CS / Admin Logged Metadata
  const staffName = data?.logged_by || data?.loggedBy || s.coordinator || s.created_by_name || coordinatorName;
  const staffRole = data?.logged_by_role || (staffName.toLowerCase().includes("admin") ? "Admin" : "Client Servicing");
  const whoConfirmedContact = data?.whoConfirmed || clientContactName;
  const contactPhoneDisplay = data?.waNumber ? `+91 ${data.waNumber}` : (clientPhone || "Phone on file");

  // Resolve comment / message text
  const staffLoggedComment = data?.waMessage ||
    data?.emailKeyLines ||
    data?.verbalSay ||
    (data?.poNumber ? `PO Number: ${data.poNumber}` : "") ||
    data?.notes ||
    data?.feedbackDetails ||
    (type === "enquiry"
      ? "Enquiry confirmed with client."
      : type === "pi"
      ? (effectiveDocNo ? `Quotation approved. Proforma invoice ${effectiveDocNo} accepted.` : "Quotation & proforma approved.")
      : type === "sample"
      ? "Sample approved. Proceed with production."
      : "Confirmed by client.");

  const proofAttachment = data?.attachment?.url || data?.attachment || null;

  return (
    <div className={`text-left ${className}`}>
      {/* Top Header Row with Title and Toggle */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="font-bold text-sm text-indigo-900">{title}</div>
          {isClientDirect ? (
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold inline-flex items-center gap-1">
              <span>🟢</span> Client Direct Approval
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300 text-[10px] font-bold inline-flex items-center gap-1">
              <span>🔵</span> Logged by {staffRole}
            </span>
          )}
        </div>

        {collapsible && (
          <button
            type="button"
            className="text-[11px] font-bold text-indigo-700 hover:underline cursor-pointer shrink-0 ml-2"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? "Hide proof" : "View proof"}
          </button>
        )}
      </div>

      {/* Subtitle / Doc reference line */}
      <div className="text-[10px] text-gray-400 mt-0.5 mb-1 flex items-center gap-1.5 flex-wrap">
        <span>
          {channelIcon} {isClientDirect ? `Online Link (${sharedChannel})` : methodLabel} · {approvedDateStr}
        </span>
        {effectiveDocNo && (
          <>
            <span>· view doc:</span>
            {onViewDoc ? (
              <button
                type="button"
                onClick={onViewDoc}
                className="text-indigo-600 hover:text-indigo-900 font-bold underline cursor-pointer"
              >
                {effectiveDocNo}
              </button>
            ) : (
              <span className="text-indigo-600 font-bold">{effectiveDocNo}</span>
            )}
          </>
        )}
      </div>

      {/* Collapsible Proof Breakdown Card */}
      {(!collapsible || isOpen) && (
        <div className="text-[11px] text-gray-800 bg-gray-50/90 p-3.5 rounded-xl border border-gray-200 mt-2 space-y-2.5 shadow-2xs">
          {/* Scenario A: Client Direct Online Approval */}
          {isClientDirect ? (
            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] p-2 bg-emerald-50/60 rounded-lg border border-emerald-100">
                <div>
                  <span className="text-gray-500 font-medium block">Shared to (Client):</span>
                  <b className="text-gray-900 font-semibold">{sharedToName}</b>
                  <div className="text-gray-600 font-mono text-[10px]">{sharedToAddress}</div>
                </div>
                <div>
                  <span className="text-gray-500 font-medium block">Shared by & Channel:</span>
                  <b className="text-gray-900 font-semibold">{sharedBy}</b>
                  <div className="text-gray-600 text-[10px]">
                    via {sharedChannel} {sharedAt ? `· on ${sharedAt}` : ""}
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center text-[10px] text-gray-600 font-medium px-1">
                <span>
                  <b>Confirmed online by:</b> {clientDecisionBy}
                </span>
                <span>{approvedDateStr}</span>
              </div>

              {clientDirectComment ? (
                <div className="p-2.5 bg-white rounded-lg border border-gray-200 text-gray-800 italic">
                  "{clientDirectComment}"
                </div>
              ) : (
                <div className="p-2.5 bg-white rounded-lg border border-gray-200 text-gray-600 italic text-[10px]">
                  "Client confirmed and approved via online secure proforma preview link."
                </div>
              )}
            </div>
          ) : (
            /* Scenario B: Client Servicing / Admin Logged Approval */
            <div className="space-y-2">
              <div className="flex flex-wrap justify-between items-center text-[10px] text-gray-500 font-medium gap-1 pb-1 border-b border-gray-200/60">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-gray-800">
                    {methodLabel} {contactPhoneDisplay}
                  </span>
                  <span className="text-gray-400">·</span>
                  <span className="text-gray-600">Confirmed by {whoConfirmedContact}</span>
                </div>
                <div className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                  Logged by {staffName} ({staffRole})
                </div>
              </div>

              <div className="p-2.5 bg-white rounded-lg border border-gray-200 text-gray-800 italic leading-relaxed">
                "{staffLoggedComment}"
              </div>

              {proofAttachment && (
                <div className="pt-1">
                  <a
                    href={typeof proofAttachment === "string" ? proofAttachment : proofAttachment?.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline"
                  >
                    📎 View uploaded proof attachment / screenshot →
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Action button to view linked document */}
          {onViewDoc && effectiveDocNo && (
            <div className="pt-1 border-t border-gray-200/60">
              <button
                type="button"
                onClick={onViewDoc}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer inline-flex items-center gap-1"
              >
                View document: {docLabel || "Document"} {effectiveDocNo} →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ApprovalHistoryProof;
