import React, { useState } from "react";
import { inr, dfmt, todayISO, allReady, formatEnquiryNo, ENQUIRY_CONFIG, deriveDocNo } from "../../../utils/helpers";
import PackDelivery from "../PackDelivery";
import ClientLogoUploader from "../brief-step/ClientLogoUploader";
import SignaturesManager from "../brief-step/SignaturesManager";
import AdditionalFilesUploader from "../brief-step/AdditionalFilesUploader";
import { axiosInstance } from "../../../../../utils/url/config";
import { toast } from "react-toastify";

const PackAndPostTab = ({
  s,
  set,
  client,
  items,
  ids,
  totalPcs,
  currentV,
  effectiveAdv,
  contentStatus,
  setContentStatus,
  contentFileName,
  setContentFileName = () => {},
  packingListStatus,
  setPackingListStatus,
  packingListFileName,
  setPackingListFileName,
  clientChanges,
  priority,
  setPriority,
  autoRemindClient,
  setAutoRemindClient,
  postNotes,
  setPostNotes,
  setShowReminderModal,
  setSub,
}) => {
  const [activeAssetModal, setActiveAssetModal] = useState(null); // 'logo' | 'signature' | 'additional_files' | null

  // 1. Inspect Brief Step requirement flags (Logo, Signature, Additional Files)
  const isLogoMandatory = Boolean(
    (s.e?.is_logo_mandatory ?? s.e?.isLogoMandatory ?? s.the_brief?.is_logo_mandatory) ||
    (s.sub_jobs || []).some((sj) => sj.is_logo_mandatory) ||
    Object.values(s.e?.productBriefs || {}).some((pb) => pb.is_logo_mandatory || pb.isLogoMandatory)
  );

  const isSignatureMandatory = Boolean(
    (s.e?.is_signature_mandatory ?? s.e?.isSignatureMandatory ?? s.the_brief?.is_signature_mandatory) ||
    (s.sub_jobs || []).some((sj) => sj.is_signature_mandatory) ||
    Object.values(s.e?.productBriefs || {}).some((pb) => pb.is_signature_mandatory || pb.isSignatureMandatory)
  );

  const isAdditionalFilesMandatory = Boolean(
    (s.e?.is_additional_files_mandatory ?? s.e?.isAdditionalFilesMandatory ?? s.the_brief?.is_additional_files_mandatory) ||
    (s.sub_jobs || []).some((sj) => sj.is_additional_files_mandatory) ||
    Object.values(s.e?.productBriefs || {}).some((pb) => pb.is_additional_files_mandatory || pb.isAdditionalFilesMandatory)
  );

  // Helper functions to deduplicate assets across global state and sub-jobs
  const getAssetKey = (item) => {
    if (!item) return "";
    if (typeof item === "string") return item.split("?")[0].trim();
    const cleanUrl = (item.file_url || item.url || item.signed_url || "").split("?")[0].trim();
    if (cleanUrl) return cleanUrl;
    if (item.id) return String(item.id).trim();
    if (item.file_name || item.name) return String(item.file_name || item.name).trim();
    try {
      return JSON.stringify(item);
    } catch {
      return String(item);
    }
  };

  const dedupeAssets = (arr) => {
    const seen = new Set();
    const unique = [];
    for (const item of arr || []) {
      if (!item) continue;
      const key = getAssetKey(item);
      if (!key) continue;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(item);
      }
    }
    return unique;
  };

  const getSigKey = (item) => {
    if (!item) return "";
    if (typeof item === "string") return item.split("?")[0].trim();
    const cleanUrl = (item.file_url || item.url || item.signed_url || "").split("?")[0].trim();
    const nameStr = (item.name || "").trim().toLowerCase();
    const desigStr = (item.designation || "").trim().toLowerCase();
    if (cleanUrl) return cleanUrl;
    if (nameStr) return `${nameStr}_${desigStr}`;
    if (item.id) return String(item.id).trim();
    try {
      return JSON.stringify(item);
    } catch {
      return String(item);
    }
  };

  const dedupeSignatures = (arr) => {
    const seen = new Set();
    const unique = [];
    for (const item of arr || []) {
      if (!item) continue;
      const key = getSigKey(item);
      if (!key) continue;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(item);
      }
    }
    return unique;
  };

  // 2. Collect uploaded assets across global & sub-jobs (deduplicated by file/identity)
  const rawLogos = [
    ...(s.clientLogo || []),
    ...(s.e?.globalLogos || []),
    ...(s.e?.clientLogo || []),
    ...(s.e?.clientLogos || []),
    ...((s.sub_jobs || []).flatMap((sj) => sj.client_logo || [])),
    ...Object.values(s.e?.productBriefs || {}).flatMap((pb) => pb.clientLogo || pb.client_logo || []),
  ].filter(Boolean);
  const uploadedLogos = dedupeAssets(rawLogos);

  const rawSignatures = [
    ...(s.signatures || []),
    ...(s.e?.globalSignatures || []),
    ...(s.e?.signatures || []),
    ...((s.sub_jobs || []).flatMap((sj) => sj.signatures || [])),
    ...Object.values(s.e?.productBriefs || {}).flatMap((pb) => pb.signatures || []),
  ].filter(Boolean);
  const uploadedSignatures = dedupeSignatures(rawSignatures);

  const rawAdditionalFiles = [
    ...(s.additionalFiles || []),
    ...(s.e?.globalAdditionalFiles || []),
    ...(s.e?.additionalFiles || []),
    ...(s.e?.additional_files || []),
    ...((s.sub_jobs || []).flatMap((sj) => sj.additional_files || [])),
    ...Object.values(s.e?.productBriefs || {}).flatMap((pb) => pb.additionalFiles || pb.additional_files || []),
  ].filter(Boolean);
  const uploadedAdditionalFiles = dedupeAssets(rawAdditionalFiles);

  const hasLogos = uploadedLogos.length > 0;
  const hasSignatures = uploadedSignatures.length > 0;
  const hasAdditionalFiles = uploadedAdditionalFiles.length > 0;

  const hasAnyBriefMandatory = isLogoMandatory || isSignatureMandatory || isAdditionalFilesMandatory;

  // 3. Asset Change Handlers matching Brief step capabilities
  const handleLogosChange = (nextLogos) => {
    set({
      clientLogo: nextLogos,
      e: {
        ...(s.e || {}),
        globalLogos: nextLogos,
        clientLogo: nextLogos,
        clientLogos: nextLogos,
      },
      sub_jobs: (s.sub_jobs || []).map((sj) => ({
        ...sj,
        client_logo: nextLogos,
      })),
    });
    const patchId = s.dbJobId || s._id || s.rawJob?._id || ids?.id || (s?.seq ? formatEnquiryNo(s.seq) : ids?.enq);
    if (patchId) {
      axiosInstance.put(`/enquiry-flow-integration/${patchId}`, {
        enquiry_no: s.enquiry_no || ids?.enq,
        clientLogo: nextLogos,
        globalLogos: nextLogos,
      }).catch(() => {});
    }
  };

  const handleSignaturesChange = (nextSigs) => {
    set({
      signatures: nextSigs,
      e: {
        ...(s.e || {}),
        globalSignatures: nextSigs,
        signatures: nextSigs,
      },
      sub_jobs: (s.sub_jobs || []).map((sj) => ({
        ...sj,
        signatures: nextSigs,
      })),
    });
    const patchId = s.dbJobId || s._id || s.rawJob?._id || ids?.id || (s?.seq ? formatEnquiryNo(s.seq) : ids?.enq);
    if (patchId) {
      axiosInstance.put(`/enquiry-flow-integration/${patchId}`, {
        enquiry_no: s.enquiry_no || ids?.enq,
        signatures: nextSigs,
        globalSignatures: nextSigs,
      }).catch(() => {});
    }
  };

  const handleAdditionalFilesChange = (nextFiles) => {
    set({
      additionalFiles: nextFiles,
      e: {
        ...(s.e || {}),
        globalAdditionalFiles: nextFiles,
        additionalFiles: nextFiles,
        additional_files: nextFiles,
      },
      sub_jobs: (s.sub_jobs || []).map((sj) => ({
        ...sj,
        additional_files: nextFiles,
      })),
      contentStatus: nextFiles.length > 0 ? "received" : contentStatus,
    });
    const patchId = s.dbJobId || s._id || s.rawJob?._id || ids?.id || (s?.seq ? formatEnquiryNo(s.seq) : ids?.enq);
    if (patchId) {
      axiosInstance.put(`/enquiry-flow-integration/${patchId}`, {
        enquiry_no: s.enquiry_no || ids?.enq,
        additionalFiles: nextFiles,
        globalAdditionalFiles: nextFiles,
      }).catch(() => {});
    }
  };

  const [isPostingToHub, setIsPostingToHub] = useState(false);

  // 4. Build dynamic checklist (Client Logo, Signatures, and Additional Files are always visible)
  const checklist = [];

  // 1. Client logo (Always visible; mandatory only if enabled in brief)
  checklist.push({
    id: "logo",
    title: "Client logo",
    isMandatory: isLogoMandatory,
    isReceived: hasLogos,
    receivedText: `Received · ${uploadedLogos.length} logo${uploadedLogos.length > 1 ? "s" : ""}`,
    notReceivedText: isLogoMandatory
      ? "Not received · Logo mandatory for design / DTP"
      : "Not received · Optional (Upload logo for design)",
    type: "logo",
  });

  // 2. Signatures (Always visible; mandatory only if enabled in brief)
  const sigNames = uploadedSignatures.map((sg) => sg.name).filter(Boolean);
  checklist.push({
    id: "signature",
    title: "Signatures",
    isMandatory: isSignatureMandatory,
    isReceived: hasSignatures,
    receivedText: `Received · ${uploadedSignatures.length} signature${uploadedSignatures.length > 1 ? "s" : ""}${sigNames.length > 0 ? ` (${sigNames.slice(0, 2).join(", ")}${sigNames.length > 2 ? "..." : ""})` : ""}`,
    notReceivedText: isSignatureMandatory
      ? "Not received · Signatures mandatory for awards / citations"
      : "Not received · Optional (Upload signatures)",
    type: "signature",
  });

  // 3. Additional files / Content (Always visible; mandatory only if enabled in brief)
  const isAddlReceived = hasAdditionalFiles || (!isAdditionalFilesMandatory && contentStatus === "received");
  checklist.push({
    id: "additional_files",
    title: "Additional files",
    isMandatory: isAdditionalFilesMandatory,
    isReceived: isAddlReceived,
    receivedText: hasAdditionalFiles
      ? `Received · ${uploadedAdditionalFiles.length} file${uploadedAdditionalFiles.length > 1 ? "s" : ""}`
      : `Received · ${contentFileName || "Content marked received"}`,
    notReceivedText: isAdditionalFilesMandatory
      ? "Not received · Names / citation list mandatory"
      : "Not received · Optional (Names, logos, text)",
    type: "additional_files",
  });

  // Packing list (Not mandatory for push to production hub; can attach before or after)
  checklist.push({
    id: "packing_list",
    title: "Packing list",
    isMandatory: false,
    isReceived: packingListStatus === "received",
    receivedText: `Received · ${packingListFileName || "Packing list attached"}`,
    notReceivedText: "Not received · Can attach before or after push to production",
    type: "packing_list",
  });

  // Advance
  checklist.push({
    id: "advance",
    title: "Advance",
    isMandatory: false,
    isReceived: Boolean(s.rcpt),
    receivedText: `Received · ${inr(s.rcpt?.amount || effectiveAdv)} (${s.rcpt?.mode || "NEFT"})`,
    notReceivedText: `Not received · ${inr(effectiveAdv)} due`,
    type: "advance",
  });

  const missingMandatoryAssets = checklist.filter((item) => item.isMandatory && !item.isReceived);
  const hasMissingMandatory = missingMandatoryAssets.length > 0;
  const totalChecklistCount = checklist.length;
  const receivedCount = checklist.filter((item) => item.isReceived).length;

  const handlePostToProductionHub = async () => {
    if (!s.packOk || !s.delivOk || !s.pi?.sent || !s.costOk || hasMissingMandatory || isPostingToHub) {
      if (hasMissingMandatory) {
        toast.warning(
          `Please attach mandatory DTP files before posting: ${missingMandatoryAssets.map((a) => a.title).join(", ")}`
        );
      }
      return;
    }

    try {
      setIsPostingToHub(true);
      const targetDbId = s.dbJobId || s._id || s.rawJob?._id || ids?.id;
      const targetJobNo = s?.seq ? formatEnquiryNo(s.seq) : (ids?.enq || ids?.id);

      const payload = {
        packingDetails: s.pack || {},
        deliveryDetails: s.deliv || {},
        postNotes: postNotes || "",
        priority: priority || "Normal",
        clientLogo: s.clientLogo || uploadedLogos,
        signatures: s.signatures || uploadedSignatures,
        additionalFiles: s.additionalFiles || uploadedAdditionalFiles,
      };

      const res = await axiosInstance.post(
        `/enquiry-flow-integration/${targetDbId || targetJobNo}/push-production`,
        payload
      );

      if (res.data?.success) {
        const hubNo = res.data.hubDocNo || ids.ph || deriveDocNo(ids.enq, "PH");
        set({
          released: true,
          releasedAt: new Date().toISOString(),
          hub: {
            no: hubNo,
            at: new Date().toISOString(),
          },
        });
        toast.success(`✓ Order posted to Production Hub successfully! (${hubNo})`);
      } else {
        toast.error(res.data?.message || "Failed to post order to Production Hub.");
      }
    } catch (err) {
      console.error("Error posting to Production Hub:", err);
      toast.error(err.response?.data?.message || "Server error posting order to Production Hub.");
    } finally {
      setIsPostingToHub(false);
    }
  };

  return (
    <div className="space-y-6 text-xs">
      {/* Packing & Delivery Module */}
      <PackDelivery s={s} set={set} client={client} items={items} />

      {/* Post to Production Hub Card */}
      <div className="p-6 bg-white border border-gray-200 rounded-2xl shadow-xs space-y-6 text-left">
        {/* Header */}
        <div className="flex items-start gap-3">
          <span className="text-2xl mt-0.5">🏭</span>
          <div>
            <h3 className="text-base font-black text-gray-900 tracking-tight">
              Post to Production Hub
            </h3>
            <p className="text-xs text-gray-500 font-medium">
              {items.length} items · {totalPcs} pcs · follow sample v{currentV}
            </p>
          </div>
        </div>

        {/* Ready Stock Notice */}
        {allReady(s) && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-xs text-emerald-900 font-medium">
            <span className="text-xl">⚡</span>
            <div>
              <b className="font-bold block">Ready stock order</b>
              <span>
                Every item is ready stock, so production and packing can start directly without 3D custom design prototyping.
              </span>
            </div>
          </div>
        )}

        {/* Pre-production (PP) Sample Notice */}
        {s.ppAfter && (
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
              s.ppApproved
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-amber-50 border-amber-200 text-amber-900"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🔬</span>
              <div>
                <b className="font-bold block">Pre-production (PP) Sample Flow</b>
                <span>
                  {s.ppApproved
                    ? `Approved · Bulk production cleared on ${dfmt(
                        s.ppApprovedAt || todayISO()
                      )}`
                    : "1 test sample piece to be made & approved first. Bulk run holds until client sign-off."}
                </span>
              </div>
            </div>
            {!s.ppApproved && (
              <span className="px-2.5 py-1 rounded-full bg-amber-200 text-amber-900 text-[10px] font-black uppercase tracking-wider shrink-0">
                PP Hold Active
              </span>
            )}
          </div>
        )}

        {/* Box: Before it goes to the shop floor */}
        <div className="border border-gray-200 rounded-2xl p-4 bg-gray-50/40 space-y-3">
          <div className="flex items-center justify-between pb-1">
            <b className="text-xs font-black text-gray-900">
              Before it goes to the shop floor
            </b>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#fff1eb] text-[#d9531e] border border-[#fed7c7]">
              {receivedCount} of {totalChecklistCount} received
            </span>
          </div>

          {/* Dynamic Checklist Items */}
          {checklist.map((item) => (
            <div
              key={item.id}
              className={`p-3 rounded-xl flex items-center justify-between border ${
                item.isReceived
                  ? "bg-[#eefbf4] border-[#a2e8c1]"
                  : item.isMandatory
                  ? "bg-[#fef2f2] border-[#fca5a5]"
                  : "bg-amber-50/40 border-amber-200"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`w-5 h-5 rounded-full text-white flex items-center justify-center font-bold text-xs shrink-0 ${
                    item.isReceived
                      ? "bg-[#10b981]"
                      : item.isMandatory
                      ? "bg-rose-500"
                      : "bg-amber-500"
                  }`}
                >
                  {item.isReceived ? "✓" : "!"}
                </span>
                <div className="min-w-0">
                  <div className="font-bold text-xs text-gray-900 flex items-center gap-1.5 flex-wrap">
                    <span>{item.title}</span>
                    {item.isMandatory ? (
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded-md border border-rose-200">
                        Mandatory
                      </span>
                    ) : item.id !== "packing_list" && item.id !== "advance" ? (
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-md border border-gray-200">
                        Optional
                      </span>
                    ) : null}
                  </div>
                  <div
                    className={`text-[11px] font-medium truncate ${
                      item.isReceived
                        ? "text-[#059669]"
                        : item.isMandatory
                        ? "text-rose-600"
                        : "text-amber-800"
                    }`}
                  >
                    {item.isReceived ? item.receivedText : item.notReceivedText}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 ml-3">
                {item.type === "logo" && (
                  <button
                    type="button"
                    onClick={() => setActiveAssetModal("logo")}
                    className={`px-3.5 py-1.5 font-bold rounded-lg text-xs shadow-2xs transition cursor-pointer flex items-center gap-1.5 ${
                      item.isReceived
                        ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : "bg-white hover:bg-gray-50 border border-gray-300 text-gray-700"
                    }`}
                  >
                    <span>🏢</span>
                    <span>
                      {item.isReceived
                        ? `Manage Logos (${uploadedLogos.length})`
                        : "+ Attach Logo"}
                    </span>
                  </button>
                )}

                {item.type === "signature" && (
                  <button
                    type="button"
                    onClick={() => setActiveAssetModal("signature")}
                    className={`px-3.5 py-1.5 font-bold rounded-lg text-xs shadow-2xs transition cursor-pointer flex items-center gap-1.5 ${
                      item.isReceived
                        ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : "bg-white hover:bg-gray-50 border border-gray-300 text-gray-700"
                    }`}
                  >
                    <span>✍️</span>
                    <span>
                      {item.isReceived
                        ? `Manage Signatures (${uploadedSignatures.length})`
                        : "+ Add Signatures"}
                    </span>
                  </button>
                )}

                {(item.type === "additional_files" || item.type === "content") && (
                  <button
                    type="button"
                    onClick={() => setActiveAssetModal("additional_files")}
                    className={`px-3.5 py-1.5 font-bold rounded-lg text-xs shadow-2xs transition cursor-pointer flex items-center gap-1.5 ${
                      item.isReceived
                        ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : "bg-white hover:bg-gray-50 border border-gray-300 text-gray-700"
                    }`}
                  >
                    <span>📎</span>
                    <span>
                      {item.isReceived
                        ? `Manage Files (${uploadedAdditionalFiles.length})`
                        : "+ Attach Files"}
                    </span>
                  </button>
                )}

                {item.id === "packing_list" && item.isReceived && (
                  <button
                    type="button"
                    onClick={() => {
                      setPackingListStatus("not_received");
                      setPackingListFileName("");
                      set({ packingListStatus: "not_received", packingListFileName: "" });
                      const patchId = s.dbJobId || s._id || s.rawJob?._id || ids?.id || (s?.seq ? formatEnquiryNo(s.seq) : ids?.enq);
                      if (patchId) {
                        axiosInstance.put(`/enquiry-flow-integration/${patchId}`, {
                          enquiry_no: s.enquiry_no || ids?.enq,
                          packingListStatus: "not_received",
                          packingListFileName: "",
                        }).catch(() => {});
                      }
                    }}
                    className="text-[11px] font-bold text-gray-400 hover:text-gray-600 underline cursor-pointer"
                  >
                    Remove
                  </button>
                )}

                {item.id === "advance" && !item.isReceived && (
                  <button
                    type="button"
                    onClick={() => setSub(1)}
                    className="text-xs font-bold text-gray-600 hover:text-indigo-600 underline cursor-pointer"
                  >
                    Record it in Financials
                  </button>
                )}

                {item.id === "packing_list" && !item.isReceived && (
                  <label className="px-4 py-1.5 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-bold rounded-lg text-xs shadow-2xs transition cursor-pointer flex items-center gap-1">
                    <span>Attach</span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".xlsx,.xls,.csv,.pdf,image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setPackingListStatus("received");
                          setPackingListFileName(file.name);
                          set({
                            packingListStatus: "received",
                            packingListFileName: file.name,
                          });
                          const patchId = s.dbJobId || s._id || s.rawJob?._id || ids?.id || (s?.seq ? formatEnquiryNo(s.seq) : ids?.enq);
                          if (patchId) {
                            axiosInstance.put(`/enquiry-flow-integration/${patchId}`, {
                              enquiry_no: s.enquiry_no || ids?.enq,
                              packingListStatus: "received",
                              packingListFileName: file.name,
                            }).catch(() => {});
                          }
                          toast.success(`✓ ${file.name} attached!`);
                        }
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          ))}

          {/* Footnotes */}
          <div className="text-[11px] font-medium pt-1">
            {hasMissingMandatory ? (
              <span className="text-rose-600 font-bold flex items-center gap-1.5">
                <span>⚠️</span>
                <span>
                  Mandatory files required for DTP: {missingMandatoryAssets.map((a) => a.title).join(", ")} must be attached before posting to shop floor.
                </span>
              </span>
            ) : (
              <span className="text-gray-500">
                All mandatory DTP assets received. Order is ready to be posted to the shop floor.
              </span>
            )}
          </div>
          <div className="text-[11px] text-gray-500 font-medium flex items-center gap-1.5 flex-wrap">
            <span>After posting:</span>
            <span className="text-gray-700 font-semibold">
              🖊 Production artwork (DTP)
            </span>
            <span>→</span>
            <span className="text-gray-700 font-semibold">
              📦 Goods out · dispatch details
            </span>
            <span>→</span>
            <span className="text-gray-700 font-semibold">💰 Job financials.</span>
          </div>
        </div>

        {/* Client changes */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 py-3 border-b border-gray-100">
          <div className="w-full sm:w-44 shrink-0 font-bold text-gray-900 text-xs">
            Client changes
          </div>
          <div className="flex-1 text-xs text-gray-700 font-medium leading-relaxed">
            {clientChanges}
          </div>
        </div>

        {/* Content from client */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 py-3 border-b border-gray-100">
          <div className="w-full sm:w-44 shrink-0">
            <div className="font-bold text-gray-900 text-xs">
              Content from client
            </div>
            <div className="text-[10px] text-gray-400 font-normal">
              Names, logos, text
            </div>
          </div>
          <div className="flex-1 space-y-1.5">
            <div className="inline-flex rounded-xl bg-gray-100 p-1 border border-gray-200">
              <button
                type="button"
                onClick={() => {
                  setContentStatus("awaiting");
                  set({ contentStatus: "awaiting" });
                }}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  contentStatus === "awaiting"
                    ? "bg-white text-gray-900 shadow-2xs"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Awaiting from client
              </button>
              <button
                type="button"
                onClick={() => {
                  setContentStatus("received");
                  set({ contentStatus: "received" });
                }}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  contentStatus === "received"
                    ? "bg-white text-gray-900 shadow-2xs"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Received
              </button>
            </div>
            <div className="text-[11px] text-gray-400">
              Posted now; processing starts when it arrives.
            </div>
          </div>
        </div>

        {/* Priority */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 py-3 border-b border-gray-100">
          <div className="w-full sm:w-44 shrink-0 font-bold text-gray-900 text-xs">
            Priority
          </div>
          <div className="flex-1">
            <div className="inline-flex rounded-xl bg-gray-100 p-1 border border-gray-200">
              {["Normal", "Urgent"].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setPriority(p);
                    set({ priority: p });
                  }}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    priority === p
                      ? "bg-white text-gray-900 shadow-2xs"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Payment reminder (Advance not received) */}
        {!s.rcpt && (
          <div className="flex flex-col sm:flex-row sm:items-start gap-4 py-3 border-b border-gray-100">
            <div className="w-full sm:w-44 shrink-0">
              <div className="font-bold text-gray-900 text-xs">
                Payment reminder
              </div>
              <div className="text-[10px] text-gray-400 font-normal">
                Advance not received
              </div>
            </div>
            <div className="flex-1 space-y-3">
              <div className="p-4 bg-white border border-gray-200 rounded-2xl flex items-center gap-3.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setAutoRemindClient(!autoRemindClient)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                    autoRemindClient ? "bg-indigo-600" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      autoRemindClient ? "transform translate-x-5" : ""
                    }`}
                  />
                </button>
                <div>
                  <div className="font-bold text-xs text-gray-900">
                    Auto-remind the client
                  </div>
                  <div className="text-[11px] text-gray-500">
                    Sends on posting, then on Thu, 22 Oct
                  </div>
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setShowReminderModal(true)}
                  className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 font-bold rounded-xl text-xs shadow-2xs transition cursor-pointer"
                >
                  Preview reminder
                </button>
              </div>

              <div className="text-[11px] text-gray-400 leading-relaxed">
                {inr(effectiveAdv)} advance pending. The reminder says the invoice won't be generated and dispatch will be delayed until it's received.
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 py-3">
          <div className="w-full sm:w-44 shrink-0">
            <div className="font-bold text-gray-900 text-xs">Notes</div>
            <div className="text-[10px] text-gray-400 font-normal">Optional</div>
          </div>
          <div className="flex-1">
            <input
              type="text"
              placeholder="e.g. Winner list expected Friday"
              value={postNotes}
              onChange={(e) => {
                setPostNotes(e.target.value);
                set({ postNotes: e.target.value });
              }}
              className="w-full px-4 py-2.5 text-xs text-gray-800 border border-gray-200 rounded-xl outline-none focus:border-indigo-500 transition shadow-2xs"
            />
          </div>
        </div>

        {/* Pre-Production Sample Notice */}
        {(s.pp || s.ppAfter) && (
          <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs text-indigo-950 flex items-center gap-2.5">
            <span className="text-lg">🧪</span>
            <div>
              <b>Pre-production sample active:</b> Upon posting to the Hub, 1 piece will be made first on the shop floor. Photos and video will be shared with the client for inspection and approval before releasing the bulk factory run.
            </div>
          </div>
        )}

        {/* Production Hub Active Released Banner */}
        {s.released && (
          <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl flex items-center justify-between text-xs text-emerald-950 shadow-2xs">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-sm shrink-0">
                ✓
              </span>
              <div>
                <b className="block text-sm font-black text-emerald-950">
                  Active in Production Hub ({s.hub?.no || "Verified"})
                </b>
                <span className="text-emerald-800 text-[11px]">
                  All sub-jobs are verified and posted to the Production Hub. Operators can claim and process tasks on the floor.
                </span>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-200 text-emerald-900 text-xs font-black uppercase tracking-wider shrink-0">
              In Production
            </span>
          </div>
        )}

        {/* Bottom Action */}
        <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-gray-100">
          <button
            type="button"
            disabled={!s.packOk || !s.delivOk || !s.pi?.sent || !s.costOk || hasMissingMandatory || isPostingToHub || s.released}
            className={`px-8 py-3 rounded-xl font-bold transition text-xs shadow-xs flex items-center gap-2 ${
              s.released
                ? "bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-default"
                : s.packOk && s.delivOk && s.pi?.sent && s.costOk && !hasMissingMandatory && !isPostingToHub
                ? "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
            onClick={handlePostToProductionHub}
          >
            {isPostingToHub ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Posting to Hub...</span>
              </>
            ) : s.released ? (
              <>
                <span>✓</span>
                <span>Posted to Production Hub ({s.hub?.no || "Active"})</span>
              </>
            ) : (
              <span>Post to Production Hub</span>
            )}
          </button>
          {(!s.packOk || !s.delivOk) && !s.released && (
            <span className="text-xs text-gray-400 font-medium">
              Confirm packing first.
            </span>
          )}
          {s.packOk && s.delivOk && (!s.pi?.sent || !s.costOk) && !s.released && (
            <span className="text-xs text-amber-700 font-bold">
              Proforma invoice must be sent and approved in Financials tab first.
            </span>
          )}
          {s.packOk && s.delivOk && s.pi?.sent && s.costOk && hasMissingMandatory && !s.released && (
            <span className="text-xs text-rose-700 font-bold flex items-center gap-1.5">
              <span>🔒</span>
              <span>
                Missing mandatory DTP attachments: {missingMandatoryAssets.map((a) => a.title).join(", ")}. Please attach before posting to shop floor.
              </span>
            </span>
          )}
        </div>

        <div className="pt-1">
          <button
            type="button"
            className="px-5 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold rounded-xl transition cursor-pointer text-xs"
            onClick={() => setSub(1)}
          >
            ← Back
          </button>
        </div>
      </div>

      {/* Asset Manager Modal (Brief-grade uploaders for Logo, Signatures & Files) */}
      {activeAssetModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setActiveAssetModal(null)}
        >
          <div
            className="w-full max-w-2xl bg-white rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">
                  {activeAssetModal === "logo"
                    ? "🏢"
                    : activeAssetModal === "signature"
                    ? "✍️"
                    : "📎"}
                </span>
                <div>
                  <h3 className="text-sm font-black text-gray-900">
                    {activeAssetModal === "logo"
                      ? "Manage Client Logos"
                      : activeAssetModal === "signature"
                      ? "Manage Signatories & Signatures"
                      : "Manage Additional Files & Documents"}
                  </h3>
                  <p className="text-[11px] text-gray-500 font-medium">
                    {activeAssetModal === "logo"
                      ? "Upload at least 1 client logo image (PNG, JPG, SVG, WebP). Multiple logos supported."
                      : activeAssetModal === "signature"
                      ? "Add signatory name, designation, and upload signature image file. Multiple signatories supported."
                      : "Upload client spreadsheets (awardee list), PDFs, documents, or vector assets."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveAssetModal(null)}
                className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold flex items-center justify-center transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="pt-2">
              {activeAssetModal === "logo" && (
                <ClientLogoUploader
                  logos={uploadedLogos}
                  onChange={handleLogosChange}
                  clientId={client?.id || client?._id || ""}
                  clientName={client?.name || ""}
                  enquiryNo={ids?.enq || "RD_ENQUIRY"}
                />
              )}

              {activeAssetModal === "signature" && (
                <SignaturesManager
                  signatures={uploadedSignatures}
                  onChange={handleSignaturesChange}
                  clientId={client?.id || client?._id || ""}
                  clientName={client?.name || ""}
                  enquiryNo={ids?.enq || "RD_ENQUIRY"}
                />
              )}

              {activeAssetModal === "additional_files" && (
                <AdditionalFilesUploader
                  files={uploadedAdditionalFiles}
                  onChange={handleAdditionalFilesChange}
                  clientId={client?.id || client?._id || ""}
                  clientName={client?.name || ""}
                  enquiryNo={ids?.enq || "RD_ENQUIRY"}
                />
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveAssetModal(null)}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PackAndPostTab;

