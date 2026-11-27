import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { axiosInstance } from "../../../../utils/url/config";
import { useLoader } from "../../../../context/LoaderContext";

export default function EmailReminderModal({ target, onClose }) {
  const { showLoader, hideLoader } = useLoader();
  const [toEmail, setToEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const clientName = target?.clientName || target?.client || "Valued Client";
  const jobNo = target?.sub_job_no || target?.job_no || "";
  const totalAmount = Number(target?.amount || target?.quotationTotal || target?.grandTotal || 0);
  const pendingBalance = Number(
    target?.outstanding !== undefined
      ? target?.outstanding
      : target?.due !== undefined
      ? target?.due
      : 0
  );

  const formattedTotal =
    totalAmount > 0
      ? totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "0.00";
  const formattedPending =
    pendingBalance > 0
      ? pendingBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "0.00";

  useEffect(() => {
    // Populate candidate email from target
    let candidateEmail = "";
    if (typeof target?.email === "string") {
      candidateEmail = target.email;
    } else if (Array.isArray(target?.email) && target.email.length > 0) {
      candidateEmail = target.email.join(", ");
    }
    setToEmail(candidateEmail !== "—" ? candidateEmail : "");

    const initialSubject = `Payment Reminder — Outstanding Balance of ₹ ${formattedPending} (Job #${jobNo})`;
    const initialBody = `Dear ${clientName},\n\nThis is a friendly reminder that your account currently has an outstanding balance of ₹ ${formattedPending} against Job #${jobNo} (Total Order: ₹ ${formattedTotal}).\n\nKindly arrange to transfer the pending amount at your earliest convenience to facilitate timely processing/delivery.\n\nThank you for your business!\n\nRegards,\nAccounts & Finance Department\nRD Custom Awards Pvt. Ltd.`;

    setSubject(initialSubject);
    setMessage(initialBody);
  }, [target, clientName, jobNo, formattedPending, formattedTotal]);

  const handleSendReminder = async () => {
    if (!toEmail || !toEmail.trim()) {
      toast.warning("Please provide a valid recipient email address.");
      return;
    }

    setIsSending(true);
    showLoader();
    setStatusMessage(null);

    try {
      const res = await axiosInstance.post("/accounts/send-email-reminder", {
        to: toEmail.trim(),
        subject: subject.trim(),
        body: message.trim(),
        client_name: clientName,
        job_no: target?.job_no,
        sub_job_no: target?.sub_job_no,
        amount: totalAmount,
        outstanding: pendingBalance,
        invoices: target?.invoices || [],
      });

      if (res.data?.success) {
        toast.success(`Payment reminder email sent successfully to ${toEmail}!`);
        setStatusMessage({
          type: "success",
          text: `✅ Payment reminder email successfully sent to ${toEmail} via Nodemailer!`,
        });
      } else {
        toast.error(res.data?.message || "Could not send email reminder");
        setStatusMessage({
          type: "error",
          text: "⚠️ Failed: " + (res.data?.message || "Could not send email reminder"),
        });
      }
    } catch (err) {
      console.error("Error sending email reminder:", err);
      const errMsg = err.response?.data?.message || err.message;
      toast.error(errMsg);
      setStatusMessage({
        type: "error",
        text: "⚠️ Error: " + errMsg,
      });
    } finally {
      setIsSending(false);
      hideLoader();
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "600px",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
          animation: "scaleIn 0.2s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "16px 22px",
            background: "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)",
            borderBottom: "1.5px solid #FDE68A",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "20px" }}>✉️</span>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: "15px",
                  fontWeight: 900,
                  color: "#92400E",
                  letterSpacing: "-0.2px",
                }}
              >
                Send Email Payment Reminder
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#B45309", fontWeight: 600 }}>
                Powered by Nodemailer &amp; RD Custom Awards Mail Server
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "white",
              border: "1px solid #FDE68A",
              borderRadius: "50%",
              width: "28px",
              height: "28px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#92400E",
              fontSize: "16px",
              fontWeight: 800,
            }}
          >
            ×
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "18px 22px", overflowY: "auto", flex: 1 }}>
          {/* Target Account Summary Banner */}
          <div
            style={{
              background: "#F8FAFC",
              border: "1.5px solid #E2E8F0",
              borderRadius: "12px",
              padding: "12px 16px",
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <div>
              <div style={{ fontSize: "11px", color: "#64748B", fontWeight: 700, textTransform: "uppercase" }}>
                Client / Account
              </div>
              <div style={{ fontSize: "14px", fontWeight: 900, color: "#0F172A", marginTop: "2px" }}>
                {clientName}
              </div>
              <div style={{ fontSize: "11px", color: "#64748B", marginTop: "2px", fontWeight: 600 }}>
                Job: <span style={{ fontFamily: "monospace", color: "#0284C7", fontWeight: 800 }}>{jobNo}</span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "11px", color: "#64748B", fontWeight: 700, textTransform: "uppercase" }}>
                Outstanding Due
              </div>
              <div
                style={{
                  fontSize: "18px",
                  fontWeight: 900,
                  color: "#B45309",
                  fontFamily: "monospace",
                  marginTop: "2px",
                }}
              >
                ₹ {formattedPending}
              </div>
              <div style={{ fontSize: "10.5px", color: "#94A3B8" }}>Total Order: ₹ {formattedTotal}</div>
            </div>
          </div>

          {/* Form Fields */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* Recipient To Field */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "11.5px",
                  fontWeight: 800,
                  color: "#334155",
                  textTransform: "uppercase",
                  marginBottom: "4px",
                }}
              >
                To Email Address <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <input
                type="text"
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
                placeholder="accounts@client.com, contact@client.com"
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: "1.5px solid #CBD5E1",
                  fontSize: "13px",
                  outline: "none",
                  boxSizing: "border-box",
                  color: "#0F172A",
                }}
              />
            </div>

            {/* Subject Field */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "11.5px",
                  fontWeight: 800,
                  color: "#334155",
                  textTransform: "uppercase",
                  marginBottom: "4px",
                }}
              >
                Subject Line
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: "1.5px solid #CBD5E1",
                  fontSize: "13px",
                  outline: "none",
                  boxSizing: "border-box",
                  color: "#0F172A",
                  fontWeight: 600,
                }}
              />
            </div>

            {/* Message Body Field */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "11.5px",
                  fontWeight: 800,
                  color: "#334155",
                  textTransform: "uppercase",
                  marginBottom: "4px",
                }}
              >
                Message Content (Included in branded template)
              </label>
              <textarea
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1.5px solid #CBD5E1",
                  fontSize: "12.5px",
                  lineHeight: "1.5",
                  outline: "none",
                  boxSizing: "border-box",
                  color: "#0F172A",
                  resize: "vertical",
                }}
              />
            </div>

            {/* Feature Note Banner */}
            <div
              style={{
                background: "#FEF3C7",
                border: "1px solid #FDE68A",
                borderRadius: "8px",
                padding: "8px 12px",
                fontSize: "11px",
                color: "#92400E",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>✨</span>
              <span>
                Sent as a professional branded HTML email with the <strong>RD Custom Awards logo</strong>, official
                signature, and pending balance breakdown.
              </span>
            </div>

            {/* Status Message */}
            {statusMessage && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: 800,
                  background: statusMessage.type === "success" ? "#ECFDF5" : "#FEF2F2",
                  border: "1.5px solid " + (statusMessage.type === "success" ? "#A7F3D0" : "#FECACA"),
                  color: statusMessage.type === "success" ? "#065F46" : "#B91C1C",
                }}
              >
                {statusMessage.text}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "12px 22px",
            background: "#F8FAFC",
            borderTop: "1.5px solid #E2E8F0",
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isSending}
            style={{
              padding: "8px 16px",
              background: "white",
              border: "1px solid #CBD5E1",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 700,
              color: "#64748B",
              cursor: "pointer",
            }}
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleSendReminder}
            disabled={isSending || !toEmail}
            style={{
              padding: "8px 18px",
              background: "linear-gradient(135deg, #D97706 0%, #B45309 100%)",
              border: "none",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 900,
              color: "white",
              cursor: isSending || !toEmail ? "not-allowed" : "pointer",
              opacity: isSending || !toEmail ? 0.6 : 1,
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: "0 2px 8px rgba(180, 83, 9, 0.35)",
            }}
          >
            {isSending ? "⏳ Sending Email..." : "✉️ Send Email (Nodemailer)"}
          </button>
        </div>
      </div>
    </div>
  );
}

