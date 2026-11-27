import React, { useEffect, useState } from "react";
import { ORIGINS, COORDS } from "../../utils/constants";
import {
  ORIGIN_ICON,
  LOST,
  contactsOf,
  validMobile,
  validEmail,
  allReady,
  matLabel,
  dfmt,
  inr,
  r10,
  proofLine,
  quoteRecipient
} from "../../utils/helpers";
import ContactEditor from "./ContactEditor";
import BillingParty from "./BillingParty";
import PrintEnquiryLog from "../print/PrintEnquiryLog";
import DesignPreviewSheet from "./DesignPreviewSheet";
import FinalDesignSheet from "./FinalDesignSheet";
import PreviewQuoteSheet from "./PreviewQuoteSheet";
import ImageLightbox from "../../../common/ImageLightbox";
import CommunicationLogForm from "../common/CommunicationLogForm";
import { toast } from "react-toastify";
import { axiosInstance } from "../../../../utils/url/config";

const LogStep = ({ s, set, client, heat, est, ids, goOrder, activeOrigins: propActiveOrigins }) => {
  const [showDelink, setShowDelink] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [showDesignPreview, setShowDesignPreview] = useState(false);
  const [showFinalDesignShare, setShowFinalDesignShare] = useState(false);
  const [showFinalDesignOptions, setShowFinalDesignOptions] = useState(false);
  const [showPreviewQuoteSheet, setShowPreviewQuoteSheet] = useState(false);
  const [uploadedDesigns, setUploadedDesigns] = useState(s.uploadedDesigns || {});
  const [isUploadingR2, setIsUploadingR2] = useState(false);
  const [unselectedProducts, setUnselectedProducts] = useState(new Set());
  const [previewDesignKey, setPreviewDesignKey] = useState(null);
  const [isSimulatingCosting, setIsSimulatingCosting] = useState(!!(s.simulatedRates && Object.keys(s.simulatedRates).length > 0));
  const [simulatedRates, setSimulatedRates] = useState(s.simulatedRates || {});
  const [quoteSelectedProducts, setQuoteSelectedProducts] = useState(new Set());

  const activeOrigins = propActiveOrigins || s?.activeOrigins || ORIGINS || [];
  const e = s.e || {};
  const setE = (p, typedKey) =>
    set({ e: { ...e, ...p }, typed: typedKey ? { ...s.typed, [typedKey]: true } : s.typed });

  const trophyGroups = e.trophyGroups || [];
  const productsList = trophyGroups.length > 0
    ? trophyGroups.map((g, i) => ({ name: g.theme || `Product ${i + 1}`, items: g.items || [] }))
    : [{ name: e.theme || "Custom Trophy", items: [{ size: e.size || 8, qty: e.qty || 50 }] }];

  // Feedback States
  const [productFeedback, setProductFeedback] = useState({}); // { pIdx: { mode: 'approve'|'revision'|'reject', optIdx: Number, remark: String } }

  const updateProductFeedback = (pIdx, field, value) => {
    setProductFeedback(prev => ({
      ...prev,
      [pIdx]: { ...(prev[pIdx] || {}), [field]: value }
    }));
  };

  const getSubjobId = (index) => {
    let group = 0;
    let variant = 1;
    for (let i = 1; i <= index; i++) {
      if (productsList[i].name === productsList[i - 1].name) {
        variant++;
      } else {
        group++;
        variant = 1;
      }
    }
    return String.fromCharCode(65 + group) + variant;
  };

  const [localConfirmed, setLocalConfirmed] = useState({});
  const [loggingPIdx, setLoggingPIdx] = useState(null);

  const notifyAlert = (message) => {
    toast.warn(message, { position: "top-right", autoClose: 3500 });
  };

  const confirmProductFeedback = (pIdx, communicationLog) => {
    const feedback = { ...productFeedback[pIdx], communication: communicationLog };
    if (!feedback || !feedback.mode) { notifyAlert("Please select a feedback option first.", "Action Required"); return; }
    if (!feedback.optIdxs || feedback.optIdxs.length === 0) { notifyAlert("Please select at least one design option.", "Selection Required"); return; }

    const existingLocal = Array.isArray(localConfirmed[pIdx]) ? localConfirmed[pIdx] : (localConfirmed[pIdx] ? [localConfirmed[pIdx]] : []);
    const updatedConfirmed = { ...localConfirmed, [pIdx]: [...existingLocal, feedback] };
    setLocalConfirmed(updatedConfirmed);

    setProductFeedback(prev => {
      const copy = { ...prev };
      delete copy[pIdx];
      return copy;
    });

    const uploadedPIdxs = productsList.map((_, i) => i).filter(idx => {
      const baseOptCount = (e.briefMode === "each" && e.productBriefs?.[productsList[idx].name]?.designOptions) ? e.productBriefs[productsList[idx].name].designOptions : (e.designOptions || 3);
      const optCount = baseOptCount + (s.extraDesignOptions?.[idx] || 0);
      return Array.from({ length: optCount }).some((_, j) => uploadedDesigns[`${idx}-${j}`]);
    });

    const pendingPIdxs = uploadedPIdxs.filter(idx => {
      const existingSystem = Array.isArray(s.productFeedback?.[idx]) ? s.productFeedback[idx] : (s.productFeedback?.[idx] ? [s.productFeedback[idx]] : []);
      const local = Array.isArray(updatedConfirmed[idx]) ? updatedConfirmed[idx] : (updatedConfirmed[idx] ? [updatedConfirmed[idx]] : []);
      const allFbs = [...existingSystem, ...local];
      if (allFbs.some(fb => fb.mode === 'approve')) return false; // Not pending if approved

      const reviewedSet = new Set();
      allFbs.forEach(fb => fb.optIdxs?.forEach(i => reviewedSet.add(i)));

      const baseOptCount = (e.briefMode === "each" && e.productBriefs?.[productsList[idx].name]?.designOptions) ? e.productBriefs[productsList[idx].name].designOptions : (e.designOptions || 3);
      const optCount = baseOptCount + (s.extraDesignOptions?.[idx] || 0);
      const uploadedCount = Array.from({ length: optCount }).filter((_, i) => uploadedDesigns[`${idx}-${i}`]).length;

      return reviewedSet.size < uploadedCount;
    });

    const allConfirmed = pendingPIdxs.length === 0;

    if (allConfirmed) {
      let allApproved = true;
      let newUploadedDesigns = { ...uploadedDesigns };

      // Merge system feedback with local confirmed, ensuring arrays
      const finalFeedback = { ...(s.productFeedback || {}) };
      let newExtraOpts = { ...(s.extraDesignOptions || {}) };

      uploadedPIdxs.forEach(idx => {
        const sysFbs = Array.isArray(finalFeedback[idx]) ? finalFeedback[idx] : (finalFeedback[idx] ? [finalFeedback[idx]] : []);
        const locFbs = Array.isArray(updatedConfirmed[idx]) ? updatedConfirmed[idx] : (updatedConfirmed[idx] ? [updatedConfirmed[idx]] : []);
        const merged = [...sysFbs, ...locFbs];
        if (merged.length > 0) finalFeedback[idx] = merged;

        if (!merged.some(fb => fb.mode === 'approve')) allApproved = false;

        merged.forEach(fb => {
          if (fb.mode === 'reject' || fb.mode === 'revision') {
            // Only increment extra opts if this feedback was JUST added (in locFbs)
            if (locFbs.includes(fb)) {
              newExtraOpts[idx] = (newExtraOpts[idx] || 0) + fb.optIdxs.length;
            }
          }
        });
      });

      if (allApproved) {
        set({ designApproved: true, productFeedback: finalFeedback, costReq: new Date().toISOString() });
      } else {
        set({ optionsShared: false, productFeedback: finalFeedback, designRound: (s.designRound || 1) + 1, extraDesignOptions: newExtraOpts });
      }
      setLocalConfirmed({});
      setProductFeedback({});
    }
  };

  const flattenedProducts = [];
  productsList.forEach((p, i) => {
    const itemsToMap = (p.items && p.items.length > 0) ? p.items : [{ size: e.size || 8, qty: e.qty || 50 }];
    itemsToMap.forEach((item, j) => {
      if (unselectedProducts.has(i)) return; // Don't cost removed products
      flattenedProducts.push({
        ...p,
        originalProductIndex: i,
        originalItemIndex: j,
        subjobId: `${String.fromCharCode(65 + i)}${j + 1}`,
        size: item.size || e.size || 8,
        qty: item.qty || e.qty || 50,
        rate: item.budget || item.rate || e.targetRate || e.budget || 1210,
        rateKey: `${i}-${j}`
      });
    });
  });

  // Ensure all products are selected by default for quoting
  useEffect(() => {
    if (flattenedProducts.length > 0 && quoteSelectedProducts.size === 0) {
      setQuoteSelectedProducts(new Set(flattenedProducts.map(fp => fp.rateKey)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flattenedProducts.length]);



  useEffect(() => {
    if (simulatedRates && Object.keys(simulatedRates).length > 0) {
      const lines = flattenedProducts.map((p) => {
        const r0 = simulatedRates[p.rateKey]?.rate !== undefined ? simulatedRates[p.rateKey].rate : (p.rate || 1210);
        const sRate = simulatedRates[p.rateKey]?.sample !== undefined ? simulatedRates[p.rateKey].sample : (p.rate ? p.rate + 500 : 1820);
        return {
          id: p.rateKey,
          name: `${ids?.enq || "RD21071"}-${p.subjobId} ${p.name}`,
          spec: `Plaque · Self-standing block · ${p.size} in · Fusion: Crystal + Glass · Metal elements`,
          kind: 'custom',
          source: 'Agreed with client',
          rate: r0,
          slabs: [[p.qty, r0]],
          sampleRate: sRate
        };
      });

      set({
        simulatedRates,
        costing: {
          ...(s.costing || {}),
          ref: ids?.enq || "RD21071",
          rate: lines[0]?.rate || 1210,
          sampleRate: lines[0]?.sampleRate || 1820,
          lines: lines
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulatedRates]);

  const [pendingUpload, setPendingUpload] = useState(null);

  const handleDesignUpload = (pIdx, optIdx, file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPendingUpload({ pIdx, optIdx, file, url });
  };

  const confirmUploadToR2 = async () => {
    if (!pendingUpload) return;
    const { pIdx, optIdx, file, url: localPreviewUrl } = pendingUpload;
    const key = `${pIdx}-${optIdx}`;
    setIsUploadingR2(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("clientId", client?.id || client?._id || s.clientId || "general");
      formData.append("enquiryNo", ids?.enq || `RD${s.seq || 21072}`);
      formData.append("folderType", "design");
      formData.append("subJobNo", `${ids?.enq || `RD${s.seq || 21072}`}-${getSubjobId(pIdx)}`);

      const res = await axiosInstance.post("/enquiry-flow/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const r2Url = res.data?.data?.signed_url || res.data?.data?.file_url || localPreviewUrl;
      setUploadedDesigns((prev) => {
        const next = { ...prev, [key]: r2Url };
        set({ uploadedDesigns: next });
        return next;
      });
      toast.success(`Option ${optIdx + 1} uploaded to Cloudflare R2!`);
    } catch (err) {
      console.warn("Could not upload to R2, saving locally:", err);
      setUploadedDesigns((prev) => {
        const next = { ...prev, [key]: localPreviewUrl };
        set({ uploadedDesigns: next });
        return next;
      });
      toast.info(`Option ${optIdx + 1} attached`);
    } finally {
      setIsUploadingR2(false);
      setPendingUpload(null);
    }
  };

  const removeDesign = (key) => {
    setUploadedDesigns((prev) => {
      const copy = { ...prev };
      delete copy[key];
      set({ uploadedDesigns: copy });
      return copy;
    });
    if (previewDesignKey === key) setPreviewDesignKey(null);
  };

  const toggleProductSelection = (pIdx) => {
    setUnselectedProducts(prev => {
      const next = new Set(prev);
      if (next.has(pIdx)) next.delete(pIdx);
      else next.add(pIdx);
      return next;
    });
  };
  // --- User Role Logic ---
  // --- User Role & Dynamic Coordinators Logic ---
  let authUser = null;
  try {
    const raw = localStorage.getItem("user");
    if (raw) authUser = JSON.parse(raw);
  } catch (e) {
    // ignore error parsing user
  }

  const roleName = String(
    authUser?.role?.name ||
    authUser?.role_obj?.name ||
    authUser?.role ||
    ""
  ).toLowerCase();

  const currentUser = authUser
    ? { ...authUser, name: authUser.name || "Executive", role: roleName || "admin" }
    : { name: "Admin", role: "admin" };
  const currentUserName = currentUser.name;

  // Check if current logged-in user is an Executive (not a Manager or Admin)
  const isCSExec =
    roleName.includes("executive") &&
    !roleName.includes("manager") &&
    !roleName.includes("admin") &&
    !authUser?.is_head;

  // ONLY Admin and Client Servicing Manager can see the Assign to section
  const canAssign =
    (roleName.includes("admin") ||
      roleName.includes("manager") ||
      authUser?.is_head === true) &&
    !isCSExec;

  const [coordinatorsList, setCoordinatorsList] = useState([]);

  useEffect(() => {
    let isMounted = true;
    axiosInstance
      .get("/enquiry-flow/coordinators")
      .then((res) => {
        if (isMounted && res.data?.data && res.data.data.length > 0) {
          setCoordinatorsList(res.data.data);
          // If executive, always assign to their own name
          if (isCSExec) {
            set({ coordinator: currentUserName });
          } else if (!s.coordinator) {
            const matchOwner = res.data.data.find(
              (u) => client && (client.owner === u.name || client.owner_name === u.name)
            );
            if (matchOwner) {
              set({ coordinator: matchOwner.name });
            } else if (res.data.data[0]) {
              set({ coordinator: res.data.data[0].name });
            }
          }
        }
      })
      .catch((err) => {
        console.warn("Could not fetch coordinators:", err);
      });

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCSExec, currentUserName]);

  useEffect(() => {
    // CS Executives get auto-assigned to their own name unconditionally
    if (isCSExec && s.coordinator !== currentUserName) {
      set({ coordinator: currentUserName });
    }
  }, [isCSExec, currentUserName, s.coordinator, set]);

  const initials = (n) =>
    n
      ? n
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
      : "";

  if (!s.enqSent) {
    const ct = contactsOf(client, s).find((x) => x.id === s.contactId);
    const refLooksWrong =
      e.refNo && (validEmail(e.refNo) || /^\+?\d[\d\s-]{8,}$/.test(e.refNo.trim()));
    const canLog = !!e.origin && !!ct && !refLooksWrong;
    const hs = heat ? Math.max(0, Math.min(100, heat.sc)) : 0;
    const ups = heat ? heat.r.filter(([t]) => t === "up") : [];
    const downs = heat ? heat.r.filter(([t]) => t === "down") : [];
    const notes = heat ? heat.r.filter(([t]) => !t) : [];

    return (
      <div className="fade space-y-4">
        {/* Card 1: Who asked? */}
        <section className="lcard panel p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
          <div className="lhead flex items-start gap-3 mb-3">
            <span className="lnum inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-800 text-xs font-bold">
              1
            </span>
            <div>
              <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
                Who asked? <span className="side client text-xs font-normal text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">Client side</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                The person at {client ? client.name : "the client"} who sent the enquiry. Quotes, proformas and confirmations go to them.
              </p>
            </div>
          </div>
          <ContactEditor
            s={s}
            set={set}
            client={client}
            selId={s.contactId}
            onSelect={(v) => set({ contactId: v, touched: { ...s.touched, contactId: "picked" } })}
          />

        </section>

        {/* Card 2: Billing & payment */}
        <section className="lcard panel p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
          <div className="lhead flex items-start gap-3 mb-3">
            <span className="lnum inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-800 text-xs font-bold">
              2
            </span>
            <div>
              <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
                Billing &amp; payment <span className="side client text-xs font-normal text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">Who pays</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Leave as is when {client ? client.name : "client"} pays. Switch if the invoice goes to an agency or another company.
              </p>
            </div>
          </div>
          <BillingParty s={s} set={set} client={client} />
        </section>

        {/* Card 3: How did it come in? */}
        <section className="lcard panel p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
          <div className="lhead flex items-start gap-3 mb-3">
            <span className="lnum inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-800 text-xs font-bold">
              3
            </span>
            <div>
              <h3 className="font-bold text-base text-gray-900">How did it come in?</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {client && client.origin
                  ? `${client.name.split(" ")[0]} usually reaches us by ${client.origin}.`
                  : "Pick the channel."}
              </p>
            </div>
          </div>
          <div className="otiles flex gap-2 flex-wrap mb-4">
            {activeOrigins.length === 0 ? (
              <div className="text-xs text-gray-400 py-2">No lead origins configured in Origin Master.</div>
            ) : (
              activeOrigins.map((o) => {
                const originName = typeof o === "string" ? o : o.name;
                const originIcon = typeof o === "object" && o.icon ? o.icon : (ORIGIN_ICON[originName] || "📝");
                return (
                  <button
                    key={originName}
                    className={`relative p-3 border rounded-xl text-[11px] font-bold flex flex-col items-start gap-2 w-[92px] transition ${e.origin === originName ? "bg-indigo-50 border-indigo-600 text-indigo-800 shadow-sm" : "bg-white text-gray-800 border-gray-200 hover:border-gray-300 shadow-2xs"
                      }`}
                    onClick={() => setE({ origin: originName })}
                  >
                    <span className="text-base">{originIcon}</span>
                    <span>{originName}</span>
                    {client && client.origin === originName && (
                      <em className={`absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded not-italic ${e.origin === originName ? "bg-indigo-600 text-white" : "bg-[#fff1d6] text-[#b37a1c]"}`}>
                        usual
                      </em>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <label className="refl block text-xs font-semibold text-gray-700">
            <span>Client’s reference no. <i className="font-normal text-gray-400">optional</i></span>
            <input
              className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white font-normal focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
              placeholder="Their RFQ, PO or email subject line"
              value={e.refNo || ""}
              onChange={(ev) => setE({ refNo: ev.target.value }, "refNo")}
            />
            {refLooksWrong && (
              <small className="text-red-500 text-xs mt-1 block">
                This looks like {validEmail(e.refNo) ? "an email address" : "a phone number"}. Contact details belong under “Who asked?”.
              </small>
            )}
          </label>
        </section>

        {/* Card A: Assign to (Admin & CS Manager Only) */}
        {canAssign && (
          <section className="lcard adminonly panel p-4 bg-amber-50/50 border border-amber-200 rounded-xl">
            <div className="lhead flex items-start gap-3 mb-3">
              <span className="lnum inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-200 text-amber-900 text-xs font-bold">
                A
              </span>
              <div>
                <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
                  Assign to <span className="side rd text-xs font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">Admin / Manager view</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Visible to Admins and CS Managers. CS executives log enquiries under their own name automatically.
                </p>
              </div>
            </div>
            <div className="ctiles grid grid-cols-1 md:grid-cols-3 gap-3">
              {(coordinatorsList.length > 0 ? coordinatorsList : COORDS.map((name) => ({ name, role: "Client Servicing", open_enquiries: 0 }))).map((c) => {
                const cName = c.name;
                const cRole = c.role || "Client Servicing";
                const openCount = c.open_enquiries || 0;
                const isLightest = coordinatorsList.length > 1 && coordinatorsList.every((x) => (x.open_enquiries || 0) >= openCount);
                const isOwner = client && (client.owner === cName || client.owner_name === cName);
                const isSel = s.coordinator === cName;

                return (
                  <button
                    key={c.id || c._id || cName}
                    type="button"
                    className={`ctile p-3 rounded-lg border text-left transition cursor-pointer ${isSel ? "bg-white border-amber-600 shadow-md ring-2 ring-amber-500/20" : "bg-white border-gray-200 hover:border-amber-400"
                      }`}
                    onClick={() =>
                      set({ coordinator: cName, touched: { ...s.touched, coordinator: "picked" } })
                    }
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="cav w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center shrink-0">
                        {initials(cName)}
                      </span>
                      <div className="truncate">
                        <span className="cn text-xs font-bold text-gray-900 block truncate">{cName}</span>
                        <span className="text-[10px] text-gray-400 block font-normal">{cRole}</span>
                      </div>
                    </div>
                    <span className="cm text-[11px] text-gray-500 block">{openCount} open enquiries</span>
                    <div className="ctags flex gap-1 mt-1.5 flex-wrap">
                      {isOwner && (
                        <em className="own text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-medium not-italic">
                          Handles this client
                        </em>
                      )}
                      {isLightest && (
                        <em className="light text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-medium not-italic">
                          Lightest load
                        </em>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Heat Score Meter (0-100) */}
        {heat && (
          <section className={`lcard heatcard panel p-4 rounded-xl border ${heat.label === 'hot' ? 'bg-red-50/60 border-red-200' : heat.label === 'warm' ? 'bg-amber-50/60 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
            <div className="hrow flex items-center gap-4 mb-3">
              <div className="hbig text-center">
                <b className="text-3xl font-extrabold text-gray-900">{hs}</b>
                <span className="text-xs text-gray-400">/100</span>
              </div>
              <div className="hmid flex-1">
                <div className="htitle flex items-center justify-between mb-1">
                  <span className={`heat text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded ${heat.label === 'hot' ? 'bg-red-600 text-white' : heat.label === 'warm' ? 'bg-amber-500 text-white' : 'bg-slate-600 text-white'}`}>
                    {heat.label === 'hot' ? 'Hot' : heat.label === 'warm' ? 'Warm' : 'Cold'} enquiry
                  </span>
                  <span className="hint text-xs text-gray-400">Sets priority in Design &amp; Costing queues</span>
                </div>
                <div className="meter relative w-full h-3 bg-gray-200 rounded-full overflow-hidden my-1">
                  <div
                    className={`h-full transition-all duration-300 ${heat.label === "hot"
                        ? "bg-red-500"
                        : heat.label === "warm"
                          ? "bg-amber-500"
                          : "bg-slate-500"
                      }`}
                    style={{ width: `${hs}%` }}
                  />
                </div>
                <div className="mscale flex justify-between text-[10px] text-gray-400">
                  <span>Cold 0</span>
                  <span>Warm 50</span>
                  <span>Hot 70</span>
                </div>
              </div>
            </div>

            <div className="hcols grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t text-xs">
              <div>
                <h4 className="font-bold text-emerald-700 mb-1">Pushing it up</h4>
                {ups.length ? (
                  ups.map(([, x]) => (
                    <p key={x} className="up text-emerald-800 font-medium">+ {x}</p>
                  ))
                ) : (
                  <p className="hint text-gray-400">Nothing yet</p>
                )}
              </div>
              <div>
                <h4 className="font-bold text-red-700 mb-1">Holding it back</h4>
                {downs.length ? (
                  downs.map(([, x]) => (
                    <p key={x} className="down text-red-800 font-medium">− {x}</p>
                  ))
                ) : (
                  <p className="hint text-gray-400">Nothing</p>
                )}
              </div>
              {notes.length > 0 && (
                <div>
                  <h4 className="font-bold text-gray-700 mb-1">Worth knowing</h4>
                  {notes.map(([, x]) => (
                    <p key={x} className="text-gray-600">{x}</p>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        <p className="hint text-xs text-gray-500 italic text-center">
          Delivery mode, courier and payment terms aren’t asked here. Terms come from the client master; delivery is picked when the order is confirmed.
        </p>

        {/* Bottom Log Bar */}
        <div className="logbar flex items-center justify-between p-4 bg-white border rounded-xl shadow-lg mt-4">
          <div className="lsum">
            <b className="text-base text-gray-900 block">{ids ? ids.enq : "ENQ/26/0001"}</b>
            <span className="text-xs text-gray-500">
              Client: {ct ? ct.name : "—"} · via {e.origin || "—"}
              {canAssign ? ` · assigned to ${s.coordinator || "—"}` : ""}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              className="btn ghost px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              onClick={() => set({ step: s.step - 1 })}
            >
              ← Back
            </button>
            <button
              className="btn gold px-5 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg disabled:opacity-50 transition"
              disabled={!canLog}
              onClick={() => {
                const now = new Date().toISOString();
                if (allReady(s)) {
                  const rate = est || 1000;
                  set({
                    enqSent: true,
                    loggedAt: now,
                    costReq: now,
                    quoteRate: r10(rate),
                    jobRate: r10(rate)
                  });
                } else {
                  set({ enqSent: true, loggedAt: now, costReq: e.designer ? null : now });
                }
              }}
            >
              Log enquiry
            </button>
          </div>
        </div>
        {!canLog && (
          <p className="hint text-xs text-red-500 text-right">
            {!ct
              ? "Pick who asked."
              : !e.origin
                ? "Pick how it came in."
                : "Fix the client reference."}
          </p>
        )}
      </div>
    );
  }

  // State when Enquiry is logged (s.enqSent === true)
  const quoted = s.quoted;
  const c = s.costing;
  const optDone = !e.designer || s.optionsShared;
  const steps = [
    {
      t: "Enquiry logged",
      s: `${ids ? ids.enq : "ENQ/26/xxxx"} · ${heat ? heat.label : ""}${canAssign ? ` · assigned to ${s.coordinator}` : ""
        }`,
      done: true
    },
    ...(e.designer
      ? [
        {
          t: `Design options sent${(s.designRound || 1) > 1 ? ` (round ${s.designRound})` : ""}`,
          s: s.optionsShared
            ? `To client · via ${s.designVia || "share"}`
            : `Due in ${e.due || 24} hours · Design`,
          done: !!s.optionsShared,
          now: !s.optionsShared
        },
        {
          t: "Design approved",
          s: s.designApproved ? `Approved by client` : s.optionsShared ? "Waiting for client approval" : "Pending",
          done: !!s.designApproved,
          now: s.optionsShared && !s.designApproved
        },
        {
          t: "Final design shared",
          s: s.finalDesignShared ? `With ${client?.name || "client"} · via ${s.finalDesignVia || "share"}` : "Share final design",
          done: !!s.finalDesignShared,
          now: s.designApproved && !s.finalDesignShared
        }
      ]
      : []),
    {
      t: allReady(s) ? "Priced from ready-stock list" : "Rate requested from Costing",
      s: s.costReq
        ? `Sent ${dfmt(s.costReq)} · ${e.qty || 100} pcs, ${e.size || 8} in, ${matLabel(e)}`
        : "Send once spec is clear",
      done: !!s.costReq,
      now: optDone && !s.costReq
    },
    {
      t: c ? "Rate received from Costing" : "Awaiting Costing rate",
      s: c ? `${inr(c.rate)}/pc · sample ${inr(c.sampleRate)}/pc` : s.costReq ? "Waiting for Costing" : "",
      done: !!c,
      now: !!s.costReq && !c
    },
    {
      t: `Quote sent to ${quoteRecipient(s, client)}`,
      s: quoted ? `${ids ? ids.qt : "QT/26/xxxx"} · via ${s.quoteVia}` : c ? "Preview and send" : "",
      done: !!quoted,
      now: !!c && !quoted
    },
    {
      t: "Client decision",
      s: s.lost ? `Lost · ${s.lost}` : s.decision ? `Won · ${proofLine(s.decision)}` : quoted ? "Waiting on client" : "After quote",
      done: !!s.lost || !!s.decision,
      now: quoted && !s.lost && !s.decision
    }
  ];

  return (
    <div className="fade space-y-4 relative">
      {/* Upload Confirmation Modal */}
      {pendingUpload && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-gray-900 text-sm">Confirm Design Upload</h3>
              <button onClick={() => setPendingUpload(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-4 flex flex-col items-center">
              <div className="w-40 h-40 rounded-lg border border-gray-200 overflow-hidden mb-4 bg-gray-50 flex items-center justify-center p-2">
                <img src={pendingUpload.url} className="max-w-full max-h-full object-contain shadow-sm" />
              </div>
              <p className="text-xs text-gray-600 text-center font-medium">Are you sure you want to upload this design for Option {pendingUpload.optIdx + 1}?</p>
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button
                disabled={isUploadingR2}
                onClick={() => setPendingUpload(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={isUploadingR2}
                onClick={confirmUploadToR2}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                {isUploadingR2 ? (
                  <>
                    <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full"></span>
                    <span>Uploading to R2...</span>
                  </>
                ) : (
                  "Upload to Cloud (R2)"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pipeline View */}
      <div className="panel p-4 bg-white border rounded-xl shadow-sm">
        <h4 className="font-bold text-sm text-gray-900 mb-3">Enquiry Lifecycle Pipeline</h4>
        <div className="space-y-3">
          {steps.map((p, i) => (
            <div
              key={i}
              className={`pstep flex items-start gap-3 p-2.5 rounded-lg border transition ${p.done
                  ? "bg-emerald-50/60 border-emerald-200"
                  : p.now
                    ? "bg-amber-50 border-amber-300 ring-1 ring-amber-400/30"
                    : "bg-gray-50 border-gray-200"
                }`}
            >
              <div
                className={`pdot w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${p.done
                    ? "bg-emerald-600 text-white"
                    : p.now
                      ? "bg-amber-500 text-white"
                      : "bg-gray-200 text-gray-600"
                  }`}
              >
                {p.done ? "✓" : i + 1}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm text-gray-900">{p.t}</div>
                {p.s && <div className="text-xs text-gray-500 mt-0.5">{p.s}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* --- NEW POST-LOG PANELS --- */}
      {(() => {
        const parentJobNo = s?.seq
          ? (String(s.seq).startsWith("RD") ? s.seq : `RD${s.seq}`)
          : (ids?.enq || "RD21071");

        const lines = productsList.flatMap((p, i) => {
          const groupChar = String.fromCharCode(65 + i);
          return (p.items || [{ size: e.size || 8, qty: e.qty || 100 }]).map((item, j) => ({
            id: `${parentJobNo}-${groupChar}${j + 1}`,
            name: p.name,
            size: item.size || e.size || 8,
            qty: item.qty || e.qty || 100
          }));
        });
        const numLines = lines.length;
        const productsDesc = productsList.map(p => `${p.name} (${p.items[0]?.size || e.size || 8} in)`).join(' · ');

        const sendingIndices = productsList.map((_, i) => i).filter(i => !unselectedProducts.has(i));
        const hasAtLeastOneUpload = sendingIndices.some(pIdx => {
          return Object.keys(uploadedDesigns).some(k => k.startsWith(`${pIdx}-`));
        });
        const isSendDisabled = sendingIndices.length === 0 || !hasAtLeastOneUpload;

        return (
          <div className="space-y-4">
            {/* Products Panel */}
            <div className="panel p-4 bg-white border border-gray-200 rounded-xl shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-gray-900">Products on this enquiry</h4>
                  <p className="text-xs text-gray-500">{productsDesc}</p>
                </div>
                <button className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 shadow-xs">Change sizes or products</button>
              </div>

              <div className="bg-gray-50/50 border border-gray-200 rounded-xl p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-gray-700">Job {parentJobNo} · {numLines} line{numLines > 1 ? 's' : ''}</span>
                  <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-[10px] font-bold rounded">provisional</span>
                </div>
                <div className="border border-gray-200 bg-white rounded-lg p-2 space-y-1">
                  {lines.map((l) => (
                    <div key={l.id} className="text-[11px] text-gray-700 p-1">
                      <span className="text-indigo-600 font-bold mr-1">{l.id}</span>
                      {l.name} · {l.size} in · {l.qty} pcs
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-500 mt-2">These line numbers are quotable now and lock permanently when the job is Won.</p>
              </div>
            </div>

            {/* Delink Panel */}
            {numLines > 1 && !showDelink && (
              <div className="panel p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
                <h4 className="font-bold text-sm text-gray-900 mb-1">{numLines} products on this job</h4>
                <p className="text-xs text-gray-500 mb-3">Take a product off this job: delink it to a separate job on hold, or remove it completely from the costing, proforma and invoice.</p>
                <button onClick={() => setShowDelink(true)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 shadow-xs">Delink or remove a product</button>
              </div>
            )}

            {/* Expanded Delink Modal-like Inline Panel */}
            {showDelink && (
              <div className="panel p-4 bg-white border-2 border-indigo-200 rounded-xl shadow-sm ring-4 ring-indigo-50 fade">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-indigo-600 font-bold text-xs">■</span>
                  <h4 className="font-bold text-sm text-gray-900">Delink or remove a product</h4>
                </div>
                <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                  The delinked products leaves the job's costing, proforma, advance and invoice. <strong className="text-gray-700">Delink</strong> keeps them as a separate job on hold (in the header) to pick up later. <strong className="text-gray-700">Remove completely</strong> drops them for good.
                </p>

                <div className="space-y-2 mb-4">
                  {lines.map((l) => (
                    <label key={l.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50/50 cursor-pointer hover:bg-gray-100 transition">
                      <div className="flex items-start gap-2">
                        <input type="checkbox" className="mt-1 border-gray-300 rounded text-indigo-600 focus:ring-indigo-500" />
                        <div>
                          <div className="text-xs font-bold text-gray-900">{l.name}</div>
                          <div className="text-[10px] text-gray-500">{l.size} in · {l.qty} pcs · design not approved</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-medium text-gray-400">14 days</span>
                    </label>
                  ))}
                </div>

                <h4 className="font-bold text-xs text-gray-900 mb-2">Why?</h4>
                <div className="flex gap-2 flex-wrap mb-4">
                  {['Design not approved yet', 'Client put it on hold', 'Client chose the other product after the sample', 'Budget not cleared', 'Waiting for quantity / sizes', 'Other'].map(r => (
                    <button key={r} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white text-gray-700 hover:bg-gray-50 transition">{r}</button>
                  ))}
                </div>

                <input
                  placeholder="Note (optional), e.g. Client will confirm after the event committee meets"
                  className="w-full text-xs p-2.5 border border-gray-200 rounded-lg mb-4 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                />

                <div className="flex gap-2 items-center">
                  <button onClick={() => setShowDelink(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 transition">← Back</button>
                  <button className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition">Delink and put on hold</button>
                  <button className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 transition ml-auto">Drop completely</button>
                </div>
              </div>
            )}

            {/* Design Options Panel */}
            <div className="panel p-4 bg-white border-2 border-indigo-600 rounded-xl shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[11px]">🎨</span>
                <h4 className="font-bold text-sm text-gray-900">Design options</h4>
              </div>
              <p className="text-[10px] text-gray-500 mb-4">{numLines} custom product{numLines > 1 ? 's' : ''} · {productsList.map((p, pIdx) => {
                const baseOptCount = (e.briefMode === "each" && e.productBriefs?.[p.name]?.designOptions) ? e.productBriefs[p.name].designOptions : (e.designOptions || 3);
                const optCount = baseOptCount + (s.extraDesignOptions?.[pIdx] || 0);
                return `${p.name} (${optCount} options)`;
              }).join(', ')}</p>

              {/* Product Design Uploaders */}
              <div className="space-y-4 mb-5">
                {productsList.map((p, pIdx) => {
                  const baseOptCount = (e.briefMode === "each" && e.productBriefs?.[p.name]?.designOptions) ? e.productBriefs[p.name].designOptions : (e.designOptions || 3);
                  const optCount = baseOptCount + (s.extraDesignOptions?.[pIdx] || 0);
                  const isApproved = s.productFeedback?.[pIdx]?.mode === 'approve';
                  return (
                    <div key={pIdx} className="border border-gray-200 rounded-lg p-3 bg-gray-50/50">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!unselectedProducts.has(pIdx)}
                            onChange={() => toggleProductSelection(pIdx)}
                            className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
                          />
                          <div className="text-xs font-bold text-gray-900">{p.name} <span className="text-gray-400 font-normal">({optCount} options)</span></div>
                        </div>
                        {s.productFeedback?.[pIdx] && (
                          <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.productFeedback[pIdx].mode === 'approve' ? 'text-emerald-600 bg-emerald-100' : s.productFeedback[pIdx].mode === 'reject' ? 'text-red-600 bg-red-100' : 'text-amber-600 bg-amber-100'}`}>
                            {s.productFeedback[pIdx].mode === 'approve' ? 'Approved' : s.productFeedback[pIdx].mode === 'reject' ? 'Rejected' : 'Changes Asked'}
                            (Opts: {s.productFeedback[pIdx].optIdxs?.map(i => i + 1).join(', ')})
                          </div>
                        )}
                      </div>
                      {s.productFeedback?.[pIdx]?.remark && (
                        <div className="text-[11px] text-gray-600 italic mb-3 px-1 border-l-2 border-indigo-200 ml-1 pl-2">"{s.productFeedback[pIdx].remark}"</div>
                      )}
                      <div className="flex gap-3 overflow-x-auto pb-2">
                        {Array.from({ length: optCount }).map((_, i) => {
                          const fileUrl = uploadedDesigns[`${pIdx}-${i}`];
                          if (fileUrl) {
                            const fbs = Array.isArray(s.productFeedback?.[pIdx]) ? s.productFeedback[pIdx] : (s.productFeedback?.[pIdx] ? [s.productFeedback[pIdx]] : []);
                            const fb = fbs.find(f => f.optIdxs?.includes(i));
                            const mode = fb ? fb.mode : null;
                            const isNewlyUploaded = fileUrl.startsWith('blob:');

                            let borderClass = 'border-gray-200';
                            if (mode === 'approve') borderClass = 'border-emerald-500 ring-2 ring-emerald-200';
                            else if (mode === 'reject') borderClass = 'border-red-500 ring-2 ring-red-200';
                            else if (mode === 'revision') borderClass = 'border-amber-500 ring-2 ring-amber-200';

                            return (
                              <div key={i} className={`w-24 h-24 shrink-0 rounded-xl border-2 ${borderClass} shadow-sm flex flex-col items-center justify-center bg-white cursor-zoom-in group overflow-hidden relative`} onClick={() => setPreviewDesignKey(`${pIdx}-${i}`)}>
                                <img
                                  src={fileUrl}
                                  className="w-full h-full object-cover"
                                  alt={`Option ${i + 1}`}
                                  onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.style.display = "none";
                                    if (e.currentTarget.parentElement) {
                                      const fb = document.createElement("div");
                                      fb.className = "flex flex-col items-center justify-center w-full h-full text-slate-400 bg-slate-50 text-[10px] text-center p-1";
                                      fb.innerHTML = '<span>🎨</span><span>Design Preview</span>';
                                      e.currentTarget.parentElement.appendChild(fb);
                                    }
                                  }}
                                />
                                {mode === 'reject' && <div className="absolute inset-0 bg-red-500/10 pointer-events-none"></div>}
                                {mode === 'revision' && <div className="absolute inset-0 bg-amber-500/10 pointer-events-none"></div>}
                                {mode && (
                                  <div className={`absolute bottom-0 left-0 right-0 text-center text-[9px] font-bold text-white py-0.5 shadow-sm ${mode === 'approve' ? 'bg-emerald-500' : mode === 'reject' ? 'bg-red-500' : 'bg-amber-500'}`}>
                                    {mode === 'approve' ? 'Approved' : mode === 'reject' ? 'Rejected' : 'Changes Asked'}
                                  </div>
                                )}
                                {isNewlyUploaded && !mode && !isApproved && !s.optionsShared && (
                                  <button
                                    type="button"
                                    onClick={(evt) => { evt.stopPropagation(); removeDesign(`${pIdx}-${i}`); }}
                                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 hover:bg-red-600 text-white text-[10px] font-black flex items-center justify-center transition shadow-sm"
                                    title="Remove"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            );
                          }
                          return !isApproved ? (
                            <label key={i} className="w-24 h-24 shrink-0 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center bg-white cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition group overflow-hidden relative">
                              <span className="text-2xl text-gray-300 group-hover:text-indigo-400 font-light">+</span>
                              <span className="text-[10px] font-semibold text-gray-400 group-hover:text-indigo-500 mt-1">Option {i + 1}</span>
                              <input type="file" accept="image/*" className="hidden" onChange={(evt) => handleDesignUpload(pIdx, i, evt.target.files[0])} />
                            </label>
                          ) : null;
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {!s.optionsShared ? (
                <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-2">
                  <div>
                    <p className="text-xs text-indigo-700 font-medium leading-tight">Send design options for approval to</p>
                    <p className="text-[10px] text-gray-500">Goes to {client?.name || "Client"}.</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-gray-400 max-w-[150px] text-right leading-tight hidden sm:block">Click preview to review and send.</span>
                    <button
                      disabled={isSendDisabled}
                      className={`px-4 py-2 text-white text-xs font-bold rounded-lg transition shadow-sm ${isSendDisabled ? "bg-gray-300 cursor-not-allowed" : "bg-amber-500 hover:bg-amber-600"}`}
                      onClick={() => setShowDesignPreview(true)}
                    >
                      Preview and send design options
                    </button>
                  </div>
                </div>
              ) : !s.designApproved ? (
                <div className="border-t border-gray-100 pt-4 mt-2">
                  <p className="text-xs text-indigo-700 font-medium leading-tight mb-3">Client Response (Per Product)</p>

                  <div className="space-y-4">
                    {productsList.map((p, pIdx) => {
                      const baseOptCount = (e.briefMode === "each" && e.productBriefs?.[p.name]?.designOptions) ? e.productBriefs[p.name].designOptions : (e.designOptions || 3);
                      const optCount = baseOptCount + (s.extraDesignOptions?.[pIdx] || 0);
                      const uploadedCount = Array.from({ length: optCount }).filter((_, i) => uploadedDesigns[`${pIdx}-${i}`]).length;
                      if (uploadedCount === 0 || s.productFeedback?.[pIdx]?.mode === 'approve') return null; // Hide if no upload or already approved in previous round

                      const currentFeedback = productFeedback[pIdx] || {};
                      const fbs = Array.isArray(localConfirmed[pIdx]) ? localConfirmed[pIdx] : (localConfirmed[pIdx] ? [localConfirmed[pIdx]] : []);

                      let isFullyConfirmed = false;
                      const existingSystem = Array.isArray(s.productFeedback?.[pIdx]) ? s.productFeedback[pIdx] : (s.productFeedback?.[pIdx] ? [s.productFeedback[pIdx]] : []);
                      const allFbs = [...existingSystem, ...fbs];
                      if (allFbs.some(fb => fb.mode === 'approve')) {
                        isFullyConfirmed = true;
                      } else {
                        const reviewedSet = new Set();
                        allFbs.forEach(fb => fb.optIdxs?.forEach(i => reviewedSet.add(i)));
                        isFullyConfirmed = (reviewedSet.size >= uploadedCount);
                      }

                      // If there are feedbacks given in THIS round, show them at the top
                      const confirmedBlocks = fbs.map((fb, idx) => {
                        const icon = fb.communication?.method === 'whatsapp' ? '💬' : fb.communication?.method === 'screenshot' ? '📸' : fb.communication?.method === 'email' ? '✉️' : fb.communication?.method === 'verbal' ? '🗣️' : '📄';
                        return (
                          <div key={`conf-${idx}`} className="p-3 border border-indigo-200 rounded-lg bg-indigo-50/50 flex flex-col gap-2 mb-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-indigo-900">{p.name} (Opt {fb.optIdxs?.map(i => i + 1).join(', ')})</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold px-2 py-1 bg-white rounded border border-indigo-100 text-indigo-700 uppercase shadow-sm">
                                  {fb.mode === 'approve' ? `Approved` : fb.mode === 'revision' ? `Changes Asked` : `Rejected`}
                                </span>
                                <span className="text-[10px] text-indigo-500 font-medium flex items-center gap-1">
                                  Confirmed <span className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center text-[10px]">{icon}</span>
                                </span>
                              </div>
                            </div>
                            {fb.remark && (
                              <p className="text-[10px] text-indigo-800 italic bg-white p-1.5 rounded border border-indigo-100">"{fb.remark}"</p>
                            )}
                          </div>
                        )
                      });

                      if (isFullyConfirmed) {
                        return <div key={pIdx}>{confirmedBlocks}</div>;
                      }

                      if (loggingPIdx === pIdx) {
                        return (
                          <div key={pIdx}>
                            {confirmedBlocks}
                            <CommunicationLogForm
                              client={client}
                              pName={p.name}
                              feedbackMode={currentFeedback.mode}
                              optIdxs={currentFeedback.optIdxs}
                              onBack={() => setLoggingPIdx(null)}
                              onLog={(log) => {
                                setLoggingPIdx(null);
                                confirmProductFeedback(pIdx, log);
                              }}
                            />
                          </div>
                        )
                      }

                      return (
                        <div key={pIdx} className="p-3 border border-gray-200 rounded-lg bg-gray-50/50">
                          {confirmedBlocks}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                            <p className="text-xs font-bold text-gray-900">{p.name}</p>
                            <div className="flex gap-2 shrink-0">
                              <button onClick={() => updateProductFeedback(pIdx, 'mode', 'approve')} className={`px-3 py-1.5 text-[11px] font-bold rounded-md shadow-sm transition ${currentFeedback.mode === 'approve' ? 'bg-emerald-500 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}`}>Approve</button>
                              <button onClick={() => updateProductFeedback(pIdx, 'mode', 'revision')} className={`px-3 py-1.5 text-[11px] font-bold rounded-md shadow-sm transition ${currentFeedback.mode === 'revision' ? 'bg-amber-500 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}`}>Ask Changes</button>
                              <button onClick={() => updateProductFeedback(pIdx, 'mode', 'reject')} className={`px-3 py-1.5 text-[11px] font-bold rounded-md shadow-sm transition ${currentFeedback.mode === 'reject' ? 'bg-red-500 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}`}>Reject</button>
                            </div>
                          </div>

                          {currentFeedback.mode && (
                            <div className="space-y-3 mt-3 pt-3 border-t border-gray-200">
                              <div>
                                <p className="text-[11px] font-semibold text-gray-700 mb-1.5">
                                  {currentFeedback.mode === 'approve' ? 'Which options are approved?' : currentFeedback.mode === 'revision' ? 'Which options need changes?' : 'Which options are rejected?'}
                                </p>
                                <div className="flex flex-wrap gap-3">
                                  {Array.from({ length: optCount }).map((_, i) => {
                                    const fileUrl = uploadedDesigns[`${pIdx}-${i}`];
                                    if (!fileUrl) return null;

                                    const isReviewed = allFbs.some(fb => fb.optIdxs?.includes(i));
                                    const isSelected = (currentFeedback.optIdxs || []).includes(i);

                                    return (
                                      <label key={i} className={`flex flex-col gap-1 items-center p-1 border-2 rounded-lg transition ${isReviewed ? 'opacity-50 cursor-not-allowed border-transparent' : isSelected ? 'border-indigo-500 bg-indigo-50 shadow-sm cursor-pointer' : 'border-transparent hover:bg-gray-100 cursor-pointer'}`}>
                                        <div className="relative w-16 h-16 rounded border overflow-hidden bg-white">
                                          <img
                                            src={fileUrl}
                                            className="w-full h-full object-cover"
                                            alt={`Option ${i + 1}`}
                                            onError={(e) => {
                                              e.currentTarget.onerror = null;
                                              e.currentTarget.classList.add("opacity-40");
                                            }}
                                          />
                                          <input
                                            type="checkbox"
                                            className="absolute top-1 left-1 w-3.5 h-3.5 rounded-sm border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                                            checked={isSelected || isReviewed}
                                            disabled={isReviewed}
                                            onChange={() => {
                                              if (isReviewed) return;
                                              const currentIdxs = currentFeedback.optIdxs || [];
                                              const newIdxs = currentIdxs.includes(i) ? currentIdxs.filter(id => id !== i) : [...currentIdxs, i];
                                              updateProductFeedback(pIdx, 'optIdxs', newIdxs);
                                            }}
                                          />
                                        </div>
                                        <span className="text-[9px] font-bold text-gray-600">Opt {i + 1}</span>
                                      </label>
                                    )
                                  })}
                                </div>
                              </div>

                              <input
                                type="text"
                                placeholder={currentFeedback.mode === 'approve' ? "Approval remark (optional)..." : currentFeedback.mode === 'revision' ? "What changes did the client ask for?" : "Reason for rejection (optional)..."}
                                className={`w-full p-2 text-xs border rounded-lg focus:outline-none focus:ring-1 ${currentFeedback.mode === 'approve' ? 'border-emerald-200 focus:ring-emerald-500' : currentFeedback.mode === 'revision' ? 'border-amber-200 focus:ring-amber-500' : 'border-red-200 focus:ring-red-500'}`}
                                value={currentFeedback.remark || ""}
                                onChange={evt => updateProductFeedback(pIdx, 'remark', evt.target.value)}
                              />
                            </div>
                          )}

                          {currentFeedback.mode && (
                            <div className="mt-4 flex justify-end">
                              <button
                                onClick={() => {
                                  if (!currentFeedback.optIdxs || currentFeedback.optIdxs.length === 0) {
                                    notifyAlert(`Please select at least one design option for ${p.name}.`, "Selection Required");
                                    return;
                                  }
                                  setLoggingPIdx(pIdx);
                                }}
                                className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-emerald-700 transition"
                              >
                                Next: log how they {currentFeedback.mode === 'approve' ? 'approved' : currentFeedback.mode === 'revision' ? 'asked changes' : 'rejected'}
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Share Final Design Block (appears if at least one is approved) */}
                  {productsList.some((_, i) => {
                    const fbs = Array.isArray(s.productFeedback?.[i]) ? s.productFeedback[i] : (s.productFeedback?.[i] ? [s.productFeedback[i]] : []);
                    const localFbs = Array.isArray(localConfirmed[i]) ? localConfirmed[i] : (localConfirmed[i] ? [localConfirmed[i]] : []);
                    return [...fbs, ...localFbs].some(fb => fb.mode === 'approve');
                  }) && (
                      <div className="mt-6 border border-emerald-500 rounded-xl bg-white overflow-hidden shadow-sm">
                        <div className="p-4 flex items-center justify-between">
                          <div className="flex gap-3 items-center">
                            <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold">✓</div>
                            <div>
                              <div className="text-sm font-bold text-gray-900 mb-0.5">Design approved</div>
                              <div className="text-xs text-gray-500">
                                {productsList.filter((p, i) => {
                                  const fbs = Array.isArray(s.productFeedback?.[i]) ? s.productFeedback[i] : (s.productFeedback?.[i] ? [s.productFeedback[i]] : []);
                                  const localFbs = Array.isArray(localConfirmed[i]) ? localConfirmed[i] : (localConfirmed[i] ? [localConfirmed[i]] : []);
                                  return [...fbs, ...localFbs].some(fb => fb.mode === 'approve');
                                }).map(p => p.name).join(', ')}
                              </div>
                            </div>
                          </div>
                          <button onClick={() => setShowFinalDesignShare(true)} className="text-xs font-bold text-indigo-700 hover:text-indigo-800">
                            Share final design (optional)
                          </button>
                        </div>
                      </div>
                    )}

                </div>
              ) : (
                <div className="flex flex-col gap-2 border-t border-gray-100 pt-4 mt-2">
                  {!showFinalDesignOptions ? (
                    <div className="border border-emerald-500 rounded-xl bg-white overflow-hidden shadow-sm">
                      <div className="p-4 flex items-center justify-between">
                        <div className="flex gap-3 items-center">
                          <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold">✓</div>
                          <div>
                            <div className="text-sm font-bold text-gray-900 mb-0.5">Design approved</div>
                            <div className="text-xs text-gray-500">
                              {productsList.map((p, i) => {
                                const fb = s.productFeedback?.[i];
                                if (!fb || fb.mode !== 'approve') return null;
                                return `${p.name}: option ${fb.optIdxs?.map(idx => idx + 1).join(', ')}`;
                              }).filter(Boolean).join(' · ')}
                              {s.finalDesignShared ? ` · final design shared via ${s.finalDesignVia || 'Hand-delivered / other'}` : ""}
                            </div>
                          </div>
                        </div>
                        <button onClick={() => setShowFinalDesignOptions(true)} className="text-xs font-bold text-indigo-700 hover:text-indigo-800">
                          {s.finalDesignShared ? "Open or resend" : "Share final design (optional)"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="border border-emerald-500 rounded-xl bg-white overflow-hidden shadow-sm">
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 text-emerald-700">
                            <span className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-bold">✓</span>
                            <span className="text-sm font-bold">Design Approved</span>
                          </div>
                        </div>

                        {productsList.map((p, pIdx) => {
                          const feedback = s.productFeedback?.[pIdx];
                          if (!feedback) return null;
                          return (
                            <div key={pIdx} className="text-xs flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg border mt-2">
                              <span className="font-medium">{p.name} (Opts: {feedback.optIdxs?.map(i => i + 1).join(', ')})</span>
                              <span className="text-gray-500 italic">{feedback.remark || "No remark"}</span>
                            </div>
                          );
                        })}

                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <p className="text-[10px] text-gray-500 mb-3">Only needed if someone who didn't approve it should see the final design.<br />Goes to {client?.name || 'Client'}.</p>
                          <div className="flex gap-3">
                            <button onClick={() => setShowFinalDesignOptions(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50 transition">Cancel</button>
                            <button onClick={() => setShowFinalDesignShare(true)} className="px-5 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold rounded-lg shadow-sm transition">Preview and share</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Render FinalDesignSheet when toggled */}
              {showFinalDesignShare && (
                <FinalDesignSheet
                  s={s}
                  e={e}
                  client={client}
                  productsList={productsList}
                  currentUser={{ name: "Coordinator" }} // Mock user
                  ids={ids}
                  approvedFeedback={{ ...(s.productFeedback || {}), ...localConfirmed }}
                  uploadedDesigns={uploadedDesigns}
                  unselectedProducts={unselectedProducts}
                  setShowFinalDesign={setShowFinalDesignShare}
                  onSend={() => {
                    set({ finalDesignShared: true, finalDesignVia: 'share' });
                    setShowFinalDesignShare(false);
                  }}
                />
              )}
            </div>
          </div>
        );
      })()}

      {/* Costing Simulation Block */}
      {(!e.designer || s.designApproved) && (
        <div className="mt-4">
          {!isSimulatingCosting && !c ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const initialRates = {};
                  const initialSelected = new Set();
                  flattenedProducts.forEach((fp) => {
                    const r = fp.rate || 1210;
                    initialRates[fp.rateKey] = {
                      rate: r,
                      sample: fp.sampleRate || (r + 500)
                    };
                    initialSelected.add(fp.rateKey);
                  });
                  setSimulatedRates(initialRates);
                  setQuoteSelectedProducts(initialSelected);
                  setIsSimulatingCosting(true);
                }}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 transition shadow-sm cursor-pointer"
              >
                Simulate: Costing sends the rate
              </button>
              <span className="text-xs text-gray-400">Demo only. Costing fills this from their screen.</span>
            </div>
          ) : (
            <>
              <div className="border border-emerald-500 rounded-xl bg-white overflow-hidden shadow-sm">
                <div className="p-4 bg-white">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md">From Costing</span>
                      <span className="font-bold text-sm text-gray-900">{ids?.enq || "RD21071"} <span className="font-normal text-gray-500 text-xs">Anand Patil, Costing · 9 Oct 2026</span></span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const initialRates = {};
                        const initialSelected = new Set();
                        flattenedProducts.forEach((fp) => {
                          const r = fp.rate || 1210;
                          initialRates[fp.rateKey] = {
                            rate: r,
                            sample: fp.sampleRate || (r + 500)
                          };
                          initialSelected.add(fp.rateKey);
                        });
                        setSimulatedRates(initialRates);
                        setQuoteSelectedProducts(initialSelected);
                      }}
                      className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                    >
                      Reset rates
                    </button>
                  </div>

                  {flattenedProducts.length === 1 ? (
                    <div className="flex items-start gap-4">
                      <div className="pt-1 shrink-0">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500 cursor-pointer"
                          checked={quoteSelectedProducts.size === 0 || quoteSelectedProducts.has(flattenedProducts[0].rateKey)}
                          onChange={(ev) => {
                            const newSet = new Set(quoteSelectedProducts);
                            if (ev.target.checked) newSet.add(flattenedProducts[0].rateKey);
                            else newSet.delete(flattenedProducts[0].rateKey);
                            setQuoteSelectedProducts(newSet);
                          }}
                        />
                      </div>
                      <div className={`grid grid-cols-5 gap-4 w-full ${quoteSelectedProducts.size === 0 || quoteSelectedProducts.has(flattenedProducts[0].rateKey) ? '' : 'opacity-50'}`}>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-gray-500 mb-1">{flattenedProducts[0].qty} pcs</span>
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-sm text-gray-900">₹</span>
                            <input
                              type="number"
                              className="w-20 p-1 text-sm font-bold text-gray-900 border border-gray-300 rounded focus:ring-1 focus:ring-emerald-500 outline-none"
                              value={simulatedRates[flattenedProducts[0].rateKey]?.rate ?? flattenedProducts[0].rate ?? ''}
                              onChange={ev => setSimulatedRates(prev => ({ ...prev, [flattenedProducts[0].rateKey]: { ...(prev[flattenedProducts[0].rateKey] || {}), rate: Number(ev.target.value) } }))}
                            />
                            <span className="text-sm font-bold text-gray-900">/pc</span>
                          </div>
                        </div>
                        <div className="flex flex-col opacity-60">
                          <span className="text-[10px] text-gray-500 mb-1">{(flattenedProducts[0].qty * 2)} pcs</span>
                          <span className="font-bold text-sm text-gray-900">₹{Math.max(0, ((simulatedRates[flattenedProducts[0].rateKey]?.rate ?? flattenedProducts[0].rate ?? 1210) - 40))}/pc</span>
                        </div>
                        <div className="flex flex-col opacity-60">
                          <span className="text-[10px] text-gray-500 mb-1">{(flattenedProducts[0].qty * 5)} pcs</span>
                          <span className="font-bold text-sm text-gray-900">₹{Math.max(0, ((simulatedRates[flattenedProducts[0].rateKey]?.rate ?? flattenedProducts[0].rate ?? 1210) - 100))}/pc</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-gray-500 mb-1">Sample rate</span>
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-sm text-gray-900">₹</span>
                            <input
                              type="number"
                              className="w-20 p-1 text-sm font-bold text-gray-900 border border-gray-300 rounded focus:ring-1 focus:ring-emerald-500 outline-none"
                              value={simulatedRates[flattenedProducts[0].rateKey]?.sample ?? (flattenedProducts[0].rate ? flattenedProducts[0].rate + 500 : 1820)}
                              onChange={ev => setSimulatedRates(prev => ({ ...prev, [flattenedProducts[0].rateKey]: { ...(prev[flattenedProducts[0].rateKey] || {}), sample: Number(ev.target.value) } }))}
                            />
                            <span className="text-sm font-bold text-gray-900">/pc</span>
                          </div>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-gray-500 mb-1">Setup / artwork</span>
                          <span className="font-bold text-sm text-gray-900">₹1,500 <span className="text-xs font-normal">one-time</span></span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full">
                      <div className="grid grid-cols-[auto_1fr_200px_100px] gap-4 mb-2 border-b border-gray-200 pb-2 items-center">
                        <span className="w-4"></span>
                        <span className="text-xs font-bold text-gray-500">Item</span>
                        <span className="text-xs font-bold text-gray-500">Rates by quantity</span>
                        <span className="text-xs font-bold text-gray-500">Sample</span>
                      </div>
                      {flattenedProducts.map((p) => (
                        <div key={p.rateKey} className={`grid grid-cols-[auto_1fr_200px_100px] gap-4 py-4 border-b border-gray-100 last:border-0 ${quoteSelectedProducts.size === 0 || quoteSelectedProducts.has(p.rateKey) ? '' : 'opacity-50'}`}>
                          <div className="flex items-center pt-1">
                            <input
                              type="checkbox"
                              className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500 cursor-pointer"
                              checked={quoteSelectedProducts.size === 0 || quoteSelectedProducts.has(p.rateKey)}
                              onChange={(ev) => {
                                const newSet = new Set(quoteSelectedProducts);
                                if (ev.target.checked) newSet.add(p.rateKey);
                                else newSet.delete(p.rateKey);
                                setQuoteSelectedProducts(newSet);
                              }}
                            />
                          </div>
                          <div>
                            <div className="font-bold text-sm text-gray-900 mb-1">{ids?.enq || "RD21071"}-{p.subjobId} {p.name}</div>
                            <div className="text-[10px] text-gray-500 leading-tight">Plaque · {p.size} in · Agreed with client</div>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-500 mr-2">{p.qty} pcs</span>
                            <span className="font-bold text-sm text-gray-900">₹</span>
                            <input
                              type="number"
                              className="w-20 p-1 text-sm font-bold text-gray-900 border border-gray-300 rounded focus:ring-1 focus:ring-emerald-500 outline-none"
                              value={simulatedRates[p.rateKey]?.rate ?? p.rate ?? ''}
                              onChange={ev => setSimulatedRates(prev => ({ ...prev, [p.rateKey]: { ...(prev[p.rateKey] || {}), rate: Number(ev.target.value) } }))}
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-sm text-gray-900">₹</span>
                            <input
                              type="number"
                              className="w-20 p-1 text-sm font-bold text-gray-900 border border-gray-300 rounded focus:ring-1 focus:ring-emerald-500 outline-none"
                              value={simulatedRates[p.rateKey]?.sample ?? (p.rate ? p.rate + 500 : 1820)}
                              onChange={ev => setSimulatedRates(prev => ({ ...prev, [p.rateKey]: { ...(prev[p.rateKey] || {}), sample: Number(ev.target.value) } }))}
                            />
                          </div>
                        </div>
                      ))}
                      <div className="pt-4 mt-2 border-t border-gray-200 text-[11px] text-gray-500">
                        Setup / artwork ₹1,500 one-time · Valid for 15 days<br />
                        Rates as agreed with the client on the revised sizes and quantities.
                      </div>
                    </div>
                  )}

                  {productsList.length === 1 && (
                    <div className="mt-6 pt-4 border-t border-gray-100 text-xs text-gray-600">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 mb-1">Valid for</span>
                        <span className="font-bold text-sm text-gray-900">15 days</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={() => setShowPrint(true)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 transition shadow-sm"
                >
                  Print enquiry log
                </button>
                {!quoted ? (
                  <button
                    type="button"
                    className="px-6 py-2 bg-yellow-500 text-white font-bold rounded-lg text-xs hover:bg-yellow-600 shadow-sm transition cursor-pointer"
                    onClick={() => setShowPreviewQuoteSheet(true)}
                  >
                    Preview and send quote
                  </button>
                ) : (
                  <button
                    type="button"
                    className="px-6 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 transition shadow-sm cursor-pointer"
                    onClick={() => setShowPreviewQuoteSheet(true)}
                  >
                    Open or resend quote
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* --- PRINT & JOB SCORE --- */}
      {s.enqSent && (
        <div className="mt-6 space-y-4">
          {(!e.designer || s.designApproved) ? null : (
            <div>
              <button
                onClick={() => setShowPrint(true)}
                className="px-4 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 transition shadow-sm"
              >
                Print enquiry log
              </button>
            </div>
          )}

          <div className="panel p-4 bg-white border border-gray-200 rounded-xl shadow-sm flex items-start gap-4">
            {/* Circle */}
            <div className="relative w-16 h-16 rounded-full border-4 border-gray-100 flex items-center justify-center shrink-0">
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle cx="28" cy="28" r="28" fill="none" stroke="#6366f1" strokeWidth="4" strokeDasharray="175" strokeDashoffset="165" className="translate-x-1 translate-y-1" />
              </svg>
              <div className="text-center leading-none">
                <div className="font-black text-lg text-gray-900">30</div>
                <div className="text-[8px] text-gray-400 font-bold">/ 1000</div>
              </div>
            </div>

            {/* Stats */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-gray-900">Job score · D</h4>
                  <span className="text-amber-400 text-xs tracking-widest">★★<span className="text-gray-200">☆☆☆</span></span>
                </div>
                <button className="text-xs font-bold text-indigo-600 hover:text-indigo-700">Details</button>
              </div>
              <p className="text-[10px] text-gray-500 mb-4">Builds as {s.coordinator || currentUser?.name || "Admin"} completes tasks on time and collects payments. Up to 1050 still possible.</p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <div className="flex justify-between text-[10px] font-bold text-gray-500 mb-1.5"><span>Completion</span><span>30/250</span></div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 w-[12%] rounded-full"></div></div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] font-bold text-gray-500 mb-1.5"><span>On time</span><span>0/250</span></div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-gray-300 w-0"></div></div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] font-bold text-gray-500 mb-1.5"><span>Collections</span><span>0/400</span></div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-gray-300 w-0"></div></div>
                </div>
              </div>
              <div className="mt-4 sm:w-1/3 sm:pr-2">
                <div className="flex justify-between text-[10px] font-bold text-gray-500 mb-1.5"><span>Client experience</span><span>0/100</span></div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-gray-300 w-0"></div></div>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 transition shadow-sm"
              onClick={() => set({ step: s.step - 1 })}
            >
              ← Back to brief
            </button>
          </div>
        </div>
      )}

      {/* Removed duplicate preview button */}

      {quoted && !s.lost && !s.wonMode && (
        <div className="panel p-4 bg-white border rounded-xl shadow-sm mt-4">
          <div className="lbl text-sm font-bold text-gray-900 mb-2">What did the client say?</div>
          <div className="decide grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              className="p-3 border rounded-lg bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-left transition"
              onClick={() => set({ wonMode: "sample", lostOpen: false })}
            >
              <span className="text-2xl">🧪</span>
              <div className="font-bold text-sm text-emerald-900 mt-1">Won: sample first</div>
              <div className="text-xs text-emerald-700">Everything carries over to sample</div>
            </button>
            <button
              className="p-3 border rounded-lg bg-blue-50 hover:bg-blue-100 border-blue-200 text-left transition"
              onClick={() => set({ wonMode: "production", lostOpen: false })}
            >
              <span className="text-2xl">🏭</span>
              <div className="font-bold text-sm text-blue-900 mt-1">Won: go to production</div>
              <div className="text-xs text-blue-700">Final qty, PO &amp; date</div>
            </button>
            <button
              className="p-3 border rounded-lg bg-red-50 hover:bg-red-100 border-red-200 text-left transition"
              onClick={() => set({ lostOpen: true })}
            >
              <span className="text-2xl">✋</span>
              <div className="font-bold text-sm text-red-900 mt-1">Lost</div>
              <div className="text-xs text-red-700">Log loss reason</div>
            </button>
          </div>

          {s.lostOpen && (
            <div className="panel p-3 bg-red-50/50 border border-red-200 rounded-lg mt-3 fade">
              <div className="text-xs font-bold text-red-800 mb-2">Why did we lose it?</div>
              <div className="flex gap-2 flex-wrap">
                {LOST.map((reason) => (
                  <button
                    key={reason}
                    className={`px-3 py-1 text-xs border rounded-full transition ${s.lost === reason
                        ? "bg-red-600 text-white border-red-600 font-bold"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                      }`}
                    onClick={() => set({ lost: reason })}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {s.wonMode && (
        <CommunicationLogForm
          client={client}
          mode={s.wonMode === 'sample' ? 'won-sample' : 'won-production'}
          onBack={() => set({ wonMode: null })}
          onLog={(logData) => {
            set({ decision: logData, wonMode: null });
            goOrder(s.wonMode);
          }}
        />
      )}
      {/* The Printable Overlay */}
      {showPrint && (
        <PrintEnquiryLog
          s={s}
          e={e}
          client={client}
          setShowPrint={setShowPrint}
          ids={ids}
          heat={heat}
          currentUser={currentUser}
          uploadedDesigns={uploadedDesigns}
        />
      )}

      {/* The Design Send Preview Overlay */}
      {showDesignPreview && (
        <DesignPreviewSheet
          s={s}
          e={e}
          client={client}
          setShowDesignPreview={setShowDesignPreview}
          ids={ids}
          uploadedDesigns={uploadedDesigns}
          selectedProducts={new Set(productsList.map((_, i) => i).filter(i => !unselectedProducts.has(i)))}
          productsList={productsList}
          currentUser={currentUser}
          onSend={() => set({ optionsShared: new Date().toISOString() })}
        />
      )}

      {/* ── Full-screen Preview Modal ── */}
      {previewDesignKey && uploadedDesigns[previewDesignKey] && (
        <ImageLightbox
          src={uploadedDesigns[previewDesignKey]}
          fileName="Design Option Preview"
          onClose={() => setPreviewDesignKey(null)}
        />
      )}

      {/* The Quote Preview Overlay */}
      {showPreviewQuoteSheet && (
        <PreviewQuoteSheet
          s={s}
          e={e}
          client={client}
          productsList={flattenedProducts}
          currentUser={{ name: "Coordinator" }} // Mock user
          ids={ids}
          simulatedRates={simulatedRates}
          quoteSelectedProducts={quoteSelectedProducts}
          onClose={() => setShowPreviewQuoteSheet(false)}
          onSend={() => {
            const lines = [];
            flattenedProducts.forEach((p) => {
              if (quoteSelectedProducts.has(p.rateKey)) {
                const r0 = simulatedRates[p.rateKey]?.rate || 1210;
                const sampleRate = simulatedRates[p.rateKey]?.sample || 1820;
                lines.push({
                  id: p.rateKey,
                  name: `${ids?.enq || "RD21071"}-${p.subjobId} ${p.name}`,
                  spec: `Plaque · Self-standing block · ${p.size} in · Fusion: Crystal + Glass · Metal elements`,
                  kind: 'custom',
                  source: 'Agreed with client',
                  rate: r0,
                  slabs: [[p.qty, r0]],
                  sampleRate: sampleRate
                });
              }
            });

            if (lines.length > 0) {
              const cst = {
                ref: ids?.enq || "RD21071",
                rate: lines[0]?.rate || 1210,
                sampleRate: lines[0]?.sampleRate || 1820,
                setup: 1500,
                validity: 15,
                by: 'Agreed rate · entered by CS',
                at: new Date().toISOString(),
                agreed: new Date().toISOString(),
                slabs: lines[0]?.slabs || [],
                lines: lines,
                note: 'Rates as agreed with the client on the revised sizes and quantities.'
              };

              set({ costing: cst, quoted: true });
            }
            setShowPreviewQuoteSheet(false);
          }}
        />
      )}
    </div>
  );
};

export default LogStep;
