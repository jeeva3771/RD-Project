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
  allItems
} from "../../utils/helpers";
import { toast } from "react-toastify";
import PreviewSampleConfirmationSheet from "./PreviewSampleConfirmationSheet";
import SendDocumentOverlay from "../common/SendDocumentOverlay";
import CommunicationLogForm from "../common/CommunicationLogForm";
import RevisionPanel from "./RevisionPanel";

const SampleFlow = ({ s, set, client, job, ids = {}, e = {}, onApprove, onRevision }) => {
  const v = roundOf(s).v;
  const f = sfOf(s);
  const locked = !dtpDone(s, "sample");
  const video = sampleVideo(s);

  const parentJobNo = s?.seq
    ? String(s.seq).startsWith("RD")
      ? s.seq
      : `RD${s.seq}`
    : (ids?.enq?.startsWith("RD") ? ids.enq : ids?.enq?.replace("ENQ/26/", "RD")) || "RD21071";

  const allJobItems = subJobsOf(s, parentJobNo);
  const displayItems = allJobItems.length > 0
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
      <div className="w-full bg-white border-2 border-amber-400 rounded-xl shadow-sm p-5 space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">🧪</span>
          <h3 className="font-bold text-sm text-gray-900">
            Sample v{v} · production & delivery
          </h3>
        </div>
        <p className="text-[11px] text-gray-500">
          Shop floor makes the sample piece, then it goes to the client for final inspection.
        </p>
      </div>

      <div className="space-y-3">
        {/* Mixed order callout in SampleFlow */}
        {allItems(s).some((x) => x.kind === "ready") && (
          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center gap-2.5 text-xs text-indigo-950 font-medium">
            <span className="text-base">ℹ️</span>
            <span>
              <b>Mixed order:</b> Sampling covers the custom designed pieces only. Ready stock items will be produced and packed directly with the final production run.
            </span>
          </div>
        )}

        {/* Step 1: Sample Production */}
        <div
          className={`p-3.5 rounded-xl border transition ${
            f.readyAt
              ? "bg-emerald-50 border-emerald-200 text-emerald-950"
              : "bg-amber-50/70 border-amber-200 text-gray-900"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  f.readyAt ? "bg-emerald-500 text-white" : "bg-amber-400 text-amber-950"
                }`}
              >
                {f.readyAt ? "✓" : "1"}
              </span>
              <div>
                <b className="text-xs font-bold block">Sample production</b>
                <small className="text-[10px] text-gray-500 block">
                  {f.readyAt
                    ? `Sample ready ${dfmt(f.readyAt)} · on time`
                    : "Being made on the shop floor"}
                </small>
              </div>
            </div>

            {!f.readyAt ? (
              <button
                className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-amber-950 text-xs font-bold rounded-lg shadow-2xs transition cursor-pointer"
                onClick={() => up({ readyAt: new Date().toISOString() })}
              >
                Sample ready
              </button>
            ) : (
              <button
                className="text-[10px] text-gray-400 hover:text-gray-600 underline cursor-pointer"
                onClick={() =>
                  up({
                    readyAt: null,
                    disp: null,
                    deliveredAt: null,
                    photosAt: null
                  })
                }
              >
                Undo
              </button>
            )}
          </div>

          {/* Once sample is ready: Upload sample photo for each design & send proof for approval */}
          {f.readyAt && (
            <div className="mt-3 pt-3 border-t border-emerald-200/70 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">📸</span>
                  <b className="text-xs font-bold text-gray-900">Sample photos for approval</b>
                </div>
                <span className="text-[10px] text-gray-500">
                  Attach photo of made sample piece per design
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {displayItems.map((item, idx) => {
                  const imgKey = item.subJobNo || `item_${idx}`;
                  const uploadedImg = samplePhotos[imgKey] || f.samplePhotos?.[imgKey];
                  return (
                    <div
                      key={imgKey}
                      className="p-2.5 bg-white border border-gray-200 rounded-xl flex items-center justify-between gap-2.5 shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {uploadedImg?.url ? (
                          <img
                            src={uploadedImg.url}
                            alt={item.subJobNo}
                            className="w-12 h-12 object-cover rounded-lg border border-gray-200 shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-gray-50 border border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 shrink-0">
                            <span className="text-base">🏆</span>
                            <span className="text-[8px] font-bold">Photo</span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-gray-900 truncate">
                            {item.subJobNo} · {item.theme || item.product || `Design ${idx + 1}`}
                          </div>
                          <div className="text-[10px] text-gray-500 truncate">
                            {item.size ? `${item.size} in · ` : ""}{item.mat || "Sample piece"}
                          </div>
                          {uploadedImg && (
                            <div className="text-[9px] text-emerald-600 font-semibold truncate">
                              ✓ {uploadedImg.name || "Photo attached"}
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <input
                          type="file"
                          id={`upload-sample-${imgKey}`}
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleSamplePhotoUpload(imgKey, e)}
                        />
                        <label
                          htmlFor={`upload-sample-${imgKey}`}
                          className="px-2.5 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 text-[10px] font-bold rounded-lg cursor-pointer transition inline-flex items-center gap-1 shrink-0"
                        >
                          <span>📷</span> {uploadedImg ? "Change" : "Upload"}
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Send proof action */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="text-[11px] text-gray-600">
                  {f.sampleProofSent ? (
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <span>✓</span> Sample proof shared via {f.sampleProofSent} ({dfmt(f.sampleProofSentAt || new Date())})
                    </span>
                  ) : (
                    <span>Share photos of finished sample pieces with client for approval</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowSampleProofModal(true)}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-2xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <span>👁️</span> {f.sampleProofSent ? "Resend sample proof" : "Preview and send sample proof"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Sample Delivery */}
        <div
          className={`p-3.5 rounded-xl border transition ${
            isDelivered
              ? "bg-emerald-50 border-emerald-200 text-emerald-950"
              : f.readyAt
              ? "bg-amber-50/70 border-amber-200 text-gray-900"
              : "bg-gray-50 border-gray-100 text-gray-400"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  isDelivered
                    ? "bg-emerald-500 text-white"
                    : f.readyAt
                    ? "bg-amber-400 text-amber-950"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {isDelivered ? "✓" : "2"}
              </span>
              <div>
                <b className="text-xs font-bold block">Sample delivery</b>
                <small className="text-[10px] text-gray-500 block">
                  {video
                    ? f.photosAt
                      ? `Photos & video shared ${dfmt(f.photosAt)}`
                      : "Photos / video only · share them with client"
                    : f.deliveredAt
                    ? `Delivered ${dfmt(f.deliveredAt)} to ${client?.name || "client"}`
                    : f.disp
                    ? `Dispatched ${dfmt(f.disp.date)} · ${f.disp.carrier}`
                    : `To ${client?.name || "client"} · ${carrier || s.sampleCarrier || "Our vehicle"}`}
                </small>
              </div>
            </div>

            {/* Actions for Step 2 */}
            {f.readyAt && video && !f.photosAt && (
              <button
                className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-amber-950 text-xs font-bold rounded-lg shadow-2xs transition cursor-pointer"
                onClick={() => up({ photosAt: new Date().toISOString() })}
              >
                Photos & video shared
              </button>
            )}

            {f.readyAt && !video && f.disp && !f.deliveredAt && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-2xs transition cursor-pointer flex items-center gap-1.5"
                  onClick={() => up({ deliveredAt: todayISO() })}
                >
                  <span>✓</span> Delivered today
                </button>
                <div className="flex items-center gap-1.5 bg-white border border-gray-300 rounded-lg p-1 shadow-2xs">
                  <input
                    type="date"
                    className="px-2 py-0.5 text-xs border-0 outline-none text-gray-700 bg-transparent cursor-pointer font-medium"
                    value={delivDate}
                    onChange={(e) => setDelivDate(e.target.value)}
                  />
                  <button
                    type="button"
                    className="px-3 py-1 bg-gray-100 hover:bg-emerald-600 hover:text-white text-gray-700 text-xs font-semibold rounded-md transition cursor-pointer"
                    onClick={() => up({ deliveredAt: delivDate || todayISO() })}
                  >
                    Delivered
                  </button>
                </div>
              </div>
            )}

            {f.readyAt && !video && f.disp && f.deliveredAt && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="text-[10px] text-gray-400 hover:text-gray-600 underline cursor-pointer"
                  onClick={() => up({ deliveredAt: null })}
                >
                  Undo / Change date
                </button>
              </div>
            )}
          </div>

          {/* Physical dispatch form when sample is ready but not dispatched */}
          {f.readyAt && !video && !f.disp && (
            <div className="mt-3 pt-3 border-t border-amber-200/50 flex flex-wrap items-center gap-3">
              <input
                type="date"
                className="p-1.5 text-xs border border-gray-300 rounded-lg bg-white outline-none"
                value={dispDate}
                onChange={(e) => setDispDate(e.target.value)}
              />
              <select
                className="p-1.5 text-xs border border-gray-300 rounded-lg bg-white outline-none cursor-pointer"
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
              >
                {CARRIERS.map((c) => {
                  const val = c.name || c.v;
                  const icon = c.icon ? `${c.icon} ` : "";
                  return (
                    <option key={val} value={val}>
                      {icon}{val}
                    </option>
                  );
                })}
              </select>
              <input
                type="text"
                placeholder={isRoad ? "Vehicle no. / driver" : "Docket / AWB no."}
                className="p-1.5 text-xs border border-gray-300 rounded-lg bg-white flex-1 min-w-[150px] outline-none"
                value={dispRef}
                onChange={(e) => setDispRef(e.target.value)}
              />
              <button
                className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-amber-950 text-xs font-bold rounded-lg shadow-2xs transition cursor-pointer"
                disabled={!dispRef.trim()}
                onClick={() =>
                  up({
                    disp: {
                      date: dispDate,
                      carrier,
                      ref: dispRef.trim(),
                      at: new Date().toISOString()
                    }
                  })
                }
              >
                Save sample dispatch
              </button>
            </div>
          )}
        </div>

        {/* Step 3: Client Approval / Decision */}
        <div
          className={`p-3.5 rounded-xl border transition ${
            isDelivered
              ? "bg-amber-50/70 border-amber-300 text-gray-900"
              : "bg-gray-50 border-gray-100 text-gray-400 opacity-60"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  isDelivered ? "bg-amber-400 text-amber-950" : "bg-gray-200 text-gray-500"
                }`}
              >
                3
              </span>
              <div>
                <b className="text-xs font-bold block">Client approval</b>
                <small className="text-[10px] text-gray-500 block">
                  {isDelivered
                    ? "The client has the sample. Log their approval or the changes below."
                    : "Unlocks once the sample reaches the client"}
                </small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Section directly below yellow card (Image 2 layout) */}
    {isDelivered && (
      <div className="space-y-4 pt-1">
        {/* Three Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setShowApprovalLog(!showApprovalLog)}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-xs transition cursor-pointer flex items-center gap-2"
          >
            <span>✓</span> Client approved sample v{v}
          </button>

          <button
            type="button"
            onClick={() => {
              if (onRevision) {
                onRevision();
              } else {
                setShowApprovalLog(false);
                setShowRevision((prev) => !prev);
              }
            }}
            className="px-6 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-sm rounded-xl shadow-xs transition cursor-pointer"
          >
            Client wants changes
          </button>

          <button
            type="button"
            onClick={() => setShowSampleConfirmation(true)}
            className="px-6 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-sm rounded-xl shadow-xs transition cursor-pointer"
          >
            Sample confirmation for client
          </button>
        </div>

        {/* Confirmation Log Form for Client Approval (Exact title & card from screenshot) */}
        {showApprovalLog && (
          <div className="fade">
            <CommunicationLogForm
              client={client}
              pName={`Sample v${v}`}
              mode="sample-approval"
              feedbackMode="approve"
              title={`Sample v${v} approved. How did the client confirm?`}
              subTitle="Record how the client said yes, so there’s proof on the job if anything is questioned later."
              buttonText="Log approval and process the order"
              buttonHint="Paste their message or add a screenshot."
              hideCard={false}
              onBack={() => setShowApprovalLog(false)}
              onLog={(logData) => {
                onApprove(logData);
                setShowApprovalLog(false);
                toast.success(`Client approval for Sample v${v} logged successfully!`);
              }}
            />
          </div>
        )}

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
                onClick={() => {
                  const count = Object.values(delinkChecked).filter(Boolean).length;
                  if (count === 0) {
                    toast.warning("Please select at least one product to delink");
                    return;
                  }
                  toast.success(`${count} product(s) delinked and put on hold.`);
                  setShowDelink(false);
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition cursor-pointer"
              >
                Delink and put on hold
              </button>
              <button
                type="button"
                onClick={() => {
                  const count = Object.values(delinkChecked).filter(Boolean).length;
                  if (count === 0) {
                    toast.warning("Please select at least one product to drop");
                    return;
                  }
                  toast.info(`${count} product(s) dropped from job.`);
                  setShowDelink(false);
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 transition ml-auto cursor-pointer"
              >
                Drop completely
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
    )}

    {/* Modal 1: Sample Confirmation for Client */}
    {showSampleConfirmation && (
      <PreviewSampleConfirmationSheet
        s={s}
        e={s.e || e || {}}
        client={client}
        job={job}
        ids={ids || { enq: parentJobNo }}
        onClose={() => setShowSampleConfirmation(false)}
        onSend={(channel = "WhatsApp") => {
          setShowSampleConfirmation(false);
          toast.success(`Sample confirmation sheet sent via ${channel}!`);
        }}
      />
    )}

    {/* Modal 2: Sample Proof Modal for Client Approval */}
    {showSampleProofModal && (
      <SendDocumentOverlay
        s={s}
        client={client}
        onClose={() => setShowSampleProofModal(false)}
        onSend={(channel = "WhatsApp") => {
          up({
            sampleProofSent: channel,
            sampleProofSentAt: new Date().toISOString(),
            photosAt: new Date().toISOString()
          });
          setShowSampleProofModal(false);
          toast.success(`Sample proof photos sent to client via ${channel}!`);
        }}
      >
        <div className="w-full max-w-4xl mx-auto bg-white shadow-2xl p-8 sm:p-12 rounded-xl mb-8 relative z-10 print-content">
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-indigo-600 pb-4 mb-6">
            <div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">RD Custom Awards Pvt. Ltd.</h1>
              <p className="text-xs text-gray-500 mt-1 font-medium">Sample Photo Proof for Client Approval</p>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-black text-indigo-900 tracking-tight">{parentJobNo}</h2>
              <p className="text-xs font-semibold text-gray-500 mt-0.5">Sample v{v}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
          </div>

          {/* Client Details */}
          <div className="grid grid-cols-2 gap-8 text-xs mb-8 bg-gray-50/70 p-4 rounded-xl border border-gray-100">
            <div>
              <span className="text-gray-400 font-semibold block text-[10px] uppercase tracking-wider mb-1">Client</span>
              <div className="font-bold text-gray-900 text-sm">{client?.name || "Client"}</div>
              <div className="text-gray-500 mt-0.5">{client?.billing || client?.city || "Mumbai"}</div>
            </div>
            <div>
              <span className="text-gray-400 font-semibold block text-[10px] uppercase tracking-wider mb-1">Attention</span>
              <div className="font-bold text-gray-900">{client?.contact || client?.name || "Client Representative"}</div>
              <div className="text-gray-500 mt-0.5">{client?.mobile || "+91 9867123456"}</div>
            </div>
          </div>

          {/* Designs & Sample Photos */}
          <div className="space-y-6 mb-8">
            <h3 className="font-black text-sm text-gray-900 border-b pb-2">
              Sample Pieces Made on Shop Floor ({displayItems.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {displayItems.map((item, idx) => {
                const imgKey = item.subJobNo || `item_${idx}`;
                const uploadedImg = samplePhotos[imgKey] || f.samplePhotos?.[imgKey];
                return (
                  <div key={imgKey} className="border border-gray-200 rounded-xl overflow-hidden shadow-xs bg-white">
                    <div className="h-52 bg-gray-100 flex items-center justify-center overflow-hidden border-b border-gray-100">
                      {uploadedImg?.url ? (
                        <img
                          src={uploadedImg.url}
                          alt={item.subJobNo}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="text-center p-4">
                          <span className="text-4xl block mb-2">🏆</span>
                          <span className="text-xs font-semibold text-gray-400">Sample Piece Photo</span>
                          <p className="text-[10px] text-gray-400 mt-1">Ready on shop floor</p>
                        </div>
                      )}
                    </div>
                    <div className="p-3.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-black text-indigo-700">{item.subJobNo}</span>
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          Sample v{v} Ready
                        </span>
                      </div>
                      <div className="text-xs font-bold text-gray-900">{item.theme || item.product || "Custom Trophy"}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        {item.size || 8} in · {item.mat || "Acrylic"} · {item.qty || 100} pcs final run
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-950">
            <b>Client Inspection Note:</b> Please inspect the physical finish, engraving, logo alignment, and proportions. Reply with your confirmation or any alterations required.
          </div>
        </div>
      </SendDocumentOverlay>
    )}
  </>
);
};

export default SampleFlow;
