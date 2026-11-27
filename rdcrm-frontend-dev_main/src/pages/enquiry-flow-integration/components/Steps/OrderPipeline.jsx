import React, { useState } from "react";
import {
  finOf,
  advSettled,
  dfmt,
  todayISO,
  roundOf,
  subJobsOf,
  formatEnquiryNo,
  ENQUIRY_CONFIG,
  formatAddress,
} from "../../utils/helpers";
import PreviewProformaSheet from "./PreviewProformaSheet";
import PreviewPaymentReminderSheet from "./PreviewPaymentReminderSheet";
import OrderAndRateTab from "./order-pipeline/OrderAndRateTab";
import FinancialsTab from "./order-pipeline/FinancialsTab";
import PackAndPostTab from "./order-pipeline/PackAndPostTab";
import { axiosInstance } from "../../../../utils/url/config";
import { toast } from "react-toastify";

const OrderPipeline = ({ s, set, client, job, ids = {} }) => {
  const isPiSent = Boolean(s.pi?.sent || s.pi?.sent_at);
  const isPiApproved = Boolean(s.costOk || s.piApproved || s.clientApproved || s.wizard_state?.costOk || s.wizard_state?.piApproved);
  const canMoveToPackPost = (isPiSent && isPiApproved) || Boolean(s.released);

  const defaultSub = s.sub !== undefined
    ? Number(s.sub)
    : (s.released ? 2 : (s.pi?.status || s.costOk ? 1 : 0));
  const [sub, setSub] = useState(
    defaultSub === 2 && !canMoveToPackPost ? 1 : defaultSub
  );

  const handleSubChange = (newSub) => {
    if (newSub === 2 && !canMoveToPackPost) {
      toast.warning("Proforma Invoice must be sent and approved by client in Financials tab first.");
      return;
    }
    setSub(newSub);
    set({ sub: newSub });
  };

  const parentJobNo = s?.seq
    ? formatEnquiryNo(s.seq)
    : (ids?.enq?.startsWith("RD") ? ids.enq : ids?.enq?.replace("ENQ/26/", "RD")) ||
      ENQUIRY_CONFIG.DEFAULT_ENQUIRY_NO;

  const roundInfo = roundOf(s);
  const currentV = roundInfo.v || (s?.rounds?.length ? s.rounds.length + 1 : 1);
  const rounds = s?.rounds || [];

  const initialItems = (() => {
    const sj = subJobsOf(s, parentJobNo).filter((item) => !item.is_dropped);
    if (sj.length > 0) {
      return sj.map((item, idx) => {
        const existing = (s.orderItems || []).find(
          (oi) => oi.subJobNo === item.subJobNo || oi.id === item.id || oi.id === `item_${idx + 1}`
        ) || (s.orderItems || [])[idx];
        const quotedRate = Number(
          item.rate ||
          item.unitRate ||
          item.unit_rate ||
          item.target_rate ||
          s.simulatedRates?.[item.subJobNo]?.rate ||
          s.simulatedRates?.[item.id]?.rate ||
          0
        );
        const isManuallyChanged = existing?.rateStatus?.startsWith("changed");
        const finalRate = isManuallyChanged
          ? Number(existing.rate)
          : (quotedRate > 0
              ? quotedRate
              : (Number(existing?.rate) && existing?.rate !== 3390 && existing?.rate !== 1500
                  ? Number(existing.rate)
                  : (quotedRate || (s.fc?.rate && s.fc.rate !== 3390 ? s.fc.rate : 0) || 0)));

        const qty = Number(existing?.qty || item.qty || s.finalQty || s.qty || 1);
        const size = item.size || existing?.size || 8;
        const mat =
          item.mat ||
          item.material ||
          existing?.mat ||
          (idx === 0 ? "Fusion: Crystal + MDF" : "Fusion: Resin + MDF");
        const type = item.type || existing?.type || "Plaque";
        const theme = item.theme || existing?.theme || s.e?.theme || "Custom Trophy";
        const desc =
          item.desc ||
          existing?.desc ||
          `${type} · Composite with a solid base · ${size} in · ${mat} · Metal elements`;

        return {
          id: item.id || existing?.id || `item_${idx + 1}`,
          subJobNo: item.subJobNo || existing?.subJobNo,
          theme,
          type,
          size,
          mat,
          desc,
          qty,
          rate: finalRate,
          rateStatus: isManuallyChanged
            ? existing.rateStatus
            : (quotedRate > 0 ? "Quoted rate" : (existing?.rateStatus || "confirmed")),
        };
      });
    }
    if (Array.isArray(s.orderItems) && s.orderItems.length > 0) {
      return s.orderItems.filter(
        (it) => it.theme !== "Million Dollar Club Trophy" && it.theme !== "fbvdfbdgfb"
      );
    }
    return [];
  })();

  const [items, setItems] = useState(initialItems);
  const [editingRateId, setEditingRateId] = useState(null);
  const [editingRateVal, setEditingRateVal] = useState(0);
  const [editingReasonVal, setEditingReasonVal] = useState("Client negotiated");

  const syncQtyChanges = (updatedItems) => {
    setItems(updatedItems);
    const newTotal = updatedItems.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);

    // Sync to s.e.trophyGroups
    let nextTrophyGroups = Array.isArray(s.e?.trophyGroups) ? [...s.e.trophyGroups] : [];
    if (nextTrophyGroups.length > 0) {
      nextTrophyGroups = nextTrophyGroups.map((group) => {
        const nextGroupItems = (group.items || []).map((gi, idx) => {
          const matchedUpdated = updatedItems.find(
            (ui) => ui.id === gi.id || ui.subJobNo === gi.subJobNo || ui.id === `item_${idx + 1}`
          ) || updatedItems[idx];
          if (matchedUpdated) {
            return { ...gi, qty: Number(matchedUpdated.qty) };
          }
          return gi;
        });
        return { ...group, items: nextGroupItems };
      });
    }

    // Sync to s.sub_jobs
    let nextSubJobs = Array.isArray(s.sub_jobs) ? [...s.sub_jobs] : [];
    if (nextSubJobs.length > 0) {
      nextSubJobs = nextSubJobs.map((sj, idx) => {
        const matchedUpdated = updatedItems.find(
          (ui) => ui.subJobNo === sj.sub_job_no || ui.id === sj.id || ui.id === `item_${idx + 1}`
        ) || updatedItems[idx];
        if (matchedUpdated) {
          return { ...sj, quantity: Number(matchedUpdated.qty) };
        }
        return sj;
      });
    }

    set({
      orderItems: updatedItems,
      finalQty: newTotal,
      qty: newTotal,
      sub_jobs: nextSubJobs.length > 0 ? nextSubJobs : s.sub_jobs,
      e: {
        ...(s.e || {}),
        qty: newTotal,
        trophyGroups: nextTrophyGroups.length > 0 ? nextTrophyGroups : s.e?.trophyGroups,
      },
    });
  };

  const handleQtyChange = (id, delta) => {
    const updated = items.map((it) => {
      if (it.id === id) {
        const newQty = Math.max(1, (Number(it.qty) || 0) + delta);
        return { ...it, qty: newQty };
      }
      return it;
    });
    syncQtyChanges(updated);
  };

  const handleQtyInput = (id, val) => {
    const newQty = Math.max(1, parseInt(val) || 1);
    const updated = items.map((it) => (it.id === id ? { ...it, qty: newQty } : it));
    syncQtyChanges(updated);
  };

  const handleDropItem = async (id) => {
    if (items.length <= 1) return;
    const targetItem = items.find((it) => it.id === id);
    const updated = items.filter((it) => it.id !== id);
    setItems(updated);
    const newTotal = updated.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);

    const targetDbId = s.dbJobId || s._id || s.rawJob?._id || ids?.id;
    const subJobNo = targetItem?.subJobNo;
    const fullReason = "Dropped from order pipeline";

    if (targetDbId && subJobNo) {
      await axiosInstance
        .post(`/enquiry-flow-integration/${targetDbId}/sub-job/${subJobNo}/drop`, {
          reason: fullReason,
        })
        .catch(console.warn);
    }

    const updatedTrophyGroups = (s.e?.trophyGroups || []).map((tg, idx) => {
      const groupChar = String.fromCharCode(65 + idx);
      const updatedItems = (tg.items || []).map((item, j) => {
        const sjNo = `${parentJobNo}-${groupChar}${j + 1}`;
        if (
          subJobNo &&
          (sjNo === subJobNo || subJobNo.endsWith(`-${groupChar}${j + 1}`))
        ) {
          return {
            ...item,
            is_dropped: true,
            drop_reason: fullReason,
            dropped_at: new Date().toISOString(),
          };
        }
        return item;
      });

      const allDropped =
        updatedItems.length > 0 && updatedItems.every((it) => it.is_dropped);
      return {
        ...tg,
        items: updatedItems,
        is_dropped: allDropped,
        drop_reason: allDropped ? fullReason : "",
      };
    });

    const updatedSubJobs = (s.sub_jobs || []).map((sj) => {
      if (
        subJobNo &&
        (sj.sub_job_no === subJobNo || subJobNo.endsWith(sj.sub_job_no))
      ) {
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
      orderItems: updated,
      finalQty: newTotal,
      e: { ...(s.e || {}), trophyGroups: updatedTrophyGroups },
      sub_jobs: updatedSubJobs,
      wizard_state: {
        ...(s.wizard_state || s),
        orderItems: updated,
        finalQty: newTotal,
        e: { ...(s.e || {}), trophyGroups: updatedTrophyGroups },
        sub_jobs: updatedSubJobs,
      },
    });
  };

  const handleSaveRate = (id) => {
    const updated = items.map((it) => {
      if (it.id === id) {
        return {
          ...it,
          rate: Number(editingRateVal),
          rateStatus: `changed · ${editingReasonVal}`,
        };
      }
      return it;
    });
    setItems(updated);
    setEditingRateId(null);
    set({ orderItems: updated, fc: { rate: updated[0]?.rate || 1000 } });
  };

  const handleAddProduct = () => {};

  // Live Totals
  const totalPcs = items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
  const itemsTotalBeforeGst = items.reduce(
    (sum, it) => sum + (Number(it.qty) || 0) * (Number(it.rate) || 0),
    0
  );

  const isPreProductionSample = Boolean(
    s.is_pre_production ||
    s.charge === "foc" ||
    s.order_mode?.charge === "foc" ||
    s.the_ask?.ask_mode === "pre_production"
  );

  const hasChargedSample = Boolean(
    !isPreProductionSample &&
    (
      s.sampleConfirmed ||
      s.ratesApproved ||
      s.sampleRatesState === "approved" ||
      s.sampleDecision?.decision === "approved" ||
      s.rawJob?.sample_order_id ||
      (s.sub_jobs || []).some((sj) => sj.sample_order_id || sj.is_sample) ||
      s.rawJob?.order_type === "sample" ||
      s.sampleV1Invoice ||
      (Number(s.sampleRate) > 0 && s.charge !== "foc")
    )
  );

  const sampleRatePerUnit = Number(s.sampleRateManual !== undefined ? s.sampleRateManual : (s.sampleRate || s.order_mode?.sample_rate || 0));
  const sampleQtyVal = Number(s.sampleQty || s.order_mode?.sample_qty || 1);
  const subJobsSampleSum = (s.sub_jobs || []).reduce((acc, sj) => {
    const r = Number(sj.sample_rate || 0);
    const q = Number(sj.sample_qty || sampleQtyVal || 1);
    return acc + (r * q);
  }, 0);
  const totalSampleCharge = subJobsSampleSum > 0 ? subJobsSampleSum : (sampleRatePerUnit * sampleQtyVal);

  const effectiveSampleCharge = (hasChargedSample && totalSampleCharge > 0) ? totalSampleCharge : 0;
  const totalAmountBeforeGst = itemsTotalBeforeGst + effectiveSampleCharge;
  const gstAmount = Math.round(totalAmountBeforeGst * 0.18);
  const totalInvoiceVal = totalAmountBeforeGst + gstAmount;

  // Modals and Options
  const [showProformaModal, setShowProformaModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [autoReminderMode, setAutoReminderMode] = useState(true);
  const [prodGst, setProdGst] = useState(s.prodGst || 18);
  const [adjustSampleCharges, setAdjustSampleCharges] = useState(
    s.relAdjust === true || false
  );

  const initialUploadedFiles = [
    ...(s.e?.globalLogos || []),
    ...(s.e?.clientLogo || []),
    ...(s.e?.clientLogos || []),
    ...(s.clientLogo || []),
    ...(s.e?.globalAdditionalFiles || []),
    ...(s.e?.additionalFiles || []),
    ...(s.e?.additional_files || []),
    ...(s.additionalFiles || []),
    ...(s.e?.globalSignatures || []),
    ...(s.e?.signatures || []),
    ...(s.signatures || []),
    ...((s.sub_jobs || []).flatMap((sj) => sj.client_logo || [])),
    ...((s.sub_jobs || []).flatMap((sj) => sj.additional_files || [])),
    ...((s.sub_jobs || []).flatMap((sj) => sj.signatures || [])),
    ...Object.values(s.e?.productBriefs || {}).flatMap((pb) => [
      ...(pb.clientLogo || []),
      ...(pb.client_logo || []),
      ...(pb.additionalFiles || []),
      ...(pb.additional_files || []),
      ...(pb.signatures || []),
    ]),
  ].filter(Boolean);

  const firstRealFile =
    initialUploadedFiles[0]?.name ||
    initialUploadedFiles[0]?.file_name ||
    "";

  const [contentStatus, setContentStatus] = useState(
    s.contentStatus || (firstRealFile ? "received" : "awaiting")
  );
  const [contentFileName, setContentFileName] = useState(
    s.contentFileName || firstRealFile || ""
  );
  const [packingListStatus, setPackingListStatus] = useState(
    s.packingListStatus || "not_received"
  );
  const [packingListFileName, setPackingListFileName] = useState(
    s.packingListFileName || ""
  );
  const [clientChanges] = useState(
    s.clientChanges || s.revisionNotes || s.the_brief?.brief || s.e?.brief || "No changes requested"
  );
  const [priority, setPriority] = useState(s.priority || "Normal");
  const [autoRemindClient, setAutoRemindClient] = useState(
    s.autoRemindClient !== undefined ? s.autoRemindClient : true
  );
  const [postNotes, setPostNotes] = useState(s.postNotes || "");

  const defaultTermsAdv = Math.round(totalInvoiceVal * 0.25);
  const isInvalidStoredAdv =
    s.advPlan?.amount === 84300 ||
    s.advPlan?.amount === 100000 ||
    Boolean(s.advPlan?.amount && totalInvoiceVal > 0 && s.advPlan.amount > totalInvoiceVal);

  const [advFormMode, setAdvFormMode] = useState(null);
  const [rcptAmount, setRcptAmount] = useState(() => {
    if (s.advPlan?.amount && !isInvalidStoredAdv) {
      return s.advPlan.amount;
    }
    return defaultTermsAdv;
  });
  const [rcptDate, setRcptDate] = useState(todayISO());
  const [rcptMode, setRcptMode] = useState("NEFT");
  const [rcptRef, setRcptRef] = useState("");
  const [rcptFrom, setRcptFrom] = useState(
    client?.name || client?.company || "Meridian Pharma Pvt Ltd"
  );
  const [rcptInto, setRcptInto] = useState(
    s.bankAc || "HDFC Kalina · current a/c"
  );

  const [otwAmount, setOtwAmount] = useState(() => {
    if (s.advPlan?.amount && !isInvalidStoredAdv) {
      return s.advPlan.amount;
    }
    return defaultTermsAdv;
  });
  const [otwFrom, setOtwFrom] = useState(
    client?.name || client?.company || "Meridian Pharma Pvt Ltd"
  );
  const [otwMode, setOtwMode] = useState("NEFT");
  const [otwExpectedBy, setOtwExpectedBy] = useState("Tomorrow");
  const [otwExpectedDate, setOtwExpectedDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [otwRef, setOtwRef] = useState("");
  const [otwNote, setOtwNote] = useState("");
  const [otwHoldProduction, setOtwHoldProduction] = useState(false);

  const [capCost, setCapCost] = useState(false);
  const [rateNegotiateBanner, setRateNegotiateBanner] = useState(false);

  const getMaxCompletionDate = (delivDate) => {
    if (!delivDate) return "";
    const d = new Date(delivDate);
    if (isNaN(d.getTime())) return "";
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  };

  const getRecommendedCompletionDate = (delivDate) => {
    if (!delivDate) return "";
    const d = new Date(delivDate);
    if (isNaN(d.getTime())) return "";
    d.setDate(d.getDate() - 2);
    return d.toISOString().slice(0, 10);
  };

  const [deliveryDate, setDeliveryDate] = useState(
    s.relDate || s.leadDate || "2026-10-23"
  );
  const [completionDate, setCompletionDate] = useState(() => {
    const initialComp = s.jobCompletionDate || s.completionDate;
    const del = s.relDate || s.leadDate || "2026-10-23";
    if (!initialComp || initialComp >= del) {
      return getRecommendedCompletionDate(del) || "2026-10-21";
    }
    return initialComp;
  });

  const handleDeliveryDateChange = (val) => {
    setDeliveryDate(val);
    const maxComp = getMaxCompletionDate(val);
    let newComp = completionDate;
    if (!completionDate || completionDate >= val) {
      newComp = getRecommendedCompletionDate(val) || maxComp;
      setCompletionDate(newComp);
    }
    set({ relDate: val, jobCompletionDate: newComp });
  };

  const handleCompletionDateChange = (val) => {
    const maxComp = getMaxCompletionDate(deliveryDate);
    if (deliveryDate && val >= deliveryDate) {
      setCompletionDate(maxComp);
      set({ jobCompletionDate: maxComp });
    } else {
      setCompletionDate(val);
      set({ jobCompletionDate: val });
    }
  };

  const [billingEdit, setBillingEdit] = useState(false);
  const [billingPartyType, setBillingPartyType] = useState(
    s.billingPartyType || "client"
  );
  const [diffPartyName, setDiffPartyName] = useState(
    s.diffPartyName || "Meridian Healthcare Pvt Ltd"
  );
  const [diffGstin, setDiffGstin] = useState(
    s.diffGstin || "27AADCM5561H1Z6"
  );
  const [diffAddress, setDiffAddress] = useState(
    s.diffAddress || "Plot 14, MIDC, Andheri East, Mumbai 400093"
  );

  const [advOption, setAdvOption] = useState(() => {
    if (isInvalidStoredAdv || !s.advPlan?.mode || (s.advPlan.mode === "custom" && isInvalidStoredAdv)) {
      return "terms";
    }
    return s.advPlan.mode;
  });
  const [customAdvAmount, setCustomAdvAmount] = useState(() => {
    if (s.advPlan?.amount && !isInvalidStoredAdv) {
      return s.advPlan.amount;
    }
    return Math.round(totalInvoiceVal * 0.5) || defaultTermsAdv;
  });

  const effectiveAdv =
    advOption === "none"
      ? 0
      : advOption === "custom"
      ? customAdvAmount
      : defaultTermsAdv;
  const advPercent =
    totalInvoiceVal > 0 ? Math.round((effectiveAdv / totalInvoiceVal) * 100) : 0;

  const f = finOf(s, job, client, totalPcs);

  const [requestingPI, setRequestingPI] = useState(false);

  const handleRequestPI = async () => {
    try {
      setRequestingPI(true);
      const targetId = s.id || s._id || s.enquiry_id || s.seq;
      const isSampleMode = s.mode === "sample";
      const sampleV1Adjusted = isSampleMode ? Number(s.sampleV1Adjusted || 0) : 0;
      const taxableVal = Math.max(0, totalAmountBeforeGst - (adjustSampleCharges ? sampleV1Adjusted : 0));
      const gstDecimal = (prodGst || 18) / 100;
      const cgstAmt = Math.round(taxableVal * (gstDecimal / 2));
      const sgstAmt = Math.round(taxableVal * (gstDecimal / 2));

      const subJobsPayload = items.map((it, idx) => ({
        id: it.id,
        subJobNo: it.subJobNo || (s.jobNo ? `${s.jobNo}-A${idx + 1}` : undefined),
        theme: it.theme || it.name || it.product_name || "Custom Trophy",
        finalQty: Number(it.finalQty || it.qty || 1),
        rate: Number(it.rate || it.unitRate || 0),
        amount: Number(it.amount || (Number(it.finalQty || it.qty || 1) * Number(it.rate || 0))),
      }));

      if (hasChargedSample && totalSampleCharge > 0) {
        subJobsPayload.push({
          id: "sample_charges",
          subJobNo: "Sample",
          theme: `Pre-Production Sample Charges (${sampleQtyVal} pcs @ ₹${sampleRatePerUnit})`,
          finalQty: sampleQtyVal,
          rate: sampleRatePerUnit,
          amount: totalSampleCharge,
        });
      }

      const payload = {
        subJobs: subJobsPayload,
        commercials: {
          totalAmountBeforeGst,
          taxableValue: taxableVal,
          prodGst: prodGst || 18,
          cgstAmt,
          sgstAmt,
          invoiceTotal: totalInvoiceVal,
          advanceDue: effectiveAdv,
          balanceDue: Math.max(0, totalInvoiceVal - effectiveAdv),
          sampleCharge: effectiveSampleCharge,
          sampleQty: sampleQtyVal,
          sampleRate: sampleRatePerUnit,
        },
        billingParty: {
          name: client?.name || client?.company || s.clientProfile?.name || "Client",
          gstin: typeof client?.gst_no === "string" ? client.gst_no : (client?.gstin || s.clientProfile?.gstin || ""),
          address: formatAddress(client?.billing || client?.address || s.clientProfile?.address) || "",
          contactPerson: client?.contact || s.clientProfile?.contact_person || "",
          contactPhone: client?.mobile || s.clientProfile?.mobile_no || "",
        },
        deliveryAddress: {
          address: typeof s.delivAddress === "string" && s.delivAddress.trim() ? s.delivAddress : (formatAddress(client?.shipping_address || client?.address) || ""),
          carrier: s.carrier || "Our vehicle",
        },
        paymentTerms: advOption === "net30" ? "Net 30" : advOption === "none" ? "100% On Delivery" : "25% Advance",
        notes: `Advance Due: ₹${effectiveAdv.toLocaleString("en-IN")}, Balance: ₹${Math.max(0, totalInvoiceVal - effectiveAdv).toLocaleString("en-IN")}`,
      };

      const res = await axiosInstance.post(
        `/enquiry-flow-integration/${targetId}/request-proforma`,
        payload
      );

      if (res.data?.success) {
        set({
          pi: {
            ...(s.pi || {}),
            status: "requested",
            requested_at: new Date().toISOString(),
            requested_by: "Client Servicing",
            commercials: payload.commercials,
            billing_party: payload.billingParty,
          },
        });
        toast.success("Official Proforma Invoice requested from Accounts team successfully!");
      } else {
        toast.error(res.data?.message || "Failed to request Proforma Invoice from Accounts");
      }
    } catch (err) {
      console.error("Failed to request Proforma Invoice from Accounts:", err);
      toast.error(err.response?.data?.message || err.message || "Failed to request Proforma Invoice from Accounts");
    } finally {
      setRequestingPI(false);
    }
  };

  const isOrderRateDone = totalPcs > 0 && totalAmountBeforeGst > 0;
  const isFinDone = !!(s.pi?.sent && s.costOk && advSettled(s, f));
  const isPackPostDone = !!s.released;

  return (
    <div className="w-full bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-7 text-left">
      {/* Title */}
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight mb-1">
          {s.mode === "sample"
            ? `Sample v${currentV} approved. Process the order`
            : "Process the production order"}
        </h2>
        <p className="text-xs text-gray-500 font-medium">
          Confirm the final order details, close financials, and post to the Production Hub.
        </p>
      </div>

      {/* 3 Sub-tabs Pills Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 pb-4">
        {[
          { idx: 0, num: 1, label: "Order & rate", done: isOrderRateDone },
          { idx: 1, num: 2, label: "Financials", done: isFinDone },
          { idx: 2, num: 3, label: "Pack, deliver & post", done: isPackPostDone, locked: !canMoveToPackPost },
        ].map((tab) => (
          <button
            key={tab.idx}
            type="button"
            className={`px-4 py-2 rounded-full text-xs font-bold transition flex items-center gap-2 ${
              tab.locked
                ? "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed opacity-75"
                : sub === tab.idx
                ? "bg-indigo-600 text-white shadow-xs cursor-pointer"
                : tab.done
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200 cursor-pointer"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200 cursor-pointer"
            }`}
            onClick={() => handleSubChange(tab.idx)}
            title={tab.locked ? "Proforma invoice must be sent and approved by client first" : undefined}
          >
            <span
              className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${
                tab.locked
                  ? "bg-gray-200 text-gray-500"
                  : sub === tab.idx
                  ? "bg-white text-indigo-700"
                  : tab.done
                  ? "bg-emerald-600 text-white"
                  : "bg-gray-300 text-gray-700"
              }`}
            >
              {tab.locked ? "🔒" : tab.done && sub !== tab.idx ? "✓" : tab.num}
            </span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* SUBNAV 0: Order & Rate */}
      {sub === 0 && (
        <OrderAndRateTab
          s={s}
          set={set}
          items={items}
          totalPcs={totalPcs}
          totalAmountBeforeGst={totalAmountBeforeGst}
          totalInvoiceVal={totalInvoiceVal}
          advPercent={advPercent}
          effectiveAdv={effectiveAdv}
          advOption={advOption}
          setAdvOption={setAdvOption}
          customAdvAmount={customAdvAmount}
          setCustomAdvAmount={setCustomAdvAmount}
          deliveryDate={deliveryDate}
          completionDate={completionDate}
          handleDeliveryDateChange={handleDeliveryDateChange}
          handleCompletionDateChange={handleCompletionDateChange}
          getMaxCompletionDate={getMaxCompletionDate}
          rateNegotiateBanner={rateNegotiateBanner}
          setRateNegotiateBanner={setRateNegotiateBanner}
          editingRateId={editingRateId}
          setEditingRateId={setEditingRateId}
          editingRateVal={editingRateVal}
          setEditingRateVal={setEditingRateVal}
          editingReasonVal={editingReasonVal}
          setEditingReasonVal={setEditingReasonVal}
          handleQtyChange={handleQtyChange}
          handleQtyInput={handleQtyInput}
          handleDropItem={handleDropItem}
          handleSaveRate={handleSaveRate}
          handleAddProduct={handleAddProduct}
          rounds={rounds}
          billingEdit={billingEdit}
          setBillingEdit={setBillingEdit}
          billingPartyType={billingPartyType}
          setBillingPartyType={setBillingPartyType}
          diffPartyName={diffPartyName}
          setDiffPartyName={setDiffPartyName}
          diffGstin={diffGstin}
          setDiffGstin={setDiffGstin}
          diffAddress={diffAddress}
          setDiffAddress={setDiffAddress}
          client={client}
          onNext={() => {
            handleSubChange(1);
            set({
              finalQty: totalPcs,
              qty: totalPcs,
              sub: 1,
              orderItems: items,
              fc: {
                rate: items[0]?.rate || 1000,
                qty: totalPcs,
                ref: "Order rate confirmed",
                at: new Date().toISOString(),
              },
              relDate: deliveryDate,
              jobCompletionDate: completionDate,
              advPlan: {
                mode: advOption,
                amount: effectiveAdv,
              },
            });
          }}
        />
      )}

      {/* SUBNAV 1: Financials */}
      {sub === 1 && (
        <FinancialsTab
          s={s}
          set={set}
          items={items}
          client={client}
          ids={ids}
          totalAmountBeforeGst={totalAmountBeforeGst}
          effectiveAdv={effectiveAdv}
          prodGst={prodGst}
          setProdGst={setProdGst}
          adjustSampleCharges={adjustSampleCharges}
          setAdjustSampleCharges={setAdjustSampleCharges}
          advFormMode={advFormMode}
          setAdvFormMode={setAdvFormMode}
          rcptAmount={rcptAmount}
          setRcptAmount={setRcptAmount}
          rcptDate={rcptDate}
          setRcptDate={setRcptDate}
          rcptMode={rcptMode}
          setRcptMode={setRcptMode}
          rcptRef={rcptRef}
          setRcptRef={setRcptRef}
          rcptFrom={rcptFrom}
          setRcptFrom={setRcptFrom}
          rcptInto={rcptInto}
          setRcptInto={setRcptInto}
          otwAmount={otwAmount}
          setOtwAmount={setOtwAmount}
          otwFrom={otwFrom}
          setOtwFrom={setOtwFrom}
          otwMode={otwMode}
          setOtwMode={setOtwMode}
          otwExpectedBy={otwExpectedBy}
          setOtwExpectedBy={setOtwExpectedBy}
          otwExpectedDate={otwExpectedDate}
          setOtwExpectedDate={setOtwExpectedDate}
          otwRef={otwRef}
          setOtwRef={setOtwRef}
          otwNote={otwNote}
          setOtwNote={setOtwNote}
          otwHoldProduction={otwHoldProduction}
          setOtwHoldProduction={setOtwHoldProduction}
          capCost={capCost}
          setCapCost={setCapCost}
          autoReminderMode={autoReminderMode}
          setAutoReminderMode={setAutoReminderMode}
          setShowProformaModal={setShowProformaModal}
          setShowReminderModal={setShowReminderModal}
          setSub={handleSubChange}
          setEditingRateId={setEditingRateId}
          setEditingRateVal={setEditingRateVal}
          setEditingReasonVal={setEditingReasonVal}
          setRateNegotiateBanner={setRateNegotiateBanner}
          handleRequestPI={handleRequestPI}
          requestingPI={requestingPI}
          hasChargedSample={hasChargedSample}
          totalSampleCharge={totalSampleCharge}
          sampleQtyVal={sampleQtyVal}
          sampleRatePerUnit={sampleRatePerUnit}
        />
      )}

      {/* SUBNAV 2: Pack, deliver & post */}
      {sub === 2 && (
        <PackAndPostTab
          s={s}
          set={set}
          client={client}
          items={items}
          ids={ids}
          totalPcs={totalPcs}
          currentV={currentV}
          effectiveAdv={effectiveAdv}
          contentStatus={contentStatus}
          setContentStatus={setContentStatus}
          contentFileName={contentFileName}
          setContentFileName={setContentFileName}
          packingListStatus={packingListStatus}
          setPackingListStatus={setPackingListStatus}
          packingListFileName={packingListFileName}
          setPackingListFileName={setPackingListFileName}
          clientChanges={clientChanges}
          priority={priority}
          setPriority={setPriority}
          autoRemindClient={autoRemindClient}
          setAutoRemindClient={setAutoRemindClient}
          postNotes={postNotes}
          setPostNotes={setPostNotes}
          setShowReminderModal={setShowReminderModal}
          setSub={handleSubChange}
        />
      )}

      {/* Proforma Invoice Overlay Modal */}
      {showProformaModal && (
        <PreviewProformaSheet
          s={s}
          set={set}
          client={client}
          job={job}
          ids={ids}
          items={items}
          prodGst={prodGst}
          adjustSampleCharges={adjustSampleCharges}
          advanceDue={effectiveAdv}
          deliveryDate={deliveryDate}
          onClose={() => setShowProformaModal(false)}
          onSend={(channel) => {
            const piNo = s.pi?.no || ids.pi || `PI/26/${s.seq || "0415"}`;
            const sentAt = new Date().toISOString();
            set({
              pi: {
                ...(s.pi || {}),
                no: piNo,
                sent: channel,
                sent_at: sentAt,
              },
            });
            const targetId = s.id || s._id || s.enquiry_id || s.seq;
            axiosInstance
              .post(`/enquiry-flow-integration/${targetId}/share-proforma`, {
                channel,
                sentAt,
              })
              .catch((err) => console.log("Failed to log PI share to server:", err));
            setShowProformaModal(false);
          }}
        />
      )}

      {/* Payment Reminder Overlay Modal */}
      {showReminderModal && (
        <PreviewPaymentReminderSheet
          s={s}
          client={client}
          job={job}
          ids={ids}
          items={items}
          totalInvoiceVal={totalInvoiceVal}
          advanceDue={effectiveAdv}
          deliveryDate={deliveryDate}
          currentDeliv={s.deliv || {}}
          onClose={() => setShowReminderModal(false)}
          onSend={() => {
            set({
              advReminderSent: dfmt(todayISO()),
            });
            setShowReminderModal(false);
          }}
        />
      )}
    </div>
  );
};

export default OrderPipeline;
