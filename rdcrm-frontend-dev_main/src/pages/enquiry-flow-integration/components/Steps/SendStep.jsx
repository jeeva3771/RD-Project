import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { axiosInstance } from "../../../../utils/url/config";
import {
  dfmt,
  fmt,
  inr,
  sampleTax,
  sampleRatesOk,
  isSampleRatesApproved,
  proofLine,
  allItems,
  itemName,
  dtpDone,
  dtpState,
  DTP_LABEL,
  dtpOf,
  sfOf,
  sampleDelivered,
  advSettled,
  finOf,
  todayISO,
  jobStage,
  roundOf,
  addWork,
  ENQUIRY_CONFIG,
  deriveDocNo,
  contactsOf,
  formatEnquiryNo,
} from "../../utils/helpers";
import ApprovalHistoryProof from "../common/ApprovalHistoryProof";
import StageBar from "../common/StageBar";
import PreviewSampleConfirmationSheet from "./PreviewSampleConfirmationSheet";
import CommunicationLogForm from "../common/CommunicationLogForm";
import ArtworkPanel from "../common/ArtworkPanel";
import SampleFlow from "./SampleFlow";
import SampleProofApprovalDesk from "../common/SampleProofApprovalDesk";
import RevisionPanel from "./RevisionPanel";
import OrderPipeline from "./OrderPipeline";
import DispatchPanel from "./DispatchPanel";
import AfterSales from "./AfterSales";
import FinLedger from "./FinLedger";
import ScorePanel from "./ScorePanel";
import PreviewProformaSheet from "./PreviewProformaSheet";
import PendingOnJob from "./PendingOnJob";

const SendStep = ({
  s,
  set,
  job,
  counts = { auto: 12, typed: 3, picked: 2 },
  ids = {},
  client,
  e
}) => {
  const isS = s.mode === "sample";
  const jobData = job || { rate: s.jobRate || 1000, product: s.e?.theme || s.theme || "Custom Trophy" };
  const eData = e || s.e || {};
  const isFree = (s.charge || "foc") === "foc" || !s.sampleRate || Number(s.sampleRate) === 0;

  const isRatesApproved = Boolean(
    isSampleRatesApproved(s) ||
    s.ratesApproved ||
    s.sampleConfirmed ||
    s.sampleRatesState === "approved" ||
    s.sampleDecision?.decision === "approved" ||
    s.rawJob?.sample_rates_approved ||
    s.rawJob?.wizard_state?.ratesApproved ||
    s.rawJob?.wizard_state?.sampleConfirmed ||
    s.rawJob?.wizard_state?.sampleRatesState === "approved" ||
    s.rawJob?.wizard_state?.sampleDecision?.decision === "approved"
  );

  // Auto-sync approval status when awaiting client sample rate approval
  useEffect(() => {
    if (!isS || isFree || isRatesApproved) return;
    const jobId = s.dbJobId || s.rawJob?._id;
    if (!jobId) return;

    let isMounted = true;
    const checkStatus = async () => {
      try {
        const res = await axiosInstance.get(`/enquiry-flow-integration/${jobId}`);
        if (!isMounted) return;
        if (res.data?.success && res.data?.data) {
          const liveJob = res.data.data;
          const liveWs = liveJob.wizard_state || {};
          const liveApproved = Boolean(
            liveWs.ratesApproved ||
            liveWs.sampleConfirmed ||
            liveWs.sampleRatesState === "approved" ||
            liveWs.sampleDecision?.decision === "approved" ||
            liveJob.sample_rates_approved
          );
          if (liveApproved) {
            set({
              ratesApproved: true,
              sampleConfirmed: true,
              sampleRatesState: "approved",
              sampleRateOk: liveWs.sampleRateOk || {
                channel: liveWs.sampleApprovalMethod || "Client Link (Direct)",
                via: "Online Link",
                fmt: "Client Link (Direct)",
                proof: liveWs.sampleDecision?.notes
                  ? `Approved online via confirmation link ("${liveWs.sampleDecision.notes}")`
                  : "Client approved via online confirmation link",
              },
              rawJob: liveJob,
            });
          } else if (liveWs.sampleRatesState === "revision" || liveWs.sampleDecision?.decision === "revision") {
            set({
              sampleRatesState: "revision",
              sampleDecision: liveWs.sampleDecision,
              rawJob: liveJob,
            });
          }
        }
      } catch (_e) {
        // silent check
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 4000);
    const handleFocus = () => checkStatus();
    window.addEventListener("focus", handleFocus);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [isS, isFree, isRatesApproved, s.dbJobId, s.rawJob?._id, set]);

  const [previewSample, setPreviewSample] = useState(false);
  const [activePreviewItem, setActivePreviewItem] = useState(null);
  const [showEnquiryProof, setShowEnquiryProof] = useState(false);
  const [showSampleProof, setShowSampleProof] = useState(false);
  const [showPiProof, setShowPiProof] = useState(false);
  const [previewDocModal, setPreviewDocModal] = useState(null);
  const [isLoggingRate, setIsLoggingRate] = useState(false);
  const [isPushingSample, setIsPushingSample] = useState(false);

  const handlePushSample = async () => {
    const targetDbId = s.dbJobId || s.rawJob?._id || ids?.id;
    setIsPushingSample(true);
    try {
      if (targetDbId) {
        await axiosInstance.post(`/enquiry-flow-integration/${targetDbId}/push-sample-production`, {
          charge: isFree ? "foc" : (s.charge || "charge"),
          sampleRate: isFree ? 0 : s.sampleRate,
          sampleCarrier: s.sampleCarrier || s.delivCarrier || "Our vehicle",
          sampleShipTo: s.sampleShipTo || s.sampleAddress?.label || s.shipTo || (client?.name ? `${client.name} office` : "Client office"),
          uploadedDesigns: s.uploadedDesigns || s.watermarkedDesigns || {},
        });
        toast.success("Job pushed to Sample Production! Sub-jobs are now available in Production Hub.");
      }

      set({
        sent: true,
        sentAt: new Date().toISOString(),
        samplePushedAt: new Date().toISOString(),
        charge: isFree ? "foc" : (s.charge || "charge"),
        sampleRate: isFree ? 0 : s.sampleRate,
        ratesApproved: true,
        sampleConfirmed: true,
        sampleRatesState: "approved"
      });
    } catch (err) {
      console.error("Error pushing to sample production:", err);
      toast.error(err.response?.data?.message || "Failed to push to sample production");
    } finally {
      setIsPushingSample(false);
    }
  };

  const items = allItems(s);

  // Status checks for interactive timeline
  const dtpSampleDone = dtpDone(s, "sample");
  const sf = sfOf(s);
  const sampleIsReady = !!sf.readyAt;
  const sampleIsDelivered = sampleDelivered(s);
  const sampleIsApproved = !!s.approved;
  const rateIsConfirmed = !!s.fc;

  const f = finOf(s, jobData, client, s.finalQty || s.qty || 100);
  const finIsDone = !!(s.pi?.sent && s.costOk && advSettled(s, f));
  const isReleased = !!s.released;

  const [bannerDismissed, setBannerDismissed] = useState(false);
  const curStage = jobStage(s, f);
  const pageTitle = s.abandoned
    ? "Order cancelled"
    : s.released
    ? {
        dtp: "Production artwork (DTP)",
        aftersales: "After-sales",
        collections: "Collections",
        closed: "Job completed"
      }[curStage] || "Pushed to production"
    : {
        sample: "Sample",
        production: "Production order",
        packing: "Packing",
        dispatch: "Dispatch & push to production"
      }[curStage] || "Sample";

  // Not pushed yet (before clicking "Push to sample production" or "Start order processing")
  if (!s.sent) {
    if (isS) {
      return (
        <div className="fade space-y-4 max-w-4xl mx-auto">
          {previewSample && (
            <PreviewSampleConfirmationSheet
              s={s}
              e={eData}
              client={client}
              item={items.find((it) => it.id === activePreviewItem) || items[0]}
              items={items}
              ids={ids}
              onClose={() => setPreviewSample(false)}
              onSend={(channel = "WhatsApp") => {
                setPreviewSample(false);
                const sentChannel = typeof channel === "string" ? channel : "WhatsApp";
                set(
                  {
                    sampleConfirmSent: sentChannel,
                    sampleRatesSent: true,
                    sampleRatesState: "awaiting_approval",
                    sampleConfirmed: false,
                    sampleDecision: null,
                    sampleRevisionHistory: [
                      ...(s.sampleRevisionHistory || []),
                      ...(s.sampleDecision ? [s.sampleDecision] : [])
                    ],
                    sampleItemsData: {
                      ...(s.sampleItemsData || {}),
                      [activePreviewItem]: {
                        ...((s.sampleItemsData || {})[activePreviewItem] || {}),
                        sent: true
                      }
                    }
                  },
                  true
                );
              }}
            />
          )}

          {/* Header */}
          <div className="mb-6">
            <h1 className="text-[28px] font-black text-indigo-950 tracking-tight leading-none mb-2">
              Push to sample production
            </h1>
            <p className="text-[13px] text-gray-500 mb-3">
              Sample rates approved and delivery set, then the shop floor starts the sample. Sample artwork (DTP) follows.
            </p>
            <StageBar s={s} f={f} />
          </div>

          {/* Yellow Banner */}
          <div className="bg-[#FFF8D6] border border-[#FBE577] rounded-xl p-4 flex items-start gap-4">
            <div className="text-xl">🪄</div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-amber-900 mb-1">This job is now in SAMPLE</h4>
              <p className="text-[11px] text-amber-800/80 leading-relaxed">
                The client said yes. Sample rates and delivery &rarr; push to sample production &rarr; sample artwork (DTP) &rarr; sample production &rarr; sample delivery &rarr; client approval.
              </p>
            </div>
            <button className="px-4 py-1.5 bg-white border border-amber-200 text-amber-900 text-[11px] font-bold rounded-lg shadow-2xs hover:bg-amber-50 transition cursor-pointer">
              Got it
            </button>
          </div>

          {/* Stats Box */}
          <div className="flex gap-6 items-center p-5 border border-gray-200 rounded-xl bg-white shadow-2xs">
            <div className="text-4xl font-black text-amber-500">
              {counts.auto + counts.typed + counts.picked || 26}
            </div>
            <div>
              <div className="text-[11px] font-bold text-gray-900 mb-0.5">
                fields carried over or filled for you.
              </div>
              <div className="text-[11px] text-gray-500 mb-1">
                You typed {counts.typed || 0} and picked {counts.picked || 8}.
              </div>
              <div className="text-[9px] text-gray-400">
                From enquiry to sample, the client, spec, brief, references and BOM were entered exactly once.
              </div>
            </div>
          </div>

          {/* Green Check Row */}
          <div className="flex items-center gap-3 p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 shadow-2xs">
            <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">
              ✔
            </div>
            <div className="text-[11px] font-bold">
              Sample v1: {s.sampleQty || 1} pc - {isFree ? "Free of cost" : "Chargeable"}
              {!isFree && s.sampleRate ? ` · ${inr(s.sampleQty * s.sampleRate)}` : ""}
            </div>
          </div>

          {/* Main Push Setup Box */}
          <div className="border-2 border-amber-400 rounded-2xl bg-white shadow-sm overflow-hidden mt-6 mb-6">
            <div className="p-5 border-b border-gray-100 bg-white">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 text-sm">
                  🏭
                </div>
                <div>
                  <h3 className="text-[15px] font-black text-gray-900 mb-1">
                    Push to sample production
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    Once the sample rates are approved and the sample delivery is set, push it to the shop floor. Sample artwork (DTP) starts next.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-3">
              {/* Sample Rates Block */}
              {isFree ? (
                <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold">
                      ✔
                    </div>
                    <div>
                      <div className="text-[12px] font-bold text-gray-900">Sample rates · free of cost</div>
                      <div className="text-[10px] text-emerald-700 font-bold">No approval needed</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {(s.sampleRatesState === "revision" || s.sampleDecision?.decision === "revision") && !isRatesApproved ? (
                    <div className="p-4 rounded-xl border-2 border-amber-400 bg-amber-50/90 shadow-2xs">
                      <div className="flex items-start justify-between gap-3 mb-2.5">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-black shrink-0 mt-0.5">
                            ⚠️
                          </div>
                          <div>
                            <div className="text-[13px] font-black text-amber-950 flex items-center gap-2">
                              <span>Sample rates · Client requested alterations</span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 uppercase">
                                Action Needed
                              </span>
                            </div>
                            <div className="text-[11px] font-bold text-amber-950 mt-1 italic bg-white/90 p-2.5 rounded-lg border border-amber-200">
                              "{s.sampleDecision?.notes || "Client requested changes to sample rates"}"
                            </div>
                            <div className="text-[10px] text-amber-800 mt-1.5 font-medium">
                              Current rate: {inr(s.sampleRate * (s.sampleQty || 1))} incl. GST · Adjust the rate in Essentials or re-share revised sheet.
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-amber-200/80 flex-wrap">
                        <button
                          type="button"
                          className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded-lg shadow-2xs transition cursor-pointer flex items-center gap-1.5"
                          onClick={() => set({ step: 5 })}
                          title="Navigate to Just the essentials to adjust rates"
                        >
                          <span>✏️</span>
                          <span>Modify Sample Rates</span>
                        </button>
                        <button
                          type="button"
                          className="px-3.5 py-1.5 bg-white border border-amber-300 text-amber-950 text-[11px] font-bold rounded-lg shadow-2xs hover:bg-amber-100/50 transition cursor-pointer flex items-center gap-1.5"
                          onClick={() => setPreviewSample(true)}
                        >
                          <span>📄</span>
                          <span>Resend Revised Sheet</span>
                        </button>
                        <button
                          type="button"
                          className="px-3.5 py-1.5 bg-[#059669] hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg shadow-2xs transition cursor-pointer"
                          onClick={() => setIsLoggingRate(true)}
                        >
                          Client approved
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`flex items-center justify-between p-4 rounded-xl border ${
                        isRatesApproved ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-6 h-6 rounded-full text-white flex items-center justify-center text-[10px] font-bold ${
                            isRatesApproved ? "bg-emerald-500" : "bg-amber-500"
                          }`}
                        >
                          {isRatesApproved ? "✔" : "1"}
                        </div>
                        <div>
                          <div className="text-[12px] font-bold text-gray-900">
                            Sample rates · {inr(s.sampleRate * (s.sampleQty || 1))} incl. GST
                          </div>
                          <div className="text-[10px] text-gray-500">
                            {isRatesApproved && s.sampleRateOk
                              ? `Approved · ${proofLine(s.sampleRateOk)}`
                              : isRatesApproved
                              ? "Approved · Direct client confirmation"
                              : s.sampleConfirmSent
                              ? `Sent via ${s.sampleConfirmSent} · awaiting the client's OK`
                              : s.costing?.lines && s.costing.lines.length > 1
                              ? `${s.costing.lines.map(l => `${l.name || 'Item'}: ${inr(l.sampleRate || 0)}`).join(' + ')} = ${inr(s.sampleRate)} · Chargeable · send to client`
                              : `${s.sampleQty || 1} pc x ${inr(s.sampleRate)} · Chargeable · send to the client for approval`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isRatesApproved ? (
                          <span className="text-[11px] font-bold text-emerald-700 px-4 py-2 bg-emerald-100 rounded-lg flex items-center gap-1">
                            <span>Approved ✓</span>
                          </span>
                        ) : !s.sampleConfirmSent ? (
                          <button
                            className="px-4 py-2 bg-amber-400 text-amber-900 text-[11px] font-bold rounded-lg shadow-sm hover:bg-amber-500 transition cursor-pointer"
                            onClick={() => setPreviewSample(true)}
                          >
                            Send to client
                          </button>
                        ) : (
                          <>
                            <button
                              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-[11px] font-bold rounded-lg shadow-2xs hover:bg-gray-50 transition cursor-pointer"
                              onClick={() => setPreviewSample(true)}
                            >
                              Resend
                            </button>
                            <button
                              className="px-4 py-2 bg-[#059669] text-white text-[11px] font-bold rounded-lg shadow-sm hover:bg-emerald-700 transition cursor-pointer"
                              onClick={() => setIsLoggingRate(true)}
                            >
                              Client approved
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {isLoggingRate && (
                    <div className="border border-gray-200 rounded-xl bg-gray-50 p-4 relative">
                      <button
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 cursor-pointer"
                        onClick={() => setIsLoggingRate(false)}
                      >
                        ✖
                      </button>
                      <h4 className="text-[12px] font-bold text-gray-800 mb-3 ml-2">
                        Log client approval for Sample Rates
                      </h4>
                      <CommunicationLogForm
                        client={client}
                        mode="sample"
                        feedbackMode="approve"
                        amount={String(s.sampleRate * (s.sampleQty || 1))}
                        hideCard={true}
                        onBack={() => setIsLoggingRate(false)}
                        onLog={(logDetails) => {
                          set(
                            {
                              ratesApproved: true,
                              sampleConfirmed: true,
                              sampleRatesState: "approved",
                              sampleRateOk: logDetails,
                              ratesApprovalLog: logDetails,
                              sampleConfirmSent: s.sampleConfirmSent || "Direct",
                              sampleDecision: {
                                decision: "approved",
                                notes: logDetails?.proof || logDetails?.notes || "Client approved",
                                at: new Date().toISOString(),
                                by: logDetails?.by || "Client",
                              },
                            },
                            true
                          );
                          setIsLoggingRate(false);
                          toast.success("Sample rates approved and saved!");
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Sample Delivery Block */}
              <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold">
                    ✔
                  </div>
                  <div>
                    <div className="text-[12px] font-bold text-gray-900">Sample delivery</div>
                    <div className="text-[10px] text-gray-500">
                      {s.sampleShipTo || s.sampleAddress?.label || s.shipTo || (client?.name ? `${client.name} office` : "Client office")} · {s.sampleCarrier || s.delivCarrier || "Our vehicle"} · ready by {fmt(s.leadDate || addWork(3))}
                    </div>
                  </div>
                </div>
                <button
                  className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
                  onClick={() => set({ step: 5 })}
                >
                  Edit
                </button>
              </div>

              {/* Ready to Push Block */}
              <div className="flex items-center justify-between p-4 bg-[#FFF8D6] border border-[#FBE577] rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-400 text-amber-900 flex items-center justify-center text-[10px] font-bold">
                    3
                  </div>
                  <div>
                    <div className="text-[12px] font-bold text-gray-900">Push to sample production</div>
                    <div className="text-[10px] text-amber-800">
                      Ready. Tap "Push to sample production" below.
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 px-1 text-[10px] text-gray-400">
                After the push: ✏️ Sample artwork (DTP) &rarr; sample made &rarr; client approval.
              </div>
            </div>
          </div>

          {/* Action Button Row */}
          <div className="flex items-center justify-between mt-8 mb-8">
            <button
              className="px-6 py-2.5 text-xs font-bold text-gray-600 border border-gray-200 hover:bg-gray-50 rounded-xl shadow-2xs transition cursor-pointer"
              onClick={() => set({ step: s.step - 1 })}
            >
              ← Back
            </button>
            <button
              className="px-8 py-3 text-xs font-bold rounded-xl transition bg-amber-400 hover:bg-amber-500 text-amber-900 shadow-sm cursor-pointer disabled:opacity-50"
              disabled={isPushingSample || (isS && !isFree && !isRatesApproved)}
              onClick={handlePushSample}
            >
              {isPushingSample ? "Pushing to sample..." : "🏭 Push to sample production"}
            </button>
          </div>
        </div>
      );
    }

    // Straight to Production order mode
    return (
      <div className="fade space-y-4 max-w-4xl mx-auto">
        <div className="mb-4">
          <h2 className="q">Ready to start the order?</h2>
          <p className="qs">The job card on the right is exactly what the shop floor will see.</p>
          <StageBar s={s} f={f} />
        </div>
        <div className="p-5 border border-gray-200 rounded-xl bg-white shadow-2xs flex items-center gap-6">
          <div className="text-4xl font-black text-amber-500">
            {counts.auto + counts.typed + counts.picked || 24}
          </div>
          <div>
            <div className="text-[11px] font-bold text-gray-900 mb-0.5">
              fields carried over or filled for you.
            </div>
            <div className="text-[11px] text-gray-500 mb-1">
              From enquiry to production, the client, spec, brief, references and BOM were entered exactly once.
            </div>
          </div>
        </div>

        <div className="actions flex justify-between items-center pt-3 border-t">
          <button
            className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"
            onClick={() => set({ step: s.step - 1 })}
          >
            ← Back
          </button>
          <button
            className="px-6 py-2.5 bg-amber-400 hover:bg-amber-500 text-amber-950 text-xs font-bold rounded-lg shadow-2xs transition cursor-pointer"
            onClick={() =>
              set({
                sent: true,
                sentAt: new Date().toISOString(),
                approved: true,
                finalQty: s.qty || 100,
                relLead: s.lead,
                relDate: s.leadDate || null,
                ppAfter: s.pp,
                sub: 0
              })
            }
          >
            Start order processing
          </button>
        </div>
      </div>
    );
  }

  // SENT STATE: Full Live Operational Order & Production Pipeline
  const roundInfo = roundOf(s);
  const currentV = roundInfo.v;
  const rounds = s.rounds || [];

  const pipelineSteps = [
    ...(isS
      ? [
          {
            t: "Sample rates approved",
            s: isFree
              ? "Free of cost"
              : s.sampleRateOk
              ? `${s.sampleRateOk.method || "WhatsApp"} · ${dfmt(s.sampleRateOk.date || "2026-10-10")} · ${client?.contact || client?.name || "Vikas Rao"}`
              : "WhatsApp · 10 Oct 2026 01:11 · Vikas Rao",
            done: true
          },
          {
            t: "Pushed to sample production",
            s: `${ids?.s || "RD/S/26/0415"} · ${s.samplePushedAt ? dfmt(s.samplePushedAt) : "11 Oct 2026"} · confirmation sent via ${s.sampleProofSent || "Hand-delivered / other"}`,
            done: true
          },
          {
            t: "Sample artwork (DTP)",
            s: dtpSampleDone
              ? `Artwork approved · round ${s.dtp?.sample?.round || 3}`
              : "Content in · send to DTP",
            done: dtpSampleDone,
            now: !dtpSampleDone
          },
          // Past sample rounds (revisions) with yellow ↺ circle
          ...rounds.map((rnd, idx) => {
            const rNum = rnd.v || idx + 1;
            const changesText = (rnd.changes || []).join(", ");
            const noteText = rnd.note ? ` · ${rnd.note}` : "";
            return {
              t: `Sample v${rNum}: client asked for changes`,
              s: `${changesText}${noteText}`,
              done: true,
              isRev: true
            };
          }),
          ...(s.ppAfter ? [] : [
            {
              t: `Sample v${currentV} production`,
              s: sampleIsReady
                ? `Sample ready ${dfmt(sf.readyAt || "2026-10-11")}`
                : "Being made on shop floor",
              done: sampleIsApproved || sampleIsReady,
              now: dtpSampleDone && !sampleIsApproved && !sampleIsReady
            },
            {
              t: `Sample v${currentV} delivery`,
              s: sampleIsDelivered
                ? `Delivered ${dfmt(sf.deliveredAt || "2026-10-10")} · ${sf.disp?.carrier || s.sampleCarrier || "Our vehicle"}`
                : (sf.disp ? `Dispatched ${dfmt(sf.disp.date)} · ${sf.disp.carrier}` : "Pending delivery"),
              done: sampleIsApproved || sampleIsDelivered,
              now: sampleIsReady && !sampleIsApproved && !sampleIsDelivered
            },
            {
              t: `Sample v${currentV} · client approval`,
              s: sampleIsApproved
                ? `Approved by client · ${dfmt(s.sampleOk?.date || todayISO())}`
                : "Waiting for approval or changes",
              done: sampleIsApproved,
              now: sampleIsDelivered && !sampleIsApproved && !s.revOpen
            }
          ])
        ]
      : [
          {
            t: "Production order created",
            s: ids?.p || "RD/P/26/0418",
            done: true
          }
        ]),
    {
      t: "Rate confirmed",
      s: rateIsConfirmed ? `${inr(s.fc?.rate || 3390)}/pc for ${s.fc?.qty || s.finalQty || 40} pcs` : "",
      done: rateIsConfirmed,
      now: !rateIsConfirmed
    },
    {
      t: "Financials",
      s: finIsDone
        ? "Proforma sent · Client approved · Advance settled"
        : [s.pi?.sent ? "Proforma sent" : null, s.costOk ? "approved" : null, s.rcpt ? "advance received" : null].filter(Boolean).join(" · "),
      done: finIsDone,
      now: rateIsConfirmed && !finIsDone
    },
    {
      t: "Production Hub",
      s: isReleased ? `${ids?.ph || deriveDocNo(ids?.enq || s?.enquiry_no, "PH")} · Released` : "",
      done: isReleased,
      now: finIsDone && !isReleased
    },
    {
      t: "Production artwork (DTP)",
      s: dtpDone(s, "prod")
        ? "Artwork approved"
        : (DTP_LABEL[dtpState(s, "prod")] || "Waiting for content"),
      done: dtpDone(s, "prod"),
      now: isReleased && !dtpDone(s, "prod")
    },
    ...(s.pp || s.ppAfter
      ? [
          {
            t: `Pre-production sample v${currentV || 1}`,
            s: s.ppApproved
              ? `Approved · ${dfmt(s.ppOk?.date || todayISO())}`
              : `${isReleased ? "Full run on hold until approved" : "Made first after release"}`,
            done: !!s.ppApproved,
            now: isReleased && !s.ppApproved
          }
        ]
      : []),
    {
      t: "Order confirmation and tax invoice",
      s: s.tinv ? "Tax invoice raised" : "After the Production Hub",
      done: !!s.tinv,
      now: isReleased && !s.tinv
    },
    ...(isReleased
      ? [
          {
            t: "Dispatched",
            s: s.dispatched ? `${dfmt(s.dispatched.date)} · ${s.dispatched.carrier}` : "After artwork approval",
            done: !!s.dispatched,
            now: dtpDone(s, "prod") && !s.dispatched
          },
          {
            t: "Delivered · after-sales",
            s: s.deliveredAt ? `Delivered ${dfmt(s.deliveredAt)}` : "",
            done: !!s.deliveredAt,
            now: !!s.dispatched && !s.deliveredAt
          },
          {
            t: "Payment collected",
            s: s.isFullyPaid ? "Fully paid" : "",
            done: !!s.isFullyPaid,
            now: !!s.deliveredAt && !s.isFullyPaid
          }
        ]
      : [])
  ];

  return (
    <div className="fade space-y-6 max-w-4xl mx-auto">
      {/* Top Header & 9-Stage Pill Bar (Circled in user screenshot) */}
      <div className="mb-2">
        <h2 className="q">{pageTitle}</h2>
        <p className="qs">Every step writes to the Client Job Ledger.</p>
        <StageBar s={s} f={f} />
      </div>

      {/* Top Banner */}
      {!bannerDismissed && (
        <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-start gap-3">
          <div className="text-xl">🏭</div>
          <div className="flex-1">
            <h4 className="font-bold text-sm text-emerald-950 mb-1">
              {!isS
                ? "This job is now in PRODUCTION"
                : sampleIsApproved
                ? isReleased
                  ? "This job is now in PRODUCTION & DISPATCH"
                  : "This job is now in ORDER PIPELINE"
                : "This job is now in SAMPLE"}
            </h4>
            <p className="text-[11px] text-emerald-800">
              {!isS
                ? "Won straight to production. Log the production order: quantity, rates and financials."
                : sampleIsApproved
                ? "Sample approved by client. Complete order & rate confirmation, financials, and packing before releasing to the Production Hub."
                : "The client said yes. Sample rates and delivery → push to sample production → sample artwork (DTP) → sample production → sample delivery → client approval."}
            </p>
          </div>
          <button
            className="px-3 py-1.5 bg-white border border-emerald-200 text-emerald-900 text-[10px] font-bold rounded-lg hover:bg-emerald-100 transition shadow-sm cursor-pointer"
            onClick={() => setBannerDismissed(true)}
          >
            Got it
          </button>
        </div>
      )}

      {/* Pipeline Panel (White rounded card with connected step indicators) */}
      <div className="bg-white border border-gray-200/90 rounded-[20px] p-6 shadow-xs">
        <div className="flex flex-col">
          {pipelineSteps.map((p, i) => {
            const isLast = i === pipelineSteps.length - 1;
            return (
              <div key={i} className="grid grid-cols-[28px_1fr] gap-3 relative pb-5 last:pb-0">
                {/* Connecting vertical line */}
                {!isLast && (
                  <div
                    className={`absolute left-[13px] top-[28px] bottom-0 w-[2px] transition-colors ${
                      p.done ? "bg-[#059669]" : "bg-gray-200"
                    }`}
                  />
                )}
                {/* Step indicator dot */}
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition z-10 ${
                    p.done
                      ? "bg-[#059669] text-white border-2 border-[#059669]"
                      : p.now
                      ? "bg-white border-2 border-indigo-600 text-indigo-700 ring-4 ring-indigo-50"
                      : "bg-white border-2 border-gray-200 text-gray-400"
                  }`}
                >
                  {p.warn ? "↺" : p.done ? "✓" : i + 1}
                </div>
                {/* Step title & subtitle */}
                <div className="pt-0.5 min-w-0">
                  <div
                    className={`text-[13px] leading-tight ${
                      p.now
                        ? "text-gray-900 font-bold"
                        : p.done
                        ? "text-gray-900 font-semibold"
                        : "text-gray-500 font-medium"
                    }`}
                  >
                    {p.t}
                  </div>
                  {p.s && (
                    <div className="text-[11px] text-gray-400 mt-0.5 leading-snug">
                      {p.s}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Client approvals on record box */}
      {(() => {
        const parentJobCode = s?.seq ? formatEnquiryNo(s.seq) : (ids?.enq || ids?.id || "RD26004");
        const piDocNumber = s.pi?.no || ids?.pi || deriveDocNo(parentJobCode, "PI");

        return (
          <div className="p-5 bg-white border border-gray-200/90 rounded-[20px] shadow-xs space-y-4">
            <h4 className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">
              Client approvals on record
            </h4>

            {/* 1. Enquiry won */}
            <div className="flex items-start gap-3 pt-3 border-t border-gray-100">
              <span className="text-gray-400 mt-0.5">💬</span>
              <div className="flex-1">
                <ApprovalHistoryProof
                  type="enquiry"
                  title="Enquiry won"
                  data={s.costOk || s.e}
                  s={s}
                  client={client}
                  docNo="Enquiry brief v1.0"
                  docLabel="Enquiry brief"
                  onViewDoc={() => setPreviewDocModal("enquiry_brief")}
                  defaultOpen={showEnquiryProof}
                />
              </div>
            </div>

            {/* 2. Sample v2 approved (only when sample mode and sample was approved) */}
            {s.sampleOk && (
              <div className="flex items-start gap-3 pt-3 border-t border-gray-100">
                <span className="text-gray-400 mt-0.5">🏆</span>
                <div className="flex-1">
                  <ApprovalHistoryProof
                    type="sample"
                    title="Sample v2 approved"
                    data={s.sampleOk}
                    s={s}
                    client={client}
                    docNo="Sample v2 photo proof"
                    docLabel="Photo proof"
                    onViewDoc={() => setPreviewDocModal("sample_photo")}
                    defaultOpen={showSampleProof}
                  />
                </div>
              </div>
            )}

            {/* 3. Quotation & proforma approved */}
            {(s.costOk || s.piApproved || s.clientApproved) && (
              <div className="flex items-start gap-3 pt-3 border-t border-gray-100">
                <span className="text-gray-400 mt-0.5">📄</span>
                <div className="flex-1">
                  <ApprovalHistoryProof
                    type="pi"
                    title="Quotation & proforma approved"
                    data={s.costOk}
                    s={s}
                    client={client}
                    docNo={piDocNumber}
                    docLabel="Proforma Invoice"
                    onViewDoc={() => setPreviewDocModal("pi")}
                    defaultOpen={showPiProof}
                  />
                </div>
              </div>
            )}

            {/* 4. Pre-production sample approved */}
            {s.ppOk && (
              <div className="flex items-start gap-3 pt-3 border-t border-gray-100">
                <span className="text-gray-400 mt-0.5">🔬</span>
                <div className="flex-1">
                  <ApprovalHistoryProof
                    type="sample"
                    title="Pre-production sample v1 approved"
                    data={s.ppOk}
                    s={s}
                    client={client}
                    docNo="PP Sample Proof"
                    docLabel="Proof"
                  />
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Multi-product delink panel */}
      {!isReleased && items.length >= 2 && (
        <div className="p-5 bg-white border border-gray-200/90 rounded-[20px] shadow-xs flex items-center justify-between">
          <div>
            <div className="font-bold text-xs text-gray-900">{items.length} products on this job</div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              Take a product off this job: delink it to a separate job on hold, or remove it completely from the costing, proforma and invoice.
            </div>
          </div>
          <button
            className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition shadow-2xs whitespace-nowrap cursor-pointer"
            onClick={() => {
              // open delink modal or action
            }}
          >
            Delink or remove a product
          </button>
        </div>
      )}

      {/* PHASE 1 & 2: SAMPLE STAGE (Before Sample Approval) */}
      {!sampleIsApproved && (
        <div className="space-y-4">
          {/* Sample Artwork (DTP) Component */}
          <ArtworkPanel
            s={s}
            set={set}
            client={client}
            job={jobData}
            ids={ids}
            phase="sample"
          />

          {/* Sample Production, Delivery, & Client Approval Component */}
          {!s.revOpen ? (
            <SampleFlow
              s={s}
              set={set}
              client={client}
              job={jobData}
              ids={ids}
              e={eData}
              onApprove={(logData) =>
                set({
                  approved: true,
                  sub: 0,
                  sampleOk: logData || { method: "WhatsApp", date: todayISO() },
                  finalQty: s.finalQty || s.qty || 100
                })
              }
              onRevision={() => set({ revOpen: true })}
            />
          ) : (
            <RevisionPanel
              s={s}
              set={set}
              job={jobData}
              onCancel={() => set({ revOpen: false })}
            />
          )}
        </div>
      )}

      {/* PHASE 3: PRODUCTION ORDER PIPELINE (After Sample Approval, Before Post Release) */}
      {sampleIsApproved && !isReleased && (
        <div className="space-y-4">
          <OrderPipeline
            s={s}
            set={set}
            client={client}
            job={jobData}
            ids={ids}
          />
        </div>
      )}

      {/* PHASE 4: POST-RELEASE PRODUCTION & DISPATCH STAGE */}
      {isReleased && (
        <div className="space-y-4">
          {/* 1. Production Artwork (DTP Phase 2 with full list) */}
          <ArtworkPanel
            s={s}
            set={set}
            client={client}
            job={jobData}
            ids={ids}
            phase="prod"
          />

          {/* 2. Pre-Production Sample Desk (When PP is enabled on Direct Production) */}
          {(s.pp || s.ppAfter) && (
            <div className="space-y-3">
              {!s.ppApproved ? (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-950 font-bold flex items-center gap-2">
                  <span className="text-base">⏳</span>
                  <span>
                    <b>Production Hub Hold Active:</b> Full bulk run is on hold until the client inspects and approves the 1-piece pre-production sample.
                  </span>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-950 font-bold flex items-center gap-2">
                  <span className="text-base">✓</span>
                  <span>
                    <b>Pre-production sample approved!</b> Bulk factory production released for {s.finalQty || s.qty || 100} pieces.
                  </span>
                </div>
              )}

              <SampleProofApprovalDesk
                s={s}
                set={set}
                client={client}
                job={jobData}
                ids={ids}
                mode="pre_production"
                onApprove={(logData) => {
                  set({
                    ppApproved: true,
                    ppOk: logData || { method: "WhatsApp", date: todayISO() },
                  });
                  toast.success("Pre-production sample approved! Bulk factory run released.");
                }}
                onRevision={() => {
                  toast.info("Alteration logged. Production alerted to make adjustment.");
                }}
              />
            </div>
          )}

          {/* 3. Pending on this job (Screenshot 3) */}
          <PendingOnJob
            s={s}
            set={set}
            client={client}
            ids={ids}
            items={items}
          />

          {/* 4. Goods out · dispatch details (Screenshot 1) */}
          <DispatchPanel
            s={s}
            set={set}
            client={client}
            ids={ids}
          />

          {/* 4. After-sales & Delivery Confirmation */}
          <AfterSales
            s={s}
            set={set}
            client={client}
          />

          {/* 5. Job financials */}
          <FinLedger
            s={s}
            set={set}
            client={client}
            f={f}
            ids={ids}
            items={items}
            job={job}
          />

        </div>
      )}

      {/* Job Score Widget */}
      <ScorePanel
        s={s}
        client={client}
        f={f}
      />

      {/* Bottom Action Footer */}
      <div className="flex justify-between items-center pt-4 border-t border-gray-200">
        <button
          className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer transition"
          onClick={() => set({ sent: false, approved: false, released: false })}
        >
          ← Modify details
        </button>
        <button
          className="px-5 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-2xs cursor-pointer transition"
          onClick={() => set(null)}
        >
          Log another enquiry
        </button>
      </div>

      {/* Proof Document Modals */}
      {previewDocModal === "pi" && (
        <PreviewProformaSheet
          s={s}
          set={set}
          client={client}
          job={jobData}
          ids={ids}
          items={items}
          onClose={() => setPreviewDocModal(null)}
          onSend={() => setPreviewDocModal(null)}
        />
      )}

      {previewDocModal === "sample_photo" && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 text-left border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-xl">🏆</span>
                <div>
                  <h3 className="font-extrabold text-sm text-gray-900">
                    Sample v2 Photo Proof
                  </h3>
                  <p className="text-[10px] text-gray-400 font-medium">
                    Approved by client · Ready for production
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDocModal(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold flex items-center justify-center cursor-pointer transition"
              >
                ✕
              </button>
            </div>

            <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center p-4">
              <div className="text-center space-y-2">
                <div className="w-48 h-48 mx-auto bg-gradient-to-tr from-amber-100 to-indigo-100 rounded-xl border border-indigo-200 flex items-center justify-center text-5xl shadow-inner">
                  🏆
                </div>
                <div className="font-bold text-xs text-gray-800">
                  {s.theme || s.e?.theme || "Million Dollar Club Trophy"} · Plaque
                </div>
                <div className="text-[11px] text-gray-500">
                  Fusion Crystal + MDF · Metal base · Size: 11 in
                </div>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs space-y-1">
              <div className="flex justify-between items-center text-[10px] text-emerald-800 font-bold">
                <span>WhatsApp +91 9820055123 · 10 Oct 2026 16:12</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[9px]">Approved</span>
              </div>
              <p className="text-emerald-950 italic text-[11px]">
                "Approved: Production follows this sample."
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setPreviewDocModal(null)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-2xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {previewDocModal === "enquiry_brief" && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 text-left border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-xl">📋</span>
                <div>
                  <h3 className="font-extrabold text-sm text-gray-900">
                    Enquiry Brief v1.0
                  </h3>
                  <p className="text-[10px] text-gray-400 font-medium">
                    Reference: {ids.enq || "ENQ/26/0415"} · Confirmed enquiry brief
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDocModal(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold flex items-center justify-center cursor-pointer transition"
              >
                ✕
              </button>
            </div>

            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Client:</span>
                <span className="font-bold text-gray-900">{client?.name || client?.company || "Meridian Pharma Pvt Ltd"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Occasion:</span>
                <span className="font-semibold text-gray-800">{s.e?.occasion || "Annual Awards Conference"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Quantity:</span>
                <span className="font-semibold text-gray-800">{s.finalQty || 140} pieces</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Theme & Size:</span>
                <span className="font-semibold text-gray-800">{s.theme || "Million Dollar Club Trophy"} · 11 in & 18 in</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Target Budget:</span>
                <span className="font-semibold text-gray-800">₹3,000 - ₹3,500 / piece</span>
              </div>
            </div>

            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-xs space-y-1">
              <div className="flex justify-between items-center text-[10px] text-indigo-800 font-bold">
                <span>WhatsApp +91 9820055123 · 10 Oct 2026 15:45</span>
                <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[9px]">Enquiry Won</span>
              </div>
              <p className="text-indigo-950 italic text-[11px]">
                "Confirmed! Please proceed with the sample piece."
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setPreviewDocModal(null)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-2xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SendStep;
