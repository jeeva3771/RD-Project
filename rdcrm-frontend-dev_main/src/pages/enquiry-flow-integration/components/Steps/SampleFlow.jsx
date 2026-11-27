import React, { useState, useEffect } from "react";
import {
  roundOf,
  sfOf,
  sampleVideo,
  sampleDelivered,
  dtpDone,
  CARRIERS,
  carrierOf,
  dfmt,
  fmt,
  isoOf,
  todayISO,
  subJobsOf,
  allItems,
  formatEnquiryNo,
  ENQUIRY_CONFIG
} from "../../utils/helpers";
import { toast } from "react-toastify";
import { axiosInstance } from "../../../../utils/url/config";
import PreviewSampleConfirmationSheet from "./PreviewSampleConfirmationSheet";
import SampleProofApprovalDesk from "../common/SampleProofApprovalDesk";
import SendDocumentOverlay from "../common/SendDocumentOverlay";
import CommunicationLogForm from "../common/CommunicationLogForm";
import RevisionPanel from "./RevisionPanel";

const SampleFlow = ({ s, set, client, job, ids = {}, e = {}, onApprove, onRevision }) => {
  const v = roundOf(s).v;
  const f = sfOf(s);
  const locked = !dtpDone(s, "sample");
  const video = sampleVideo(s);

  const parentJobNo = s?.seq
    ? formatEnquiryNo(s.seq)
    : (ids?.enq?.startsWith("RD") ? ids.enq : ids?.enq?.replace("ENQ/26/", "RD")) || ENQUIRY_CONFIG.DEFAULT_ENQUIRY_NO;

  const allJobItems = subJobsOf(s, parentJobNo);
  const activeJobItems = allJobItems.filter((it) => !it.is_dropped);
  const displayItems = activeJobItems.length > 0
    ? activeJobItems
    : allJobItems.length > 0
    ? allJobItems
    : [
        { id: "p1", subJobNo: `${parentJobNo}-A1`, theme: s.e?.theme || s.theme || "Care Champion Plaque", size: s.e?.size || 8, mat: "Acrylic + Resin", qty: s.qty || 100 },
        { id: "p2", subJobNo: `${parentJobNo}-A2`, theme: s.e?.theme || s.theme || "Star Performer Award", size: 10, mat: "Acrylic + Wood", qty: s.qty || 100 }
      ];

  const selectedCarrier = carrierOf(
    s.sampleCarrier ||
    s.sdeliv?.carrier ||
    s.sdeliv?.mode ||
    s.deliv?.carrier ||
    s.deliv?.mode ||
    s.dmode ||
    "Our vehicle"
  );

  const [carrier, setCarrier] = useState(selectedCarrier);
  const [dispDate, setDispDate] = useState(todayISO());
  const [dispRef, setDispRef] = useState("");
  const [delivDate, setDelivDate] = useState(todayISO());

  const [samplePhotos, setSamplePhotos] = useState(f.samplePhotos || {});
  const [showSampleProofModal, setShowSampleProofModal] = useState(false);
  const [showSampleConfirmation, setShowSampleConfirmation] = useState(false);
  const [showApprovalLog, setShowApprovalLog] = useState(false);
  const [showRevision, setShowRevision] = useState(false);
  const [showDelink, setShowDelink] = useState(false);
  const [delinkChecked, setDelinkChecked] = useState({});
  const [delinkReason, setDelinkReason] = useState("");
  const [delinkNote, setDelinkNote] = useState("");
  const [showCancelOrder, setShowCancelOrder] = useState(false);
  const [isDelinkLoading, setIsDelinkLoading] = useState(false);

  const handleDelinkHold = async () => {
    const selectedSubJobs = Object.keys(delinkChecked).filter((k) => delinkChecked[k]);
    if (!selectedSubJobs.length) {
      toast.warning("Please select at least one product to delink");
      return;
    }
    const targetDbId = s.dbJobId || s._id || s.rawJob?._id || ids?.id;
    setIsDelinkLoading(true);
    try {
      const fullReason = delinkNote ? `${delinkReason || "Client put on hold"}: ${delinkNote}` : (delinkReason || "Client put on hold");

      for (const subJobNo of selectedSubJobs) {
        if (targetDbId) {
          await axiosInstance.post(`/enquiry-flow-integration/${targetDbId}/sub-job/${subJobNo}/hold`, {
            hold: true,
            reason: fullReason,
          }).catch(console.warn);
        }
      }

      const updatedTrophyGroups = (s.e?.trophyGroups || []).map((tg, idx) => {
        const groupChar = String.fromCharCode(65 + idx);
        const updatedItems = (tg.items || []).map((item, j) => {
          const sjNo = `${parentJobNo}-${groupChar}${j + 1}`;
          const isTarget = selectedSubJobs.some((sel) => sel === sjNo || sel.endsWith(`-${groupChar}${j + 1}`));
          if (isTarget) {
            return {
              ...item,
              is_on_hold: true,
              hold_reason: fullReason,
              held_at: new Date().toISOString(),
            };
          }
          return item;
        });

        const allHeld = updatedItems.length > 0 && updatedItems.every((it) => it.is_on_hold);
        return {
          ...tg,
          items: updatedItems,
          is_on_hold: allHeld,
          hold_reason: allHeld ? fullReason : tg.hold_reason,
        };
      });

      const updatedSubJobs = (s.sub_jobs || []).map((sj) => {
        const isTarget = selectedSubJobs.some((sel) => sel === sj.sub_job_no || (sj.sub_job_no && sel.endsWith(sj.sub_job_no)) || (sj.sub_job_no && sj.sub_job_no.endsWith(sel)));
        if (isTarget) {
          return {
            ...sj,
            is_on_hold: true,
            hold_reason: fullReason,
            held_at: new Date(),
          };
        }
        return sj;
      });

      set({
        e: { ...(s.e || {}), trophyGroups: updatedTrophyGroups },
        sub_jobs: updatedSubJobs,
        wizard_state: { ...(s.wizard_state || s), e: { ...(s.e || {}), trophyGroups: updatedTrophyGroups }, sub_jobs: updatedSubJobs }
      });

      toast.success(`${selectedSubJobs.length} product(s) delinked and put on hold.`);
      setDelinkChecked({});
      setShowDelink(false);
    } catch (err) {
      console.error("Error delinking product:", err);
      toast.error("Failed to delink product");
    } finally {
      setIsDelinkLoading(false);
    }
  };

  const handleDropProducts = async () => {
    const selectedSubJobs = Object.keys(delinkChecked).filter((k) => delinkChecked[k]);
    if (!selectedSubJobs.length) {
      toast.warning("Please select at least one product to drop");
      return;
    }
    const targetDbId = s.dbJobId || s._id || s.rawJob?._id || ids?.id;
    setIsDelinkLoading(true);
    try {
      const fullReason = delinkNote ? `${delinkReason || "Removed completely"}: ${delinkNote}` : (delinkReason || "Removed completely from job");

      for (const subJobNo of selectedSubJobs) {
        if (targetDbId) {
          await axiosInstance.post(`/enquiry-flow-integration/${targetDbId}/sub-job/${subJobNo}/drop`, {
            reason: fullReason,
          }).catch(console.warn);
        }
      }

      const updatedTrophyGroups = (s.e?.trophyGroups || []).map((tg, idx) => {
        const groupChar = String.fromCharCode(65 + idx);
        const updatedItems = (tg.items || []).map((item, j) => {
          const sjNo = `${parentJobNo}-${groupChar}${j + 1}`;
          const isTarget = selectedSubJobs.some((sel) => sel === sjNo || sel.endsWith(`-${groupChar}${j + 1}`));
          if (isTarget) {
            return {
              ...item,
              is_dropped: true,
              drop_reason: fullReason,
              dropped_at: new Date().toISOString(),
            };
          }
          return item;
        });

        const allDropped = updatedItems.length > 0 && updatedItems.every((it) => it.is_dropped);
        return {
          ...tg,
          items: updatedItems,
          is_dropped: allDropped,
          drop_reason: allDropped ? fullReason : "",
        };
      });

      const updatedSubJobs = (s.sub_jobs || []).map((sj) => {
        const isTarget = selectedSubJobs.some((sel) => sel === sj.sub_job_no || (sj.sub_job_no && sel.endsWith(sj.sub_job_no)) || (sj.sub_job_no && sj.sub_job_no.endsWith(sel)));
        if (isTarget) {
          return {
            ...sj,
            is_dropped: true,
            drop_reason: fullReason,
            dropped_at: new Date(),
            stage: "cancelled",
          };
        }
        return sj;
      });

      set({
        e: { ...(s.e || {}), trophyGroups: updatedTrophyGroups },
        sub_jobs: updatedSubJobs,
        wizard_state: { ...(s.wizard_state || s), e: { ...(s.e || {}), trophyGroups: updatedTrophyGroups }, sub_jobs: updatedSubJobs }
      });

      toast.info(`${selectedSubJobs.length} product(s) dropped from job.`);
      setDelinkChecked({});
      setShowDelink(false);
    } catch (err) {
      console.error("Error dropping product:", err);
      toast.error("Failed to drop product");
    } finally {
      setIsDelinkLoading(false);
    }
  };

  useEffect(() => {
    if (f.samplePhotos) {
      setSamplePhotos(f.samplePhotos);
    }
  }, [f.samplePhotos]);

  const up = (p) => {
    set({
      sflow: {
        ...(s.sflow || {}),
        [v]: {
          ...f,
          ...p
        }
      }
    });
  };

  const handleSamplePhotoUpload = (imgKey, ev) => {
    const file = ev.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEv) => {
        const photoData = {
          name: file.name,
          url: uploadEv.target.result,
          size: file.size,
          uploadedAt: new Date().toISOString()
        };
        const updated = {
          ...samplePhotos,
          [imgKey]: photoData
        };
        setSamplePhotos(updated);
        up({
          samplePhotos: updated
        });
        toast.success(`Sample photo attached for ${imgKey}!`);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    const chosen = carrierOf(
      s.sampleCarrier ||
      s.sdeliv?.carrier ||
      s.sdeliv?.mode ||
      s.deliv?.carrier ||
      s.deliv?.mode ||
      s.dmode ||
      "Our vehicle"
    );
    if (chosen) {
      setCarrier(chosen);
    }
  }, [
    s.sampleCarrier,
    s.sdeliv?.carrier,
    s.sdeliv?.mode,
    s.deliv?.carrier,
    s.deliv?.mode,
    s.dmode
  ]);

  useEffect(() => {
    if (f.disp?.date) {
      setDelivDate(f.disp.date);
    }
  }, [f.disp?.date]);

  const isDelivered = sampleDelivered(s);
  const roadCarriers = ["Our vehicle", "Tempo", "Hand delivery", "Porter"];
  const isRoad = roadCarriers.includes(carrier);

  if (locked) {
    return (
      <div className="w-full bg-white border border-gray-200 border-dashed rounded-xl shadow-2xs p-4 opacity-75">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold bg-gray-100 text-gray-500">
            ✏️
          </div>
          <h4 className="font-bold text-[13px] text-gray-900">
            Sample v{v} - production & delivery
          </h4>
        </div>
        <p className="text-[10px] text-gray-500 ml-7 mb-4">
          Starts once the sample artwork is approved (or marked not needed).
        </p>

        <div className="ml-7 space-y-2">
          <div className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg bg-gray-50">
            <div className="w-5 h-5 rounded-full bg-gray-200 text-white flex justify-center items-center text-[10px] font-bold">
              1
            </div>
            <div>
              <div className="text-[11px] font-bold text-gray-700">Sample production</div>
              <div className="text-[9px] text-gray-400">Waiting for artwork approval</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg bg-gray-50">
            <div className="w-5 h-5 rounded-full bg-gray-200 text-white flex justify-center items-center text-[10px] font-bold">
              2
            </div>
            <div>
              <div className="text-[11px] font-bold text-gray-700">Sample delivery</div>
              <div className="text-[9px] text-gray-400">
                To: {client?.name || "Client"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg bg-gray-50">
            <div className="w-5 h-5 rounded-full bg-gray-200 text-white flex justify-center items-center text-[10px] font-bold">
              3
            </div>
            <div>
              <div className="text-[11px] font-bold text-gray-700">Client approval</div>
              <div className="text-[9px] text-gray-400">
                Unlocks once the sample reaches the client
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active Unlocked Sample Production & Delivery Card
  return (
    <>
      {/* Reusable Sample Proof Approval Desk */}
      <SampleProofApprovalDesk
        s={s}
        set={set}
        client={client}
        job={job}
        ids={ids}
        mode="sample"
        onApprove={(logData) => {
          if (onApprove) {
            onApprove(logData);
          } else {
            set({
              approved: true,
              sub: 0,
              sampleOk: logData,
              capture: null,
              finalQty: s.finalQty || s.e?.qty,
            });
          }
          toast.success(`Client approval for Sample v${v} logged successfully!`);
        }}
        onRevision={() => {
          if (onRevision) {
            onRevision();
          } else {
            setShowRevision((prev) => !prev);
          }
        }}
      />

      {/* Formal Sample Confirmation Sheet Link */}
      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={() => setShowSampleConfirmation(true)}
          className="text-xs text-gray-500 hover:text-indigo-600 underline cursor-pointer"
        >
          📄 Open formal sample confirmation sheet for client...
        </button>
      </div>

      <div className="space-y-4 pt-1">

        {/* Revision Form for Client Wants Changes */}
        {showRevision && (
          <div className="fade">
            <RevisionPanel
              s={s}
              set={set}
              job={job}
              onCancel={() => setShowRevision(false)}
            />
          </div>
        )}

        {/* Delink or Remove a Product Card (Only when 2 or more products exist on the job) */}
        {displayItems.length > 1 &&
          (!showDelink ? (
            <div className="p-4 bg-white border border-gray-200/80 rounded-2xl shadow-xs space-y-3">
              <div>
                <h4 className="font-bold text-sm text-gray-900">
                  {displayItems.length} products on this job
                </h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  Take a product off this job: delink it to a separate job on hold, or remove it completely from the costing, proforma and invoice.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDelink(true)}
                className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-xl shadow-2xs transition cursor-pointer"
              >
                Delink or remove a product
              </button>
            </div>
          ) : (
            <div className="p-4 bg-white border-2 border-indigo-200 rounded-2xl shadow-sm ring-4 ring-indigo-50/50 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-indigo-600 font-bold text-xs">■</span>
                <h4 className="font-bold text-sm text-gray-900">Delink or remove a product</h4>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                The delinked product leaves the job's costing, proforma, advance and invoice. <strong className="text-gray-700">Delink</strong> keeps them as a separate job on hold to pick up later. <strong className="text-gray-700">Remove completely</strong> drops them for good.
              </p>

            <div className="space-y-2">
              {displayItems.map((item, idx) => (
                <label
                  key={item.subJobNo || idx}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-xl bg-gray-50/50 cursor-pointer hover:bg-gray-100 transition"
                >
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      className="mt-1 border-gray-300 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      checked={!!delinkChecked[item.subJobNo || idx]}
                      onChange={(e) =>
                        setDelinkChecked((prev) => ({
                          ...prev,
                          [item.subJobNo || idx]: e.target.checked
                        }))
                      }
                    />
                    <div>
                      <div className="text-xs font-bold text-gray-900">
                        {item.subJobNo} · {item.theme || item.product || "Product " + (idx + 1)}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {item.size || 8} in · {item.qty || 100} pcs · {item.mat || "Acrylic"}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-medium text-gray-400">14 days</span>
                </label>
              ))}
            </div>

            <div>
              <h4 className="font-bold text-xs text-gray-900 mb-2">Why?</h4>
              <div className="flex gap-2 flex-wrap">
                {[
                  "Design not approved yet",
                  "Client put it on hold",
                  "Client chose the other product after the sample",
                  "Budget not cleared",
                  "Waiting for quantity / sizes",
                  "Other"
                ].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setDelinkReason(r)}
                    className={`px-3 py-1.5 border rounded-lg text-xs font-medium transition cursor-pointer ${
                      delinkReason === r
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <input
              type="text"
              placeholder="Note (optional), e.g. Client will confirm after the event committee meets"
              value={delinkNote}
              onChange={(e) => setDelinkNote(e.target.value)}
              className="w-full text-xs p-2.5 border border-gray-200 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
            />

            <div className="flex gap-2 items-center pt-1">
              <button
                type="button"
                onClick={() => setShowDelink(false)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 transition cursor-pointer"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleDelinkHold}
                disabled={isDelinkLoading}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition cursor-pointer disabled:opacity-50"
              >
                {isDelinkLoading ? "Updating..." : "Delink and put on hold"}
              </button>
              <button
                type="button"
                onClick={handleDropProducts}
                disabled={isDelinkLoading}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 transition ml-auto cursor-pointer disabled:opacity-50"
              >
                {isDelinkLoading ? "Updating..." : "Drop completely"}
              </button>
            </div>
          </div>
        ))}

        {/* Cancel Whole Order Link */}
        <div className="pt-0.5">
          {!showCancelOrder ? (
            <button
              type="button"
              onClick={() => setShowCancelOrder(true)}
              className="text-xs text-gray-400 hover:text-red-600 transition cursor-pointer font-medium"
            >
              Client wants to cancel the whole order...
            </button>
          ) : (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-red-600 font-bold text-sm">⚠️</span>
                  <h4 className="font-bold text-sm text-red-950">Cancel sample order</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCancelOrder(false)}
                  className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <p className="text-xs text-red-800">
                Are you sure you want to mark this sample enquiry / order as cancelled?
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    set({ abandoned: true, abandonedReason: "Client cancelled sample order" });
                    setShowCancelOrder(false);
                    toast.info("Sample order marked as cancelled.");
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-2xs transition cursor-pointer"
                >
                  Yes, cancel order
                </button>
                <button
                  type="button"
                  onClick={() => setShowCancelOrder(false)}
                  className="px-4 py-2 bg-white border border-gray-200 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-50 transition cursor-pointer"
                >
                  Keep order active
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

    {/* Modal 1: Sample Confirmation for Client */}
    {showSampleConfirmation && (
      <PreviewSampleConfirmationSheet
        s={s}
        e={s.e || e || {}}
        client={client}
        job={job}
        ids={ids || { enq: parentJobNo }}
        onClose={() => setShowSampleConfirmation(false)}
        onSend={() => {
          setShowSampleConfirmation(false);
        }}
      />
    )}
  </>
);
};

export default SampleFlow;
