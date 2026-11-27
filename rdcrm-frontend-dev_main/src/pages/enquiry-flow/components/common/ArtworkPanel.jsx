import React, { useState } from "react";
import { dtpOf, dtpState, DTP_LABEL, proofLine, dfmt, allReady, allItems } from "../../utils/helpers";
import CommunicationLogForm from "./CommunicationLogForm";
import ArtworkProofSheet from "../Steps/ArtworkProofSheet";
import { toast } from "react-toastify";

const ArtworkPanel = ({ s, set, client, job, ids = {}, phase = "sample" }) => {
  const d = dtpOf(s, phase);
  const st = dtpState(s, phase);
  const isS = phase === "sample";
  const round = d.round || 1;
  const title = isS ? "Sample artwork (DTP)" : "Production artwork (DTP)";

  const [busy, setBusy] = useState(false);
  const [cap, setCap] = useState(false);
  const [corrOpen, setCorrOpen] = useState(false);
  const [corrText, setCorrText] = useState("");
  const [showProofSheet, setShowProofSheet] = useState(false);
  const [inputText, setInputText] = useState(d.text || "");
  const [fileName, setFileName] = useState(d.content?.name || "");

  const up = (p) => {
    set({
      dtp: {
        ...(s.dtp || {}),
        [phase]: {
          ...d,
          ...p
        }
      }
    });
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setBusy(true);
      setTimeout(() => {
        setFileName(file.name);
        up({
          content: { name: file.name, rows: isS ? null : 40, parsed: true },
          contentAt: new Date().toISOString()
        });
        setBusy(false);
        toast.success(`Content file "${file.name}" uploaded successfully!`);
      }, 300);
    }
  };

  const handleProofUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setBusy(true);
      setTimeout(() => {
        up({
          proofFile: {
            name: file.name,
            size: file.size,
            uploadedAt: new Date().toISOString()
          },
          proofAt: new Date().toISOString(),
          round
        });
        setBusy(false);
        toast.success(`DTP Proof "${file.name}" uploaded successfully!`);
      }, 400);
    }
  };

  const handleSendBackToDTP = () => {
    if (!corrText.trim()) return;
    up({
      corrections: [
        ...(d.corrections || []),
        { round, note: corrText.trim(), at: new Date().toISOString() }
      ],
      round: round + 1,
      proofAt: null,
      proofSent: null,
      sentAt: new Date().toISOString()
    });
    setCorrText("");
    setCorrOpen(false);
  };

  // If approved or skipped, show the compact completed card
  if (st === "approved" || st === "skipped") {
    return (
      <div className="w-full bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 shadow-2xs transition-all">
        {showProofSheet && (
          <ArtworkProofSheet
            s={s}
            set={set}
            client={client}
            job={job}
            ids={ids}
            phase={phase}
            onBack={() => setShowProofSheet(false)}
            onMarkSent={(method) => {
              up({ proofSent: method || "WhatsApp" });
              setShowProofSheet(false);
            }}
          />
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
              {st === "skipped" ? "–" : "✓"}
            </span>
            <div>
              <b className="text-[13px] text-gray-900 block font-bold">
                {title} · {DTP_LABEL[st]}
              </b>
              <small className="text-[11px] text-gray-500 block">
                {st === "approved"
                  ? `Round ${round} · ${proofLine(d.approved)}${
                      d.content
                        ? ` · ${d.content.name}${d.content.rows ? ` (${d.content.rows} names)` : ""}`
                        : ""
                    }`
                  : "Marked as not needed for this job"}
              </small>
            </div>
          </div>
          <button
            className="text-[11px] font-bold text-gray-400 hover:text-gray-600 underline cursor-pointer"
            onClick={() => up({ approved: null, skipped: false })}
          >
            Reopen
          </button>
        </div>
      </div>
    );
  }

  // Active / in-progress DTP Card (Matches Screenshots 1, 3, 4, 5)
  const earlierCorrectionsText = (d.corrections || [])
    .map((c) => `R${c.round}: ${c.note}`)
    .join(" · ");

  return (
    <div className="w-full bg-white border-2 border-amber-400 rounded-xl shadow-sm overflow-hidden transition-all">
      {showProofSheet && (
        <ArtworkProofSheet
          s={s}
          set={set}
          client={client}
          job={job}
          ids={ids}
          phase={phase}
          onBack={() => setShowProofSheet(false)}
          onMarkSent={(method) => {
            up({ proofSent: method || "WhatsApp" });
            setShowProofSheet(false);
          }}
        />
      )}
      {/* Header with Round Title */}
      <div className="p-4 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold bg-indigo-50 text-indigo-600">
            ✏️
          </div>
          <h4 className="font-bold text-sm text-gray-900">
            {title} · round {round}
          </h4>
        </div>
        <p className="text-[11px] text-gray-500 ml-8">
          {isS
            ? "Artwork for the single sample piece. It goes to the client for approval before the shop floor makes the sample."
            : "Full name list and content for the order. DTP prepares the artwork; the client approves the proof before the run."}
        </p>

        {/* 4 Steps Indicator Bar */}
        <div className="flex items-center gap-2 mt-3 ml-8 text-[10px] font-bold">
          {[
            { k: "content", label: "1 Content" },
            { k: "dtp", label: "2 DTP proof" },
            { k: "client", label: "3 Client" },
            { k: "approved", label: "4 Approved" }
          ].map((step, idx) => {
            const stepOrder = ["content", "ready", "dtp", "proof", "client", "approved"];
            const isPassed = stepOrder.indexOf(st) >= stepOrder.indexOf(step.k);
            return (
              <span
                key={step.k}
                className={`px-3 py-1 rounded-full transition-all ${
                  isPassed
                    ? "bg-amber-100 text-amber-900 border border-amber-300"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {isPassed && idx < 3 ? "✓ " : ""}
                {step.label}
              </span>
            );
          })}
        </div>

        {/* Ready stock notice if present */}
        {allReady(s) ? (
          <div className="mt-3 ml-8 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs text-emerald-900">
            <div className="flex items-center gap-2">
              <span>🏆</span>
              <span>
                <b>Ready stock order:</b> Stock trophy is ready; DTP is only needed if text engraving / logo plate is required.
              </span>
            </div>
            <button
              type="button"
              onClick={() => up({ skipped: true })}
              className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 underline cursor-pointer ml-2 shrink-0"
            >
              Skip artwork (No engraving)
            </button>
          </div>
        ) : allItems(s).some((x) => x.kind === "ready") ? (
          <div className="mt-3 ml-8 p-2 bg-gray-50 border border-gray-200 rounded-lg text-[11px] text-gray-700 font-medium">
            🏆 <b>Also in this order:</b> Ready stock items included (no 3D design approval needed for ready stock).
          </div>
        ) : null}
      </div>

      <div className="p-5 ml-2 space-y-4 text-xs">
        {/* Row 1: Content Input / File */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="w-16 font-bold text-gray-700 pt-1 text-[11px]">Content</div>
          <div className="flex-1 space-y-2">
            {d.content?.name || fileName ? (
              <div className="flex items-center gap-2 text-[11px] bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg w-fit">
                <span className="text-gray-400">📎</span>
                <span className="text-gray-700 font-medium">
                  {d.content?.name || fileName}
                  {d.content?.rows ? ` · ${d.content.rows} names / lines` : ""}
                </span>
                <label className="font-bold text-indigo-600 hover:text-indigo-800 ml-2 cursor-pointer">
                  Replace
                  <input type="file" hidden onChange={handleFileUpload} />
                </label>
              </div>
            ) : (
              <label className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white border border-gray-300 hover:border-gray-400 text-gray-700 rounded-lg text-xs font-semibold cursor-pointer shadow-2xs hover:bg-gray-50 transition w-fit">
                <span>📎</span> Upload content file (.xlsx, .csv, .docx, .pdf)
                <input type="file" hidden onChange={handleFileUpload} />
              </label>
            )}
            {isS && (
              <input
                type="text"
                className="w-full p-2.5 text-xs border border-gray-200 rounded-lg focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none"
                placeholder='Text on the sample, e.g. "Top Performer 2026 · Anita Desai"'
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  up({ text: e.target.value });
                }}
              />
            )}
            {!isS && !d.content && (
              <span className="text-[11px] text-rose-600 font-semibold block">
                Awaiting the content list from the client
              </span>
            )}
          </div>
        </div>

        {/* Row 2: DTP Operations */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 border-t border-gray-100 pt-4">
          <div className="w-16 font-bold text-gray-700 text-[11px] pt-1">DTP</div>
          <div className="flex-1 space-y-1.5">
            {st === "content" && (
              <span className="text-[11px] text-gray-400">
                {isS
                  ? "Add the sample text or file, then send to DTP."
                  : "Upload the content to send it to DTP."}
              </span>
            )}

            {st === "ready" && (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  className="px-5 py-2.5 bg-amber-400 hover:bg-amber-500 text-amber-950 font-bold rounded-lg shadow-2xs transition cursor-pointer"
                  onClick={() => up({ sentAt: new Date().toISOString() })}
                >
                  Send to DTP
                </button>
                <span className="text-[11px] text-gray-400">
                  DTP load today: 5 jobs · usual turnaround {isS ? "4 h" : "1 day"}
                </span>
              </div>
            )}

            {st === "dtp" && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="px-3 py-1 bg-amber-100 text-amber-900 border border-amber-200 rounded-full font-bold text-[11px]">
                  With DTP since {dfmt(d.sentAt)}
                </span>
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-sm transition cursor-pointer">
                  <span>📁</span>
                  <span>{busy ? "Uploading..." : "Upload DTP proof"}</span>
                  <input
                    type="file"
                    hidden
                    disabled={busy}
                    accept=".pdf,.png,.jpg,.jpeg,.ai,.cdr,.eps"
                    onChange={handleProofUpload}
                  />
                </label>
                <button
                  type="button"
                  className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold rounded-lg transition cursor-pointer"
                  onClick={() => {
                    up({
                      proofFile: {
                        name: isS ? "Sample_Artwork_Proof_v1.pdf" : "Production_Artwork_Proof_v1.pdf",
                        size: 1048576,
                        uploadedAt: new Date().toISOString()
                      },
                      proofAt: new Date().toISOString(),
                      round
                    });
                    toast.success("DTP Proof simulated successfully!");
                  }}
                >
                  Simulate: DTP sends the proof
                </button>
              </div>
            )}

            {/* Proof Ready Pill (Screenshots 1, 3, 4, 5) */}
            {(st === "proof" || st === "client") && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="px-4 py-1.5 bg-[#EEEDFE] text-[#3126B4] font-bold rounded-full text-xs inline-block">
                    Proof ready · round {round} · {dfmt(d.proofAt || new Date())}
                  </span>
                  {d.proofFile ? (
                    <div className="flex items-center gap-2 text-[11px] bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg">
                      <span className="text-gray-400">📄</span>
                      <span className="text-gray-800 font-medium">{d.proofFile.name}</span>
                      <label className="font-bold text-indigo-600 hover:text-indigo-800 ml-2 cursor-pointer">
                        Replace
                        <input
                          type="file"
                          hidden
                          disabled={busy}
                          accept=".pdf,.png,.jpg,.jpeg,.ai,.cdr,.eps"
                          onChange={handleProofUpload}
                        />
                      </label>
                    </div>
                  ) : (
                    <label className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer">
                      + Upload proof file
                      <input
                        type="file"
                        hidden
                        disabled={busy}
                        accept=".pdf,.png,.jpg,.jpeg,.ai,.cdr,.eps"
                        onChange={handleProofUpload}
                      />
                    </label>
                  )}
                </div>
                {earlierCorrectionsText && (
                  <div className="text-[11px] text-gray-500 mt-1.5 ml-1">
                    Earlier corrections: {earlierCorrectionsText}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Row 3: Client Row & Actions (Screenshots 1, 3, 4, 5) */}
        {(st === "proof" || st === "client") && (
          <div className="flex flex-col sm:flex-row sm:items-start gap-4 border-t border-gray-100 pt-4">
            <div className="w-16 font-bold text-gray-700 pt-2 text-[11px]">Client</div>
            <div className="flex-1 space-y-3">
              {/* SCREENSHOT 1: When Proof is ready, but not yet sent to client */}
              {st === "proof" && (
                <div className="space-y-2">
                  <span className="text-xs text-gray-500 block">
                    Goes to {client?.name || "Client Name Ltd"}.
                  </span>
                  <button
                    type="button"
                    className="px-5 py-2.5 bg-amber-400 hover:bg-amber-500 text-amber-950 font-bold text-xs rounded-xl shadow-2xs transition cursor-pointer"
                    onClick={() => setShowProofSheet(true)}
                  >
                    Preview and send proof
                  </button>
                </div>
              )}

              {/* SCREENSHOT 3, 4, 5: When proof has been sent to client */}
              {st === "client" && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="px-3.5 py-1.5 bg-[#FFF8D6] text-amber-900 border border-[#FBE577] rounded-full font-semibold text-xs">
                      Sent via {d.proofSent || "Hand-delivered / other"} · awaiting approval
                    </span>
                    <button
                      type="button"
                      className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold text-xs rounded-xl shadow-2xs transition cursor-pointer"
                      onClick={() => setShowProofSheet(true)}
                    >
                      Resend
                    </button>
                    <button
                      type="button"
                      className="px-5 py-2 bg-[#059669] hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-2xs transition cursor-pointer"
                      onClick={() => setCap(true)}
                    >
                      Artwork approved
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold text-xs rounded-xl shadow-2xs transition cursor-pointer"
                      onClick={() => setCorrOpen(true)}
                    >
                      Corrections asked
                    </button>
                  </div>

                  {/* SCREENSHOT 4 & 5: Inline Corrections Form */}
                  {corrOpen && (
                    <div className="flex flex-wrap items-center gap-2 pt-1 fade">
                      <input
                        type="text"
                        autoFocus
                        className="p-2 text-xs border-2 border-indigo-500 rounded-lg outline-none bg-white min-w-[240px] flex-1 max-w-md focus:ring-1 focus:ring-indigo-400"
                        placeholder="What needs correcting? e.g. Spelling, logo size..."
                        value={corrText}
                        onChange={(e) => setCorrText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && corrText.trim()) {
                            handleSendBackToDTP();
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="px-4 py-2 border border-gray-300 hover:bg-gray-100 text-gray-700 font-semibold text-xs rounded-lg transition cursor-pointer"
                        onClick={() => {
                          setCorrOpen(false);
                          setCorrText("");
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={!corrText.trim()}
                        className="px-5 py-2 bg-amber-400 hover:bg-amber-500 disabled:opacity-40 text-amber-950 font-bold text-xs rounded-lg shadow-2xs transition cursor-pointer"
                        onClick={handleSendBackToDTP}
                      >
                        Send back to DTP
                      </button>
                    </div>
                  )}

                  {/* Approval Log Capture Modal */}
                  {cap && (
                    <div className="mt-2 border border-gray-200 rounded-xl bg-gray-50 p-4 relative fade">
                      <button
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 cursor-pointer"
                        onClick={() => setCap(false)}
                      >
                        ✖
                      </button>
                      <h4 className="text-xs font-bold text-gray-800 mb-3 ml-1">
                        Log client approval for {title} (Round {round})
                      </h4>
                      <CommunicationLogForm
                        client={client}
                        mode="design"
                        feedbackMode="approve"
                        hideCard={true}
                        onBack={() => setCap(false)}
                        onLog={(logData) => {
                          up({ approved: logData });
                          setCap(false);
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Skip Option Footer */}
      {isS && st !== "client" && (
        <div className="px-5 py-3.5 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between">
          <button
            type="button"
            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer transition"
            onClick={() => up({ skipped: true })}
          >
            No artwork needed for this sample
          </button>
          <span className="text-[10px] text-gray-400">
            Skips DTP and proceeds directly to sample production
          </span>
        </div>
      )}
    </div>
  );
};

export default ArtworkPanel;
