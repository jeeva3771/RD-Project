import React, { useState } from "react";
import { axiosInstance } from "../../../../../utils/url/config";
import { toast } from "react-toastify";
import CommunicationLogForm from "../../common/CommunicationLogForm";
import DeliveryApprovalHistoryModal from "./DeliveryApprovalHistoryModal";
import ReRequestDeliveryModal from "./ReRequestDeliveryModal";

/**
 * DeliveryChargesBlock
 * Handles estimation requests, approvals, invalidation upon address changes,
 * and historical audit trail for delivery/freight charges.
 */
export default function DeliveryChargesBlock({
  s,
  set,
  client,
  ids,
  isS,
  activeSampleAddr,
  activeFinalAddr,
  onOpenPreview,
}) {
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showReRequestModal, setShowReRequestModal] = useState(false);
  const [reRequestDefaultReason, setReRequestDefaultReason] = useState("address_change");

  const carrier = s.delivCarrier || s.sampleCarrier;
  if (!carrier || !["Tempo", "Porter", "Courier", "Air cargo"].includes(carrier)) {
    return null;
  }

  const targetId = s.rawJob?._id || s._id || ids?.enq || s.e?.enquiry_no;
  const targetAddr = activeSampleAddr || activeFinalAddr || s.sampleAddress;
  const payer = (s.sampleFreight === "RD pays freight" || s.delivPayer === "rd") ? "rd" : "client";
  const historyList = s.delivery_charges?.approval_history || s.rawJob?.delivery_charges?.approval_history || [];

  // 1. Initial estimation request to Packing Team
  const handleInitialRequest = async () => {
    if (!targetAddr && !s.sampleShipTo && !s.shipTo) {
      toast.error("Please select or confirm the destination delivery address first");
      return;
    }

    try {
      const payload = {
        carrier,
        payer,
        destination_area: s.sampleArea || "Local",
        destination_city: s.sampleCity || targetAddr?.city || "",
        address_snapshot: {
          label: targetAddr?.label || s.sampleShipTo || "",
          full_address: targetAddr?.address || s.shipTo || targetAddr?.label || "",
          city: targetAddr?.city || s.sampleCity || "",
          pin: targetAddr?.pin || "",
          site_contact: targetAddr?.contact || s.sampleReceiver || client?.contact_person || "",
          site_phone: targetAddr?.phone || client?.mobile || "",
        },
        when: s.sampleWhen || "Office hours",
        notes: s.sampleDeliveryNotes || "",
      };

      const res = await axiosInstance.post(`/enquiry-flow-integration/${targetId}/request-delivery-charge`, payload);
      if (res.data?.success) {
        toast.success("Delivery charge estimation request sent to Packing Team!");
        set({
          sampleChargesState: "requested",
          sampleFreight: payer === "client" ? "Client pays freight" : "RD pays freight",
          delivPayer: payer,
          delivCarrier: carrier,
          sampleCarrier: carrier,
          sampleChargesAmount: 0,
          delivery_charges: res.data.data?.delivery_charges,
        });
      } else {
        toast.error(res.data?.message || "Failed to send request");
      }
    } catch (err) {
      console.error("Error requesting delivery charge:", err);
      toast.error(err.response?.data?.message || "Server error requesting delivery charge");
    }
  };

  // 2. Submit Re-request (Address Changed or Client Requested Changes)
  const handleReRequestConfirm = async ({ reason, notes }) => {
    try {
      const payload = {
        carrier,
        payer,
        destination_area: s.sampleArea || "Local",
        destination_city: s.sampleCity || targetAddr?.city || "",
        address_snapshot: {
          label: targetAddr?.label || s.sampleShipTo || "",
          full_address: targetAddr?.address || s.shipTo || targetAddr?.label || "",
          city: targetAddr?.city || s.sampleCity || "",
          pin: targetAddr?.pin || "",
          site_contact: targetAddr?.contact || s.sampleReceiver || client?.contact_person || "",
          site_phone: targetAddr?.phone || client?.mobile || "",
        },
        when: s.sampleWhen || "Office hours",
        notes: notes || "",
        re_request_reason: reason,
        re_request_notes: notes || "",
      };

      const res = await axiosInstance.post(`/enquiry-flow-integration/${targetId}/request-delivery-charge`, payload);
      if (res.data?.success) {
        toast.success(res.data.message || "Re-request sent to Packing team!");
        set({
          sampleChargesState: "requested",
          sampleChargesAmount: 0,
          sampleApprovalMethod: null,
          delivery_charges: res.data.data?.delivery_charges,
        });
      } else {
        toast.error(res.data?.message || "Failed to submit re-request");
      }
    } catch (err) {
      console.error("Error submitting delivery re-request:", err);
      toast.error(err.response?.data?.message || "Server error submitting re-request");
    }
  };

  // 3. Coordinator logs / approves rate directly
  const handleApproveByCS = async (approvalMethod, notes = "") => {
    try {
      const res = await axiosInstance.post(`/enquiry-flow-integration/${targetId}/approve-delivery-charge`, {
        approval_method: approvalMethod,
        approval_notes: notes,
        amount: s.sampleChargesAmount,
      });

      if (res.data?.success) {
        toast.success(`Delivery charge approved via ${approvalMethod}!`);
        set({
          sampleApprovalMethod: approvalMethod,
          sampleChargesState: "approved",
          delivery_charges: res.data.data?.delivery_charges,
        });
      } else {
        toast.error(res.data?.message || "Failed to record approval");
      }
    } catch (err) {
      console.error("Error approving delivery charge:", err);
      // Fallback local update
      set({
        sampleApprovalMethod: approvalMethod,
        sampleChargesState: "approved",
      });
      toast.success(`Delivery charge approved via ${approvalMethod}`);
    }
  };

  return (
    <div className="grid grid-cols-[90px_1fr] gap-3 items-start py-4 border-t border-gray-100 min-h-[60px]">
      <div className="text-[10px] font-bold text-gray-500 mt-2">Charges</div>

      {/* 1. INITIAL / UNREQUESTED */}
      {!s.sampleChargesState && (
        <div className="space-y-2 mt-1">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              className="px-4 py-2 text-xs font-bold text-amber-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 rounded-xl transition shadow-xs cursor-pointer flex items-center gap-2"
              onClick={handleInitialRequest}
            >
              <span>🚚</span> Request Delivery Rate from Packing Team
            </button>
            <span className="text-[11px] text-gray-500 font-medium">
              Estimate must be provided by the Packing &amp; Logistics team.
            </span>
          </div>
          <div className="text-[10px] text-amber-700 font-medium">
            ⚠️ Delivery rate request must be sent to the Packing team before reviewing ticket.
          </div>

          {/* History link if past approvals exist */}
          {historyList.length > 0 && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowHistoryModal(true)}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline flex items-center gap-1.5 cursor-pointer"
              >
                <span>📜</span>
                <span>View Previous Delivery Approval History ({historyList.length})</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2. REQUESTED: Awaiting Rate from Packing */}
      {s.sampleChargesState === "requested" && (
        <div className="space-y-2 mt-1">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="px-3.5 py-1.5 text-[11px] font-bold bg-[#FFF8D6] text-[#A67C00] rounded-xl flex items-center gap-2 border border-amber-200 shadow-2xs">
              <span className="animate-spin text-xs">⏳</span>
              <span>Requested from Packing Team &middot; Awaiting estimation</span>
            </div>
            <button
              type="button"
              className="px-3 py-1.5 text-[10px] font-semibold text-gray-700 border border-gray-200 rounded-xl bg-white hover:bg-gray-50 transition shadow-2xs cursor-pointer"
              onClick={() => {
                setReRequestDefaultReason("address_change");
                setShowReRequestModal(true);
              }}
              title="Re-send request with updated address"
            >
              🔄 Re-request / Update Details
            </button>
          </div>
          <div className="text-[10px] text-gray-500">
            The Packing team will inspect items, weight, and destination to provide the exact delivery rate.
          </div>

          {/* History link */}
          {historyList.length > 0 && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowHistoryModal(true)}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline flex items-center gap-1.5 cursor-pointer"
              >
                <span>📜</span>
                <span>View Previous Delivery Approval History ({historyList.length})</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. SIMULATED / AWAITING APPROVAL / SELECTING MODE / APPROVED */}
      {(s.sampleChargesState === "simulated" ||
        s.sampleChargesState === "awaiting_approval" ||
        s.sampleChargesState === "selecting_approval_mode" ||
        s.sampleChargesState === "approved") && (
        <div className="flex flex-col gap-2 mt-0.5">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-baseline gap-1.5">
              <div className="text-[11px] font-extrabold text-gray-900">
                ₹{Number(s.sampleChargesAmount || 0).toLocaleString("en-IN")}
              </div>
              <span className="text-[11px] font-medium text-gray-500 ml-1">
                + GST · {s.delivCarrier || s.sampleCarrier || "Carrier"}
                {s.sampleCourierPartner ? ` (${s.sampleCourierPartner})` : ""} · DC/
                {ids?.enq?.replace("RD", "") || "21071"}
                {isS ? "-S" : "-P"}
              </span>
            </div>

            {s.sampleFreight === "Client pays freight" || s.delivPayer === "client" ? (
              <div className="px-2.5 py-0.5 text-[10px] font-bold bg-[#FFF8D6] text-[#A67C00] rounded-full">
                Client pays · added to invoice
              </div>
            ) : (
              <div className="px-2.5 py-0.5 text-[10px] font-bold bg-purple-100 text-purple-700 rounded-full">
                RD pays · logged to job cost
              </div>
            )}

            {/* Re-request button */}
            <button
              type="button"
              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer ml-1"
              onClick={() => {
                setReRequestDefaultReason(s.sampleChargesState === "approved" ? "address_change" : "client_revision");
                setShowReRequestModal(true);
              }}
              title="Re-request estimation from Packing team"
            >
              Re-request from Packing
            </button>
          </div>

          {/* SIMULATED: Awaiting fresh approval from client or CS */}
          {s.sampleChargesState === "simulated" && (
            <div className="space-y-2 mt-1">
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  className="px-4 py-1.5 text-[11px] font-bold bg-amber-400 text-amber-900 hover:bg-amber-500 rounded-lg shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                  onClick={onOpenPreview}
                >
                  <span>📤</span> Share Rate with Client for Approval
                </button>
                <button
                  type="button"
                  className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 cursor-pointer"
                  onClick={() => set({ sampleChargesState: "selecting_approval_mode" })}
                >
                  Log client approval
                </button>
                <button
                  type="button"
                  className="text-[11px] font-medium text-gray-400 hover:text-gray-600 cursor-pointer"
                  onClick={() => set({ sampleChargesState: undefined, sampleChargesAmount: "" })}
                >
                  Reset
                </button>
              </div>
              {s.sampleFreight === "Client pays freight" || s.delivPayer === "client" ? (
                <div className="text-[10px] text-gray-500">
                  Client pays · share quotation/delivery link to obtain client approval.
                </div>
              ) : (
                <div className="text-[10px] text-gray-500">
                  RD is paying this freight. Should the client pay instead?{" "}
                  <button
                    type="button"
                    className="font-bold text-indigo-700 hover:text-indigo-900 cursor-pointer"
                    onClick={() => set({ sampleFreight: "Client pays freight", delivPayer: "client" })}
                  >
                    Switch to client pays
                  </button>
                </div>
              )}
            </div>
          )}

          {/* AWAITING APPROVAL: Sent to client */}
          {s.sampleChargesState === "awaiting_approval" && (
            <div className="space-y-2 mt-1">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="px-3 py-1.5 text-[10px] font-bold bg-[#FFF8D6] text-[#A67C00] rounded-lg">
                  Sent via {s.sampleChargesSentVia || "WhatsApp"} · awaiting OK
                </div>
                <button
                  type="button"
                  className="px-4 py-1.5 text-[10px] font-bold bg-[#059669] text-white hover:bg-emerald-700 rounded-lg shadow-2xs transition cursor-pointer flex items-center gap-1"
                  onClick={() => set({ sampleChargesState: "selecting_approval_mode" })}
                >
                  <span>✓</span> Client approved charges
                </button>
                <button
                  type="button"
                  className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 cursor-pointer"
                  onClick={onOpenPreview}
                >
                  Resend / Share link
                </button>
                <button
                  type="button"
                  className="text-[11px] font-medium text-gray-400 hover:text-gray-600 cursor-pointer"
                  onClick={() => set({ sampleChargesState: undefined, sampleChargesAmount: "" })}
                >
                  Reset
                </button>
              </div>
              {s.sampleFreight === "Client pays freight" || s.delivPayer === "client" ? (
                <div className="text-[10px] text-gray-500">
                  Once approved, the charges go on the invoice.
                </div>
              ) : (
                <div className="text-[10px] text-gray-500">
                  RD is paying this freight. Logged to job cost.
                </div>
              )}
            </div>
          )}

          {/* SELECTING APPROVAL MODE: Communication log */}
          {s.sampleChargesState === "selecting_approval_mode" && (
            <CommunicationLogForm
              client={client}
              mode="delivery-charges"
              feedbackMode="approve"
              amount={s.sampleChargesAmount}
              onBack={() => set({ sampleChargesState: "awaiting_approval" })}
              onLog={(logData) => {
                let methodText = "Hand-delivered / other";
                if (logData.method === "whatsapp") methodText = "WhatsApp";
                else if (logData.method === "email") methodText = "Email";
                else if (logData.method === "verbal") methodText = "Verbal";
                else if (logData.method === "written") methodText = "Written / PO";
                else if (logData.method === "screenshot") methodText = "Screenshot";

                handleApproveByCS(methodText, logData.notes || "");
              }}
            />
          )}

          {/* APPROVED */}
          {s.sampleChargesState === "approved" && (
            <div className="space-y-1 mt-1">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="px-3 py-1.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-lg flex items-center gap-1.5">
                  <span>✓</span> Approved via {s.sampleApprovalMethod || "WhatsApp"}
                </div>
                <button
                  type="button"
                  className="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 cursor-pointer"
                  onClick={onOpenPreview}
                >
                  View sheet
                </button>
                <button
                  type="button"
                  className="text-[10px] font-medium text-gray-400 hover:text-gray-600 cursor-pointer"
                  onClick={() => set({ sampleChargesState: undefined, sampleChargesAmount: "" })}
                >
                  Reset
                </button>
              </div>
              {s.sampleFreight === "Client pays freight" || s.delivPayer === "client" ? (
                <div className="text-[10px] text-gray-500">
                  The charges (₹{s.sampleChargesAmount} + 18% GST) will be added to the invoice.
                </div>
              ) : (
                <div className="text-[10px] text-gray-500">
                  Logged to job cost (borne by RD).
                </div>
              )}
            </div>
          )}

          {/* History link */}
          {historyList.length > 0 && (
            <div className="pt-1.5 border-t border-gray-100/80">
              <button
                type="button"
                onClick={() => setShowHistoryModal(true)}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline flex items-center gap-1.5 cursor-pointer"
              >
                <span>📜</span>
                <span>View Previous Delivery Approval History ({historyList.length})</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* History Modal */}
      <DeliveryApprovalHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        history={historyList}
      />

      {/* Re-request Modal */}
      <ReRequestDeliveryModal
        isOpen={showReRequestModal}
        onClose={() => setShowReRequestModal(false)}
        onConfirm={handleReRequestConfirm}
        currentAmount={s.sampleChargesAmount}
        oldAddress={targetAddr?.label || targetAddr?.address || s.shipTo || ""}
        newAddress=""
        defaultReason={reRequestDefaultReason}
      />
    </div>
  );
}
