import React, { useEffect, useState, useCallback } from "react";
import { useParams, useLocation } from "react-router-dom";
import axios from "axios";
import { backendUrl } from "../../../utils/url/config";
import SampleProofSheet from "../components/Steps/SampleProofSheet";

const PublicSampleProofView = () => {
  const { jobId } = useParams();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // Active media preview
  const [lightboxImg, setLightboxImg] = useState(null);
  const [activeVideo, setActiveVideo] = useState(null);

  // Decision Modal State
  const [decisionModal, setDecisionModal] = useState(null); // "approved" | "revision" | "physical_required"
  const [notes, setNotes] = useState("");
  const [clientName, setClientName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);

  // 1. Expiry Check
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const encodedExpires = params.get("exp");
    const token = params.get("token");

    if (!encodedExpires && !token) {
      setExpired(true);
      setLoading(false);
      return;
    }

    if (encodedExpires) {
      try {
        const expiryTimestamp = parseInt(atob(encodedExpires), 10);
        if (isNaN(expiryTimestamp) || Date.now() > expiryTimestamp) {
          setExpired(true);
          setLoading(false);
          return;
        }
      } catch (e) {
        setExpired(true);
        setLoading(false);
        return;
      }
    }
  }, [location.search]);

  // 2. Fetch Sample Proof Data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const queryStr = location.search ? location.search : "";
      const res = await axios.get(
        `${backendUrl}/enquiry-flow-integration/public/sample-proof-view/${jobId}${queryStr}`
      );
      if (res.data?.success) {
        setData(res.data.data);
        if (res.data.data?.client_name) {
          setClientName(res.data.data.client_name);
        }
      } else {
        setError(res.data?.message || "Could not load sample proof details.");
      }
    } catch (err) {
      console.error("Error loading sample proof view:", err);
      setError("Unable to load sample proof. Please check the link or contact your coordinator.");
    } finally {
      setLoading(false);
    }
  }, [jobId, location.search]);

  useEffect(() => {
    if (!expired && jobId) {
      fetchData();
    }
  }, [jobId, expired, fetchData]);

  // 3. Security: Prevent Right Click
  useEffect(() => {
    const handler = (e) => e.preventDefault();
    document.addEventListener("contextmenu", handler);
    return () => document.removeEventListener("contextmenu", handler);
  }, []);

  // 4. Submit Feedback
  const handleSubmitDecision = async () => {
    if (!decisionModal) return;

    if (decisionModal === "revision" && !notes.trim()) {
      alert("Please provide instructions on what changes are needed.");
      return;
    }

    try {
      setSubmitting(true);
      const queryStr = location.search ? location.search : "";
      const res = await axios.post(
        `${backendUrl}/enquiry-flow-integration/public/sample-proof-feedback/${jobId}${queryStr}`,
        {
          decision: decisionModal,
          notes: notes.trim(),
          clientName: clientName.trim(),
          mode: data?.mode || "sample",
        }
      );

      if (res.data?.success) {
        if (decisionModal === "approved") {
          setSuccessMsg("✓ Thank you! Sample proof approved successfully. Bulk production will proceed.");
        } else if (decisionModal === "physical_required") {
          setSuccessMsg("✓ Request received. Our team will prepare the physical sample piece for dispatch.");
        } else {
          setSuccessMsg("✓ Alteration request submitted. Our production team will contact you shortly.");
        }
        setDecisionModal(null);
        setNotes("");
        await fetchData();
      } else {
        alert(res.data?.message || "Failed to submit feedback.");
      }
    } catch (err) {
      console.error("Error submitting sample proof feedback:", err);
      alert("Network error while submitting feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-bold text-gray-600">Loading sample proof photos & video...</p>
        </div>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md text-center space-y-3">
          <div className="text-4xl">⏳</div>
          <h2 className="text-lg font-bold text-gray-900">Link Expired</h2>
          <p className="text-xs text-gray-500">
            This sample inspection link has expired. Please contact your coordinator at RD Custom Awards to request a fresh link.
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md text-center space-y-3">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-lg font-bold text-gray-900">Proof Not Found</h2>
          <p className="text-xs text-gray-500">{error || "Could not retrieve sample details."}</p>
        </div>
      </div>
    );
  }

  const { enquiry_no, client_name, client_company, mode, products = [], approval_status = {} } = data;
  const isPP = mode === "pre_production";
  const isApproved = approval_status.is_approved;
  const isPhysicalRequested = approval_status.is_physical_requested;

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-3 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Top Header Card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🏆</span>
              <div>
                <h1 className="text-xl font-black text-gray-900 tracking-tight">RD Custom Awards Pvt. Ltd.</h1>
                <p className="text-xs text-gray-500 font-medium">
                  {isPP ? "Pre-Production Sample Piece Inspection" : `Sample v${data.round || 1} Production Proof & Inspection`}
                </p>
              </div>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-base font-black text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-200 inline-block">
              {enquiry_no}
            </span>
            <div className="text-xs text-gray-700 font-bold mt-1">{client_name}</div>
            <div className="text-[11px] text-gray-500">{client_company}</div>
          </div>
        </div>

        {/* Success Alert Banner */}
        {successMsg && (
          <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl text-emerald-900 font-bold text-xs shadow-xs animate-fade-in">
            {successMsg}
          </div>
        )}

        {/* Current Status Callout */}
        {isApproved ? (
          <div className="p-4 bg-emerald-500 text-white rounded-2xl shadow-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">✓</span>
              <div>
                <div className="font-extrabold text-sm">
                  {isPP ? "Pre-Production Sample Approved for Bulk Production" : `Sample v${data.round || 1} Production Approved`}
                </div>
                <div className="text-xs text-emerald-100">
                  Approved by {approval_status.approved_by || client_name} on{" "}
                  {approval_status.approved_at ? new Date(approval_status.approved_at).toLocaleDateString("en-IN") : "Record"}
                </div>
              </div>
            </div>
          </div>
        ) : isPhysicalRequested ? (
          <div className="p-4 bg-amber-500 text-white rounded-2xl shadow-sm space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xl">🚚</span>
              <div className="font-extrabold text-sm">Physical Sample Inspection Requested</div>
            </div>
            <p className="text-xs text-amber-100">
              You requested to inspect the physical sample piece before bulk production. Our dispatch team is handling packaging & delivery.
            </p>
            {approval_status.physical_dispatch && (
              <div className="mt-2 pt-2 border-t border-amber-400 text-xs text-white">
                <b>Carrier:</b> {approval_status.physical_dispatch.carrier} · <b>Docket:</b> {approval_status.physical_dispatch.ref}
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-start gap-3 text-xs text-indigo-950">
            <span className="text-lg">ℹ️</span>
            <div>
              <b>Review Instructions:</b> Please inspect the photos and rotating video clip for trophy finish, laser engraving clarity, logo alignment, and materials. You can approve directly online or request a physical piece delivery below.
            </div>
          </div>
        )}

        {/* Official Sample Proof Document Sheet matching Company Format */}
        <SampleProofSheet
          s={{
            seq: enquiry_no,
            mode: isPP ? "production" : "sample",
            uploadedDesigns: data?.uploadedDesigns || {},
            productFeedback: data?.productFeedback || {},
            orderItems: products.map((p) => ({
              subJobNo: p.sub_job_no,
              theme: p.theme,
              size: p.size,
              mat: p.material,
              spec: `${p.size} in · ${p.material}`,
              imgUrl: p.approved_design_url,
              approved_design_url: p.approved_design_url,
            })),
          }}
          client={data?.customer || { name: client_company, billing: "", gstin: "" }}
          customer={data?.customer}
          contact={data?.contact || { name: client_name }}
          coordinatorName={data?.coordinator_name || "Coordinator"}
          ids={{ enq: enquiry_no }}
          mode={mode}
          round={data?.round || 1}
          samplePhotos={(() => {
            const map = {};
            products.forEach((p) => {
              const k = p.sub_job_no || "item";
              map[k] = p.photos || [];
            });
            return map;
          })()}
          sampleVideos={(() => {
            const map = {};
            products.forEach((p) => {
              const k = p.sub_job_no || "item";
              map[k] = p.videos || [];
            });
            return map;
          })()}
          displayItems={products.map((p) => ({
            subJobNo: p.sub_job_no,
            theme: p.theme,
            size: p.size,
            mat: p.material,
            spec: `${p.size} in · ${p.material}`,
            imgUrl: p.approved_design_url,
            approved_design_url: p.approved_design_url,
          }))}
        />

        {/* Client Decision Action Deck (Only if not already approved) */}
        {!isApproved && (
          <div className="bg-white border-2 border-indigo-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Your Decision on the Sample Piece(s)</h3>
              <p className="text-xs text-gray-500">
                Please submit your approval to begin the bulk production run, or let us know if you need alterations or physical inspection.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDecisionModal("approved")}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-2"
              >
                <span>✓</span> Approve Sample for Bulk Production
              </button>

              <button
                type="button"
                onClick={() => setDecisionModal("revision")}
                className="px-5 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
              >
                Request Alterations / Changes
              </button>

              <button
                type="button"
                onClick={() => setDecisionModal("physical_required")}
                className="px-5 py-3 bg-amber-50 border border-amber-300 hover:bg-amber-100 text-amber-950 font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <span>📦</span> Request Physical Sample Delivery First
              </button>
            </div>
          </div>
        )}

        {/* Modal: Decision Confirmations */}
        {decisionModal && (
          <div
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            onClick={() => setDecisionModal(null)}
          >
            <div
              className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-scale-up"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-extrabold text-base text-gray-900">
                  {decisionModal === "approved"
                    ? "Confirm Sample Approval"
                    : decisionModal === "physical_required"
                    ? "Request Physical Sample Inspection"
                    : "Request Alterations"}
                </h3>
                <button
                  type="button"
                  onClick={() => setDecisionModal(null)}
                  className="text-gray-400 hover:text-gray-600 text-sm font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Your Name / Designation</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. Ramesh Patel"
                  className="w-full text-xs p-2.5 border border-gray-300 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  {decisionModal === "approved"
                    ? "Remarks (Optional)"
                    : decisionModal === "physical_required"
                    ? "Delivery address or special inspection notes"
                    : "Describe required changes (Mandatory)"}
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    decisionModal === "approved"
                      ? "e.g. Finish looks great! Proceed with bulk order."
                      : decisionModal === "physical_required"
                      ? "Please deliver 1 piece to our office address for management inspection."
                      : "e.g. Please increase laser contrast on the logo and adjust text margin."
                  }
                  className="w-full text-xs p-2.5 border border-gray-300 rounded-lg outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setDecisionModal(null)}
                  className="px-4 py-2 border border-gray-200 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSubmitDecision}
                  className={`px-5 py-2 text-white text-xs font-bold rounded-lg transition cursor-pointer disabled:opacity-50 ${
                    decisionModal === "approved"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : decisionModal === "physical_required"
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-indigo-600 hover:bg-indigo-700"
                  }`}
                >
                  {submitting ? "Submitting..." : "Submit Decision"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Lightbox Image */}
        {lightboxImg && (
          <div
            className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4 cursor-pointer"
            onClick={() => setLightboxImg(null)}
          >
            <div className="relative max-w-4xl max-h-[90vh]">
              <img src={lightboxImg} alt="Sample Proof Large" className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl" />
              <button
                type="button"
                onClick={() => setLightboxImg(null)}
                className="absolute top-2 right-2 text-white bg-black/60 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicSampleProofView;
