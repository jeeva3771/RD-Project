import React, { useMemo, useEffect } from "react";
import {
  isMulti,
  allItems,
  itemName,
  inr,
  gstTag,
  sampleTax,
  addWork,
  fmt,
  isoOf,
  eventDateOf,
  enqDelivDate,
  workDaysTo,
  formatEnquiryNo,
  ENQUIRY_CONFIG,
  deriveDocNo,
  formatAddress,
} from "../../utils/helpers";
import BillingParty from "./BillingParty";
import SamplePricingSection from "./details-step/SamplePricingSection";
import PreviewDeliveryChargesSheet from "./PreviewDeliveryChargesSheet";
import CommunicationLogForm from "../common/CommunicationLogForm";
import DeliveryChargesBlock from "./delivery/DeliveryChargesBlock";
import { generateSpecLine } from "../../utils/specLineGenerator";
import { axiosInstance } from "../../../../utils/url/config";
import { toast } from "react-toastify";

const DetailsStep = ({ s, set, client, job, next, ids }) => {
  const isS = s.mode === "sample";
  const isPhotoVideoCarrier = Boolean(
    isS &&
    (s.sampleCarrier === "Photos / video only" ||
     s.delivCarrier === "Photos / video only" ||
     /photo.*video|video.*photo|photos \/ video/i.test(s.sampleCarrier || s.delivCarrier || ""))
  );
  const qtyKey = isS ? "sampleQty" : "qty";
  const eventDate = eventDateOf(s.e);
  const sampleCost = s.costing ? s.costing.sampleRate : Math.round((job?.rate || 1000) * 1.5);

  const leadDays = isS ? [1, 2, 3, 5] : [10, 12, 15];

  // Resolve all valid addresses belonging to this enquiry's customer
  const customerAddresses = useMemo(() => {
    const list = [];
    const seen = new Set();

    const addAddr = (id, label, address, city, pin, contact, phone) => {
      const cleanLabel = String(label || "").trim();
      const cleanAddr = String(address || "").trim();
      const cleanCity = String(city || "").trim();
      const key = `${cleanLabel}|${cleanAddr}|${cleanCity}`.toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);

      list.push({
        id: String(id || `addr_${list.length}`),
        label: cleanLabel || (cleanCity ? `${cleanCity} Address` : `Address ${list.length + 1}`),
        address: cleanAddr,
        city: cleanCity,
        pin: String(pin || ""),
        contact: String(contact || ""),
        phone: String(phone || ""),
      });
    };

    // 1. From client.shipTos
    if (Array.isArray(client?.shipTos)) {
      client.shipTos.forEach((sh, i) => {
        if (sh && (sh.label || sh.address || sh.city)) {
          addAddr(sh.id || `sh_${i}`, sh.label, sh.address, sh.city, sh.pin, sh.site_contact, sh.site_phone);
        }
      });
    }

    // 2. From client.address or rawJob.customer_id.address
    const rawAddresses = (Array.isArray(client?.address) && client.address.length > 0)
      ? client.address
      : (Array.isArray(s.rawJob?.customer_id?.address) ? s.rawJob.customer_id.address : []);
    if (Array.isArray(rawAddresses)) {
      rawAddresses.forEach((a, i) => {
        if (a) {
          const full = a.address || `${a.address_1 || ""}${a.address_2 ? ", " + a.address_2 : ""}`.trim();
          addAddr(a._id ? String(a._id) : `raw_${i}`, a.label, full, a.city, a.postal_code || a.pin, a.site_contact, a.site_phone);
        }
      });
    }

    // 3. From enquiry step 1 custom addresses (e.customShipTos)
    if (Array.isArray(s.e?.customShipTos)) {
      s.e.customShipTos.forEach((csh, i) => {
        if (csh && (csh.label || csh.address || csh.city)) {
          addAddr(csh.id || `custom_${i}`, csh.label, csh.address, csh.city, csh.pin, csh.site_contact, csh.site_phone);
        }
      });
    }

    // 4. From newly added addresses in this step (s.customShipTos)
    if (Array.isArray(s.customShipTos)) {
      s.customShipTos.forEach((csh, i) => {
        if (csh && (csh.label || csh.address || csh.city)) {
          addAddr(csh.id || `new_${i}`, csh.label, csh.address, csh.city, csh.pin, csh.site_contact, csh.site_phone);
        }
      });
    }

    // 5. Fallback from billing address if client has no specific shipping addresses
    if (list.length === 0 && client?.billing) {
      addAddr("billing_main", `${client.name || "Client"} Office`, formatAddress(client.billing), "", "");
    }

    return list;
  }, [client, s.rawJob?.customer_id?.address, s.e?.customShipTos, s.customShipTos]);

  // Selected sample address
  const activeSampleAddr = useMemo(() => {
    if (s.sampleShipToId) {
      const found = customerAddresses.find((a) => a.id === s.sampleShipToId);
      if (found) return found;
    }
    if (s.sampleShipTo) {
      const found = customerAddresses.find(
        (a) =>
          a.label?.toLowerCase() === String(s.sampleShipTo).toLowerCase() ||
          a.address?.toLowerCase() === String(s.sampleShipTo).toLowerCase()
      );
      if (found) return found;
    }
    if (s.e?.deliverToAddress) {
      const found = customerAddresses.find((a) => a.id === s.e.deliverToAddress);
      if (found) return found;
    }
    return customerAddresses[0] || null;
  }, [s.sampleShipToId, s.sampleShipTo, s.e?.deliverToAddress, customerAddresses]);

  // Selected final delivery address
  const activeFinalAddr = useMemo(() => {
    if (s.delivShipToId) {
      const found = customerAddresses.find((a) => a.id === s.delivShipToId);
      if (found) return found;
    }
    if (s.e?.deliverToAddress) {
      const found = customerAddresses.find((a) => a.id === s.e.deliverToAddress);
      if (found) return found;
    }
    return customerAddresses[0] || null;
  }, [s.delivShipToId, s.e?.deliverToAddress, customerAddresses]);

  // Auto-select initial sample address if not explicitly selected
  useEffect(() => {
    if (isS && activeSampleAddr && !s.sampleShipTo) {
      set({
        sampleShipTo: activeSampleAddr.label,
        sampleShipToId: activeSampleAddr.id,
        sampleAddress: activeSampleAddr,
        shipTo: activeSampleAddr.address || activeSampleAddr.label,
        sampleCity: activeSampleAddr.city || s.sampleCity || "",
      });
    }
  }, [isS, activeSampleAddr, s.sampleShipTo, s.sampleCity, set]);

  const handleSaveNewAddress = async () => {
    if (!s.newAddrName || !s.newAddrCity || !s.newAddrFull) return;
    const newObj = {
      id: `sh_${Date.now()}`,
      label: s.newAddrName,
      address: s.newAddrFull,
      city: s.newAddrCity,
      pin: s.newAddrPin || "",
      site_contact: s.newAddrContact || "",
      site_phone: s.newAddrPhone || "",
    };

    const targetClientId = client?.id || s.clientId || s.rawJob?.customer_id?._id || s.rawJob?.customer_id;
    if (targetClientId) {
      try {
        const res = await axiosInstance.post(`/customer/${targetClientId}/address`, {
          label: s.newAddrName,
          address_1: s.newAddrFull,
          city: s.newAddrCity,
          postal_code: s.newAddrPin ? s.newAddrPin.trim() : "",
          site_contact: s.newAddrContact || "",
          site_phone: s.newAddrPhone || "",
          is_shipping: true,
        });
        if (res.data?.newAddress?._id) {
          newObj.id = String(res.data.newAddress._id);
        }
      } catch (err) {
        console.warn("Could not save address to customer master:", err);
      }
    }

    set({
      sampleShipTo: newObj.label,
      sampleShipToId: newObj.id,
      sampleAddress: newObj,
      shipTo: newObj.address || newObj.label,
      sampleCity: newObj.city || s.sampleCity,
      customShipTos: [...(s.customShipTos || []), newObj],
      isAddingNewAddress: false,
      isChangingAddress: false,
      newAddrName: "",
      newAddrCity: "",
      newAddrPin: "",
      newAddrFull: "",
      newAddrContact: "",
      newAddrPhone: "",
    });
    toast.success("New address saved and selected!");
  };

  const costingLines = useMemo(() => {
    const rawList = (s.costing?.lines && s.costing.lines.length > 0)
      ? s.costing.lines
      : allItems(s);

    return rawList.map((l, idx) => {
      const key = l.id || l.rateKey || `line_${idx}`;
      const subJobCode = l.subJobNo || (ids?.enq ? `${ids.enq}-A${idx + 1}` : undefined);

      const matchedSj = (Array.isArray(s.sub_jobs) ? s.sub_jobs : []).find(
        (sj) => (subJobCode && sj.sub_job_no === subJobCode) ||
                (l.id && (sj.id === l.id || sj.sub_job_no === l.id)) ||
                (sj.sub_job_no && sj.sub_job_no.endsWith(`-A${idx + 1}`)) ||
                (l.name && (sj.theme === l.name || sj.product_name === l.name))
      ) || (s.sub_jobs || [])[idx];

      const sim = s.simulatedRates?.[key] ||
                  (subJobCode ? s.simulatedRates?.[subJobCode] : null) ||
                  s.simulatedRates?.[`${idx}-0`] ||
                  (matchedSj?.sub_job_no ? s.simulatedRates?.[matchedSj.sub_job_no] : null);

      const effUnitRate = Number(
        sim?.rate !== undefined
          ? sim.rate
          : (l.unitRate || l.rate || matchedSj?.unit_rate || matchedSj?.target_rate || l.target_rate || 0)
      );

      // Quotation sample rate resolution:
      // 1. sim.sample (if edited in quotation card)
      // 2. matchedSj.sample_rate (from sub_job in DB)
      // 3. l.quotationSampleRate (if previously remembered)
      // 4. l.sampleRate (if explicitly set > 0)
      // 5. Default quotation formula: unitRate + 200
      let quoteSampleRate = 0;
      if (sim?.sample !== undefined && Number(sim.sample) > 0) {
        quoteSampleRate = Number(sim.sample);
      } else if (matchedSj?.sample_rate !== undefined && Number(matchedSj.sample_rate) > 0) {
        quoteSampleRate = Number(matchedSj.sample_rate);
      } else if (l.quotationSampleRate !== undefined && Number(l.quotationSampleRate) > 0) {
        quoteSampleRate = Number(l.quotationSampleRate);
      } else if (l.sampleRate !== undefined && Number(l.sampleRate) > 0) {
        quoteSampleRate = Number(l.sampleRate);
      } else if (effUnitRate > 0) {
        quoteSampleRate = Number((effUnitRate + 200).toFixed(2));
      } else if (s.sampleRate && Number(s.sampleRate) > 0) {
        quoteSampleRate = Number(s.sampleRate);
      }

      const isFoc = (s.charge || "foc") === "foc";
      const activeSampleRate = isFoc
        ? 0
        : (l.sampleRate !== undefined && Number(l.sampleRate) > 0 ? Number(l.sampleRate) : quoteSampleRate);

      let safeSpec = "";
      if (typeof l.spec === "string" && l.spec.trim()) {
        safeSpec = l.spec;
      } else if (typeof l.specLine === "string" && l.specLine.trim()) {
        safeSpec = l.specLine;
      } else if (typeof l.spec_line === "string" && l.spec_line.trim()) {
        safeSpec = l.spec_line;
      } else if (typeof l.spec === "object" && l.spec !== null) {
        safeSpec = generateSpecLine(l.type || l.category || 'trophy', l.spec, l);
      } else {
        const sz = typeof l.size === 'object' ? (l.size?.trophyH || l.size?.size || (8 + idx)) : (l.size || (8 + idx));
        safeSpec = `${l.category || l.type || 'Plaque'} · Composite with a solid base · ${sz} in · Fusion: ${l.materials?.join(' + ') || l.material || 'Crystal + Aluminium'} · Metal elements`;
      }

      return {
        ...l,
        id: key,
        subJobNo: subJobCode || l.subJobNo,
        name: l.name || l.title || matchedSj?.theme || matchedSj?.product_name || `Product ${idx + 1}`,
        spec: safeSpec,
        rate: effUnitRate,
        sampleRate: activeSampleRate,
        quotationSampleRate: quoteSampleRate,
      };
    });
  }, [s, ids?.enq]);

  const sampledItems = costingLines.map(l => l.id);

  const toggleSampledItem = (id) => {
    // Checkboxes removed as all items are sampled
  };

  const sampleChargePerSet = costingLines.reduce((acc, l) => {
    const r = (s.charge === "foc")
      ? 0
      : (l.sampleRate !== undefined && Number(l.sampleRate) > 0
          ? Number(l.sampleRate)
          : Number(l.quotationSampleRate || 0));
    return acc + r;
  }, 0);

  const displaySampleRate = (s.charge === "foc")
    ? 0
    : (s.sampleRateManual !== undefined && Number(s.sampleRateManual) > 0
        ? Number(s.sampleRateManual)
        : (sampleChargePerSet > 0 ? sampleChargePerSet : (Number(s.sampleRate) || 0)));
  const sampleSetsQty = s[qtyKey] || 1;
  const totalSampleCharge = sampleSetsQty * displaySampleRate;

  const absorbedPerPc = sampleChargePerSet > 0 ? sampleChargePerSet : 2180;
  const absorbedTotal = absorbedPerPc * sampleSetsQty;

  const pick = (k, v, how = "picked") =>
    set({ [k]: v, touched: { ...s.touched, [k]: how } });

  // Helper to safely get the previous calendar day (YYYY-MM-DD)
  const getPreviousDayISO = (dateStr) => {
    if (!dateStr) return undefined;
    const parts = String(dateStr).slice(0, 10).split('-');
    if (parts.length !== 3) return undefined;
    const [y, m, d] = parts.map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() - 1);
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Needed by date (delivery deadline / event date from enquiry)
  const neededByDateRaw = s.e?.delivery_date || s.e?.neededByDate || s.e?.event_date || s.e?.eventExactDate || s.e?.eventDate;
  const neededByDate = neededByDateRaw ? new Date(neededByDateRaw) : null;
  const neededByDateISO = neededByDateRaw ? String(neededByDateRaw).slice(0, 10) : "";

  // The maximum allowed job delivery date can be on or before needed by date
  const maxJobDeliveryDateISO = neededByDateISO || undefined;

  // Job delivery date (when shop floor delivers / completes)
  const enquiryJobDate = s.e?.job_completion_date || s.e?.jobCompletionDate;
  const defaultJobDelivery = maxJobDeliveryDateISO || isoOf(addWork(10));
  const jobDeliveryDateRaw = s.jobDeliveryDate || enquiryJobDate || defaultJobDelivery || "";
  const jobDeliveryDate = jobDeliveryDateRaw ? new Date(jobDeliveryDateRaw) : null;

  // Validation: For production mode only, job delivery date must not be strictly after needed by date
  // (In sample mode, sample ticket is for sample making in 2-3 days, not bulk production)
  const isJobDeliveryAfterNeededBy = Boolean(
    !isS &&
    neededByDateISO &&
    jobDeliveryDateRaw &&
    neededByDate &&
    neededByDate > new Date() &&
    String(jobDeliveryDateRaw).slice(0, 10) > neededByDateISO
  );

  const targetDate = jobDeliveryDate || (neededByDateRaw ? new Date(neededByDateRaw) : null);

  const handleJobDeliveryDateChange = (val) => {
    if (!isS && neededByDateISO && val > neededByDateISO) {
      set({
        jobDeliveryDate: val,
        jobDeliveryDateError: `Job delivery date must be on or before needed by date (${fmt(neededByDate)})`
      });
    } else {
      set({ jobDeliveryDate: val, jobDeliveryDateError: null });
    }
  };

  const earliestSampleDateObj = addWork(2);
  const earliestSampleDateISO = isoOf(earliestSampleDateObj);

  const defaultDays = isS ? 2 : 10;
  const effectiveLeadDate = s.leadDate || isoOf(addWork(defaultDays));

  let daysForProduction = null;
  let urgencyLevel = "safe";

  if (effectiveLeadDate && targetDate) {
    const sDate = new Date(effectiveLeadDate);
    const diffMs = targetDate.getTime() - sDate.getTime();
    daysForProduction = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (daysForProduction < 4) {
      urgencyLevel = "critical";
    } else if (daysForProduction < 8) {
      urgencyLevel = "tight";
    } else {
      urgencyLevel = "safe";
    }
  }

  const getMissingSampleDetails = () => {
    if (!isS) {
      const missing = [];
      if (isJobDeliveryAfterNeededBy || s.jobDeliveryDateError) {
        missing.push(s.jobDeliveryDateError || `Job delivery date must be on or before needed by date (${fmt(neededByDate)})`);
      }
      if (!activeFinalAddr && !s.shipTo) {
        missing.push("Final delivery destination address");
      }
      if (s.isAddingNewAddress) {
        missing.push("Save or cancel pending new address");
      }
      return missing;
    }

    const missing = [];
    // If Photos / video only is chosen for sample, physical delivery address, receiver, and courier charges are not needed
    if (isPhotoVideoCarrier) {
      const carrier = s.sampleCarrier || s.delivCarrier;
      if (!carrier) missing.push("Select carrier mode");
      return missing;
    }

    // 1. Destination Area
    const area = s.sampleArea || "Local";
    if (area === "Maharashtra" || area === "In India") {
      if (!s.sampleCity || !s.sampleCity.trim()) {
        missing.push("City/State for sample area");
      }
    } else if (area === "Abroad") {
      if (!s.sampleCity || !s.sampleCity.trim()) missing.push("Destination City");
      if (!s.sampleCountry || !s.sampleCountry.trim()) missing.push("Destination Country");
    }

    // 2. Carrier & Courier Charges
    const carrier = s.sampleCarrier || s.delivCarrier;
    if (!carrier) {
      missing.push("Select carrier mode");
    } else {
      const needsCourierCharges = ['Tempo', 'Porter', 'Courier', 'Air cargo'].includes(carrier);
      if (needsCourierCharges) {
        if (!s.sampleFreight && !s.delivPayer) {
          missing.push("Select freight payer: RD pays or Client pays");
        }
        if (!s.sampleChargesAmount || Number(s.sampleChargesAmount) <= 0) {
          missing.push("Delivery rate from Packing Team awaited");
        } else if ((s.sampleFreight === 'Client pays freight' || s.delivPayer === 'client') && s.sampleChargesState !== "approved") {
          missing.push("Client approval required for courier charges");
        }
      }
    }

    // 3. Customer Address
    if (s.isAddingNewAddress) {
      missing.push("Save or cancel pending new address");
    } else if (!activeSampleAddr && !s.sampleShipTo && !s.shipTo && !s.sampleAddress) {
      missing.push("Customer delivery address");
    }

    // 4. Receiver
    const hasReceiver = Boolean(
      s.sampleReceiver ||
      client?.contacts?.[0]?.name ||
      client?.contact_person ||
      client?.name
    );
    if (!hasReceiver) {
      missing.push("Receiver contact");
    }

    // 5. When
    const effWhen = s.sampleWhen || "Office hours";
    if (!effWhen) {
      missing.push("Delivery timing (When)");
    }

    return missing;
  };

  const missingDetails = getMissingSampleDetails();
  const isReviewDisabled = missingDetails.length > 0;

  React.useEffect(() => {
    if (!s.leadDate) {
      const d = addWork(defaultDays);
      set({ leadDate: isoOf(d), lead: defaultDays });
    }
    if (!s.jobDeliveryDate && defaultJobDelivery) {
      set({ jobDeliveryDate: defaultJobDelivery });
    }
    if (!s.sampleWhen) {
      set({ sampleWhen: "Office hours" });
    }
    if (!s.sampleReceiver) {
      const defaultRecv = client?.contacts?.[0]?.name || client?.contact_person;
      if (defaultRecv) set({ sampleReceiver: defaultRecv });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isS, client]);

  return (
    <div className="fade space-y-4">
      {/* GSTIN Reminder Banner */}
      {client && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between text-xs text-blue-900">
          <div>
            <strong>Client GST Status:</strong>{" "}
            {client.gstin ? `GSTIN Registered (${client.gstin})` : "GST Registration Pending / Not Provided"}
          </div>
          {!client.gstin && (
            <span className="text-[11px] font-semibold text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-300">
              Reminder at Production
            </span>
          )}
        </div>
      )}

      {/* Primary Details Panel */}
      <div className="panel p-4 bg-white border rounded-xl shadow-sm space-y-4">
        {/* Quantity Selection */}
        <div>
          <label className="block text-sm font-bold text-gray-900 mb-2">
            {isS
              ? isMulti(s)
                ? "How many sample sets? (one piece of each sampled item per set)"
                : "How many sample sets? (one piece of each sampled item per set)"
              : "Order quantity"}
          </label>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center border border-gray-200 rounded-full bg-white px-2 py-1 shadow-xs">
              <button
                type="button"
                className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 text-lg font-medium transition"
                onClick={() => set({ [qtyKey]: Math.max(1, (s[qtyKey] || 1) - 1) })}
              >
                -
              </button>
              <input
                className="w-10 text-center py-0.5 text-sm font-bold bg-transparent outline-none text-gray-800"
                type="number"
                value={s[qtyKey] || 1}
                onChange={(e) =>
                  set({ [qtyKey]: parseInt(e.target.value) || 1 })
                }
              />
              <button
                type="button"
                className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 text-lg font-medium transition"
                onClick={() => set({ [qtyKey]: (s[qtyKey] || 1) + 1 })}
              >
                +
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {(isS ? [1, 2, 3, 5] : [50, 100, 250, 500]).map((q) => {
                const isSelected = (s[qtyKey] || (isS ? 1 : 100)) === q;
                const isRecommended = isS && q === 2;

                if (isSelected) {
                  return (
                    <button
                      key={q}
                      type="button"
                      className="w-8 h-8 rounded-full bg-[#4F46E5] text-white font-bold text-xs flex items-center justify-center shadow-xs transition"
                      onClick={() => pick(qtyKey, q)}
                    >
                      {q}
                    </button>
                  );
                }

                if (isRecommended) {
                  return (
                    <button
                      key={q}
                      type="button"
                      className="px-2.5 h-8 rounded-full border border-dashed border-amber-400 bg-white text-gray-800 text-xs font-semibold flex items-center gap-1 hover:bg-amber-50/50 transition"
                      onClick={() => pick(qtyKey, q)}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                      <span>{q}</span>
                    </button>
                  );
                }

                return (
                  <button
                    key={q}
                    type="button"
                    className="w-8 h-8 rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 text-xs font-medium flex items-center justify-center transition"
                    onClick={() => pick(qtyKey, q)}
                  >
                    {isS ? q : `${q} pcs`}
                  </button>
                );
              })}
            </div>
          </div>
          {!isS && s.e && s.e.qty && (
            <p className="text-xs text-gray-400 mt-1">Enquiry indicated {s.e.qty} pcs.</p>
          )}
        </div>

        {/* Sample Charges Section (Sample Mode Only) */}
        {isS && (
          <>
            {(s.sampleRatesState === "revision" || s.sampleDecision?.decision === "revision") && (
              <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 mb-3 flex items-start gap-3 shadow-xs">
                <span className="text-xl">⚠️</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-900">
                      Client Requested Sample Rate Alterations
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 uppercase">
                      Revision Requested
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-amber-950 italic bg-amber-100/70 p-2 rounded-xl border border-amber-200/80 mb-1.5">
                    "{s.sampleDecision?.notes || "Client requested changes to sample rates"}"
                  </p>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Please adjust the sample charge or individual sub-job rates below. Once updated, click <strong>"Review ticket"</strong> to re-share the revised confirmation sheet with the client.
                  </p>
                </div>
              </div>
            )}
            <SamplePricingSection
              s={s}
              set={set}
              client={client}
              pick={pick}
              displaySampleRate={displaySampleRate}
              costingLines={costingLines}
              sampledItems={sampledItems}
              toggleSampledItem={toggleSampledItem}
              sampleSetsQty={sampleSetsQty}
              absorbedTotal={absorbedTotal}
              absorbedPerPc={absorbedPerPc}
            />
          </>
        )}

        {/* PO details (Production Mode Only) */}
        {!isS && (
          <div className="space-y-2 pt-3 border-t">
            <div className="text-xs font-bold text-gray-900">Client PO Number</div>
            <div className="flex items-center gap-2">
              <input
                className="border rounded px-3 py-1.5 text-sm bg-white flex-1 max-w-xs"
                placeholder="Enter PO number"
                value={s.po || ""}
                disabled={s.poPending}
                onChange={(ev) => set({ po: ev.target.value, touched: { ...s.touched, po: "typed" } })}
              />
              <button
                className={`px-3 py-1.5 text-xs font-semibold rounded border transition ${s.poPending
                    ? "bg-amber-500 text-white border-amber-500"
                    : "bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100"
                  }`}
                onClick={() => set({ poPending: !s.poPending, po: "" })}
              >
                PO to follow
              </button>
            </div>
          </div>
        )}

        {/* Delivery / Lead Time */}
        <div className="space-y-3 pt-4 pb-2 border-t mt-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <span className="text-xs font-bold text-gray-800">
              {isS ? "Sampling time · sample ready by" : "Delivery Date"}
            </span>

            {/* Target Job Delivery Date */}
            <div className="flex flex-col items-end">
              <div className={`flex items-center gap-2 rounded-lg px-2.5 py-1 border transition ${isJobDeliveryAfterNeededBy || s.jobDeliveryDateError
                  ? "bg-red-50 border-red-300"
                  : "bg-indigo-50/70 border-indigo-100"
                }`}>
                <span className="text-[11px] font-semibold text-indigo-900">Job delivery date:</span>
                <input
                  type="date"
                  max={maxJobDeliveryDateISO || undefined}
                  className={`bg-white border rounded px-1.5 py-0.5 text-xs font-bold outline-none cursor-pointer transition ${isJobDeliveryAfterNeededBy || s.jobDeliveryDateError
                      ? "border-red-400 text-red-900 bg-red-50"
                      : "border-indigo-200 text-indigo-950 focus:border-indigo-400"
                    }`}
                  value={jobDeliveryDateRaw ? String(jobDeliveryDateRaw).slice(0, 10) : ""}
                  onChange={(e) => handleJobDeliveryDateChange(e.target.value)}
                />
                {neededByDate && (
                  <span className="text-[10px] text-indigo-600 font-medium whitespace-nowrap">
                    (Needed by: {fmt(neededByDate)})
                  </span>
                )}
              </div>
              {(isJobDeliveryAfterNeededBy || s.jobDeliveryDateError) && (
                <span className="text-[10px] font-bold text-red-600 mt-1">
                  {s.jobDeliveryDateError || `Must be before needed by date (${fmt(neededByDate)})`}
                </span>
              )}
            </div>
          </div>

          <p className="text-xs text-gray-400">
            {isS
              ? "Calculated backwards from the job delivery date so shop floor has adequate time for bulk production."
              : "Pick the delivery date and the working days needed are worked out."}
          </p>

          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-gray-700 font-semibold">{isS ? "Sample ready date:" : "Delivery date:"}</span>
            <input
              className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs bg-white text-gray-800 font-semibold outline-none shadow-xs"
              type="date"
              value={s.leadDate || ""}
              onChange={(e) =>
                set({
                  leadDate: e.target.value,
                  lead: workDaysTo(e.target.value),
                  touched: { ...s.touched, leadDate: "picked" }
                })
              }
            />

            {/* Quick 1-click Earliest Target */}
            {isS && (
              <button
                type="button"
                className="text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100 text-indigo-800 transition flex items-center gap-1 cursor-pointer"
                onClick={() =>
                  set({
                    leadDate: earliestSampleDateISO,
                    lead: 2,
                    touched: { ...s.touched, leadDate: "picked" }
                  })
                }
              >
                <span>⚡ Earliest: {fmt(earliestSampleDateObj)}</span>
                <span className="text-[10px] text-indigo-500 font-normal">(2 working days)</span>
              </button>
            )}

            {s.lead ? (
              <span className="text-xs text-gray-600 bg-gray-100 border border-gray-200 font-medium px-2.5 py-1 rounded-lg">
                {s.lead} working {s.lead === 1 ? "day" : "days"} to make
              </span>
            ) : null}
          </div>

          {/* Dynamic Production Buffer & Turnaround Alert */}
          {isS && targetDate && daysForProduction !== null && (
            <div className="pt-1">
              {urgencyLevel === "safe" && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2 shadow-xs">
                  <span className="text-emerald-600 font-bold text-sm">✓</span>
                  <div>
                    <div className="font-bold">Safe Buffer ({daysForProduction} days left for bulk production)</div>
                    <div className="text-[11px] text-emerald-700 mt-0.5">
                      Sample ready by {fmt(new Date(s.leadDate))} leaves ample time for client approval and bulk manufacturing before final delivery on {fmt(targetDate)}.
                    </div>
                  </div>
                </div>
              )}

              {urgencyLevel === "tight" && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-950 flex items-start gap-2 shadow-xs">
                  <span className="text-amber-600 font-bold text-sm">⚠️</span>
                  <div>
                    <div className="font-bold flex items-center gap-2">
                      <span>Tight Turnaround ({daysForProduction} days left for bulk production)</span>
                      <span className="bg-amber-200 text-amber-900 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">Rush</span>
                    </div>
                    <div className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                      Delivery is on {fmt(targetDate)}. Physical courier may lose 1-2 days. <strong>Recommended:</strong> Approve sample via <strong>Shop Floor HD Photo/Video</strong> on WhatsApp so bulk production starts immediately!
                    </div>
                  </div>
                </div>
              )}

              {urgencyLevel === "critical" && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-950 flex items-start gap-2 shadow-xs">
                  <span className="text-rose-600 font-bold text-sm">🚨</span>
                  <div>
                    <div className="font-bold flex items-center gap-2">
                      <span>Critical Deadline ({Math.max(0, daysForProduction)} days left before {fmt(targetDate)})</span>
                      <span className="bg-rose-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">High Risk</span>
                    </div>
                    <div className="text-[11px] text-rose-800 mt-0.5 leading-relaxed">
                      Physical sample transit will cause the delivery deadline to be missed! <strong>Action required:</strong> Switch to <em>"Straight to Production"</em> or mandate instant digital photo/video approval on dispatch date.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Delivery Details Form (Always rendered for both Sample and Production) */}
        <div className="mt-6 space-y-0">
          {/* Top Destination Summary */}
          {isS ? (
            <div className="flex gap-4 mb-6">
              <div className="flex-1 p-3 border-2 border-amber-400 rounded-xl bg-[#FFFDF0] flex items-start gap-3 shadow-xs">
                <span className="text-2xl mt-1 leading-none">🧪</span>
                <div className="flex flex-col h-full justify-between w-full">
                  <div>
                    <div className="text-[10px] font-bold text-gray-500 uppercase mb-0.5">Sample Goes To</div>
                    <div className="font-bold text-base text-gray-900">{activeSampleAddr?.label || `${client?.name || "Client"} Office`}</div>
                    <div className="text-[11px] text-gray-600 mt-0.5 truncate" title={activeSampleAddr?.address}>
                      {activeSampleAddr?.address ? `${activeSampleAddr.address.slice(0, 45)}...` : (activeSampleAddr?.city || "Customer Address")}
                    </div>
                    <div className="text-[11px] font-medium mt-1">
                      <span className="text-gray-500 font-semibold mr-1">Carrier:</span>
                      {s.sampleCarrier ? (
                        <span className="text-indigo-700 font-bold">
                          {s.sampleCarrier}, {s.sampleFreight === 'Client pays freight' ? 'client pays' : 'we pay'}
                        </span>
                      ) : (
                        <span className="text-amber-700 font-semibold">
                          Not selected yet
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-[10px] font-bold text-gray-400 mt-3 uppercase tracking-wider">Set Below</div>
                </div>
              </div>
              <div className="flex-1 p-3 border-2 border-emerald-500 rounded-xl bg-emerald-50/50 flex items-start gap-3 shadow-xs">
                <span className="text-2xl mt-1 leading-none">🏭</span>
                <div className="flex flex-col h-full justify-between w-full">
                  <div>
                    <div className="text-[10px] font-bold text-gray-500 uppercase mb-0.5">Final Order Goes To</div>
                    <div className="font-bold text-base text-gray-900">{activeFinalAddr?.label || activeSampleAddr?.label || `${client?.name || "Client"} Office`}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      {activeFinalAddr?.city ? `${activeFinalAddr.city} · ` : ""}{targetDate ? fmt(targetDate) : "Sat, 31 Oct"}
                    </div>
                  </div>
                  <div className="text-[10px] font-bold text-gray-400 mt-3 uppercase tracking-wider">From the enquiry · Confirmed at dispatch</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 border-2 border-emerald-500 rounded-xl bg-emerald-50/50 flex items-start gap-3 shadow-xs mb-6">
              <span className="text-2xl mt-1 leading-none">🏭</span>
              <div className="flex flex-col h-full justify-between w-full">
                <div>
                  <div className="text-[10px] font-bold text-gray-500 uppercase mb-0.5">Final Order Goes To</div>
                  <div className="font-bold text-base text-gray-900">{activeFinalAddr?.label || `${client?.name || "Client"} Office`}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    {activeFinalAddr?.address ? `${activeFinalAddr.address} · ` : ""}by {s.leadDate ? fmt(new Date(s.leadDate)) : (targetDate ? fmt(targetDate) : "Sat, 31 Oct")}
                  </div>
                </div>
                <div className="text-[10px] font-bold text-gray-400 mt-3 uppercase tracking-wider">From the enquiry</div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 mb-4 pt-2 border-t border-transparent">
            <span className="text-emerald-500 text-lg leading-none">{isS ? "🧪" : "🚚"}</span>
            <span className="text-xs font-bold text-gray-800">
              {isS ? "Sample delivery details" : "Delivery details"}{" "}
              <span className="text-gray-400 font-normal text-[10px] ml-1">(editable later on the job page)</span>
            </span>
          </div>

          {!isS && (
            <div className="p-3 bg-gray-50/60 border border-gray-200 rounded-xl mb-4 text-xs space-y-1">
              <div className="grid grid-cols-[140px_1fr_auto] gap-2 py-0.5 text-gray-600">
                <span className="text-[11px] text-gray-500">Logged at enquiry</span>
                <span className="font-medium text-gray-800">{activeFinalAddr?.label || `${client?.name || "Client"} Office`}</span>
                <span className="text-gray-500 font-medium">{s.leadDate ? fmt(new Date(s.leadDate)) : "Sat, 31 Oct"}</span>
              </div>
              <div className="grid grid-cols-[140px_1fr_auto] gap-2 py-1 border-t border-gray-200/60 font-bold text-gray-900">
                <span className="text-[11px] text-gray-700">For this delivery</span>
                <span>{activeFinalAddr?.label || `${client?.name || "Client"} Office`}</span>
                <span>{s.leadDate ? fmt(new Date(s.leadDate)) : "Sat, 31 Oct"}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-[90px_1fr] gap-3 items-start py-4 border-t border-gray-100">
            <div className="text-[10px] font-bold text-gray-500 mt-2">{isS ? "Sample area" : "Destination"}</div>
            <div>
              <div className="flex bg-gray-50/50 p-1 border border-gray-200 rounded-full w-max mb-3 shadow-2xs">
                {['Local', 'Maharashtra', 'In India', 'Abroad'].map(area => (
                  <button key={area} className={`px-3 py-1 text-[10px] font-semibold rounded-full transition flex items-center gap-1.5 ${s.sampleArea === area ? 'bg-white text-gray-900 border-2 border-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 border-2 border-transparent'}`} onClick={() => set({ sampleArea: area })}>
                    {area === 'Local' && <span>🏙️</span>}
                    {area === 'Maharashtra' && <span>🛣️</span>}
                    {area === 'In India' && <span className="text-[8px] font-bold tracking-wider text-gray-400">IN</span>}
                    {area === 'Abroad' && <span>🌍</span>}
                    {area}
                  </button>
                ))}
              </div>

              {(s.sampleArea === 'In India' || s.sampleArea === 'Maharashtra') && (
                <div className="mb-1">
                  <input type="text" className="w-56 px-3 py-1.5 text-[11px] font-medium text-gray-800 border border-gray-200 rounded-full outline-none focus:border-indigo-500 transition shadow-2xs" placeholder="City, State" value={s.sampleCity || ""} onChange={e => set({ sampleCity: e.target.value })} />
                </div>
              )}

              {s.sampleArea === 'Abroad' && (
                <div className="space-y-2 mb-1">
                  <input type="text" className="w-56 px-3 py-1.5 text-[11px] font-medium text-gray-800 border border-gray-200 rounded-full outline-none focus:border-indigo-500 transition shadow-2xs" placeholder="City" value={s.sampleCity || ""} onChange={e => set({ sampleCity: e.target.value })} />
                  <input type="text" className="w-56 px-3 py-1.5 text-[11px] font-medium text-gray-800 border border-gray-200 rounded-full outline-none focus:border-indigo-500 transition shadow-2xs block" placeholder="Country" value={s.sampleCountry || ""} onChange={e => set({ sampleCountry: e.target.value })} />
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-[90px_1fr] gap-3 items-start py-4 border-t border-gray-100">
            <div className="text-[10px] font-bold text-gray-500 mt-2">Carrier</div>
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {[
                  { n: 'Our vehicle', i: '🚐' },
                  { n: 'Hand delivery', i: '🤝' },
                  { n: 'Tempo', i: '🛺' },
                  { n: 'Porter', i: '🛵' },
                  { n: 'Courier', i: '📮' },
                  { n: 'Air cargo', i: '✈️' },
                  { n: "Client's courier", i: '📦' },
                  { n: 'Client pickup', i: '🏢' },
                  ...(isS ? [{ n: 'Photos / video only', i: '📷' }] : [])
                ].map(c => (
                  <button key={c.n} className={`px-3 py-1 text-[10px] font-semibold rounded-full border transition flex items-center gap-1.5 ${(s.sampleCarrier || s.delivCarrier) === c.n ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`} onClick={() => set({ sampleCarrier: c.n, delivCarrier: c.n, dmode: c.n })}>
                    <span>{c.i}</span> {c.n}
                  </button>
                ))}
              </div>

              {['Tempo', 'Porter', 'Courier', 'Air cargo'].includes(s.sampleCarrier || s.delivCarrier) && (
                <div className="flex bg-gray-50/50 p-1 rounded-full border border-gray-200 w-max shadow-2xs mt-1">
                  <button
                    className={`px-3 py-1.5 text-[10px] font-semibold rounded-full transition ${(s.sampleFreight === 'RD pays freight' || s.delivPayer === 'rd') ? 'bg-white text-gray-900 shadow-sm border border-gray-200/60 font-bold' : 'text-gray-500 hover:text-gray-700 border border-transparent'}`}
                    onClick={() => set({ sampleFreight: 'RD pays freight', delivPayer: 'rd' })}>
                    RD pays freight
                  </button>
                  <button
                    className={`px-3 py-1.5 text-[10px] font-semibold rounded-full transition ${(s.sampleFreight === 'Client pays freight' || s.delivPayer === 'client') ? 'bg-white text-gray-900 shadow-sm border border-gray-200/60 font-bold' : 'text-gray-500 hover:text-gray-700 border border-transparent'}`}
                    onClick={() => set({ sampleFreight: 'Client pays freight', delivPayer: 'client' })}>
                    Client pays freight
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Address Section */}
          {!isPhotoVideoCarrier ? (
            <div className="grid grid-cols-[90px_1fr] gap-3 items-start py-4 border-t border-gray-100">
              <div className="text-[10px] font-bold text-gray-500 mt-2">{isS ? "Sample goes to" : "Final delivery to"}</div>

              {s.isAddingNewAddress ? (
                <div className="p-4 border border-gray-200 rounded-xl bg-[#f9f9fb] shadow-xs">
                  <div className="grid grid-cols-[1fr_1fr_100px] gap-3 mb-3">
                    <div>
                      <div className="text-[9px] font-bold text-gray-500 mb-1">Name for this address</div>
                      <input type="text" className="w-full px-3 py-1.5 text-[11px] font-medium text-gray-800 border border-gray-200 rounded-xl outline-none focus:border-indigo-500 bg-white shadow-2xs" placeholder="e.g. Goa Venue / Branch Office" value={s.newAddrName || ''} onChange={e => set({ newAddrName: e.target.value })} />
                    </div>
                    <div>
                      <div className="text-[9px] font-bold text-gray-500 mb-1">City / town</div>
                      <input type="text" className="w-full px-3 py-1.5 text-[11px] font-medium text-gray-800 border border-gray-200 rounded-xl outline-none focus:border-indigo-500 bg-white shadow-2xs" placeholder="City or Town" value={s.newAddrCity || ''} onChange={e => set({ newAddrCity: e.target.value })} />
                    </div>
                    <div>
                      <div className="text-[9px] font-bold text-gray-500 mb-1">PIN code</div>
                      <input type="text" className="w-full px-3 py-1.5 text-[11px] font-medium text-gray-800 border border-gray-200 rounded-xl outline-none focus:border-indigo-500 bg-white shadow-2xs" placeholder="PIN code" value={s.newAddrPin || ''} onChange={e => set({ newAddrPin: e.target.value })} />
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="text-[9px] font-bold text-gray-500 mb-1">Full address</div>
                    <textarea className="w-full px-3 py-2 text-[11px] font-medium text-gray-800 border border-gray-200 rounded-xl outline-none focus:border-indigo-500 bg-white min-h-[60px] shadow-2xs" placeholder="Building, street, landmark, floor..." value={s.newAddrFull || ''} onChange={e => set({ newAddrFull: e.target.value })}></textarea>
                  </div>

                  <div className="grid grid-cols-[1fr_1fr] gap-3 mb-4 max-w-sm">
                    <div>
                      <div className="text-[9px] font-bold text-gray-500 mb-1">Contact at site <span className="font-normal text-gray-400 italic">(optional)</span></div>
                      <input type="text" className="w-full px-3 py-1.5 text-[11px] font-medium text-gray-800 border border-gray-200 rounded-xl outline-none focus:border-indigo-500 bg-white shadow-2xs" placeholder="Site Contact Person" value={s.newAddrContact || ''} onChange={e => set({ newAddrContact: e.target.value })} />
                    </div>
                    <div>
                      <div className="text-[9px] font-bold text-gray-500 mb-1">Site mobile <span className="font-normal text-gray-400 italic">(optional)</span></div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-gray-500 font-medium">+91</span>
                        <input type="text" className="flex-1 px-3 py-1.5 text-[11px] font-medium text-gray-800 border border-gray-200 rounded-xl outline-none focus:border-indigo-500 bg-white shadow-2xs" placeholder="Mobile Number" value={s.newAddrPhone || ''} onChange={e => set({ newAddrPhone: e.target.value })} />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button type="button" className="px-4 py-1.5 text-[11px] font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition shadow-2xs cursor-pointer" onClick={() => set({ isAddingNewAddress: false })}>Cancel</button>
                    <button
                      type="button"
                      className={`px-4 py-1.5 text-[11px] font-bold rounded-xl shadow-2xs transition cursor-pointer ${s.newAddrName && s.newAddrCity && s.newAddrFull ? 'bg-amber-400 text-amber-900 hover:bg-amber-500' : 'bg-[#FDE6A6] text-[#D4A34F] cursor-not-allowed'}`}
                      onClick={handleSaveNewAddress}
                    >
                      Save and deliver here
                    </button>
                    {(!s.newAddrName || !s.newAddrCity || !s.newAddrFull) && (
                      <span className="text-[10px] text-gray-400 font-medium">Name, full address and city are needed.</span>
                    )}
                  </div>
                </div>
              ) : s.isChangingAddress ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    className="px-3 py-1.5 text-[11px] font-medium text-gray-800 border border-gray-200 rounded-full outline-none focus:border-indigo-500 bg-white shadow-2xs max-w-md"
                    value={activeSampleAddr?.id || ""}
                    onChange={(e) => {
                      const chosen = customerAddresses.find((a) => a.id === e.target.value);
                      if (chosen) {
                        set({
                          sampleShipTo: chosen.label,
                          sampleShipToId: chosen.id,
                          sampleAddress: chosen,
                          shipTo: chosen.address || chosen.label,
                          sampleCity: chosen.city || s.sampleCity,
                          isChangingAddress: false,
                        });
                      }
                    }}
                  >
                    {customerAddresses.length === 0 ? (
                      <option value="">No customer addresses available</option>
                    ) : (
                      customerAddresses.map((addr) => (
                        <option key={addr.id} value={addr.id}>
                          {addr.label}{addr.city ? ` · ${addr.city}` : ""}{addr.address ? ` (${addr.address.slice(0, 40)}...)` : ""}
                        </option>
                      ))
                    )}
                  </select>
                  <button type="button" className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 px-2 cursor-pointer" onClick={() => set({ isAddingNewAddress: true })}>+ Add a new address</button>
                  <button type="button" className="text-[11px] font-medium text-gray-400 hover:text-gray-600 cursor-pointer" onClick={() => set({ isChangingAddress: false })}>Done</button>
                </div>
              ) : (
                <div className="space-y-4">
                  {!isS && (
                    <div className="flex bg-gray-50/50 p-1 border border-gray-200 rounded-full w-max shadow-2xs">
                      <button
                        type="button"
                        className={`px-3 py-1 text-[10px] font-semibold rounded-full transition cursor-pointer ${s.delivSplit !== "split"
                            ? "bg-white text-gray-900 border-2 border-indigo-600 shadow-sm"
                            : "text-gray-500 hover:text-gray-700 border-2 border-transparent"
                          }`}
                        onClick={() => set({ delivSplit: "one" })}
                      >
                        One address
                      </button>
                      <button
                        type="button"
                        className={`px-3 py-1 text-[10px] font-semibold rounded-full transition cursor-pointer ${s.delivSplit === "split"
                            ? "bg-white text-gray-900 border-2 border-indigo-600 shadow-sm"
                            : "text-gray-500 hover:text-gray-700 border-2 border-transparent"
                          }`}
                        onClick={() => set({ delivSplit: "split" })}
                      >
                        Split across locations
                      </button>
                    </div>
                  )}
                  {isS && (
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-[10px] font-semibold text-gray-400">Quick pick:</span>
                      {customerAddresses.map((addr) => {
                        const isSelected = activeSampleAddr?.id === addr.id;
                        return (
                          <button
                            key={addr.id}
                            type="button"
                            className={`px-3 py-1 text-[10px] font-bold rounded-full transition cursor-pointer ${isSelected
                                ? "bg-indigo-600 text-white shadow-sm"
                                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
                              }`}
                            onClick={() => {
                              const isDifferentAddr = activeSampleAddr?.id && activeSampleAddr.id !== addr.id;
                              const isApprovedRate = s.sampleChargesState === "approved" || s.delivery_charges?.status === "client_approved";

                              if (isDifferentAddr && isApprovedRate) {
                                toast.info("Delivery address changed! Previous approved rate moved to history. Re-request required.");
                                set({
                                  sampleShipTo: addr.label,
                                  sampleShipToId: addr.id,
                                  sampleAddress: addr,
                                  shipTo: addr.address || addr.label,
                                  sampleCity: addr.city || s.sampleCity,
                                  sampleChargesState: undefined,
                                  sampleChargesAmount: 0,
                                  sampleApprovalMethod: null,
                                  isChangingAddress: false,
                                });
                              } else {
                                set({
                                  sampleShipTo: addr.label,
                                  sampleShipToId: addr.id,
                                  sampleAddress: addr,
                                  shipTo: addr.address || addr.label,
                                  sampleCity: addr.city || s.sampleCity,
                                  isChangingAddress: false,
                                });
                              }
                            }}
                          >
                            {addr.label}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        className="px-3 py-1 text-[10px] font-bold rounded-full bg-white text-indigo-600 border border-dashed border-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                        onClick={() => { set({ isChangingAddress: true, isAddingNewAddress: true }); }}
                      >
                        + Other address
                      </button>
                    </div>
                  )}
                  <div className="p-3 border border-emerald-500 bg-white rounded-xl flex items-center justify-between shadow-xs">
                    <div className="flex items-start gap-2">
                      <span className="text-rose-500 text-sm mt-0.5">📍</span>
                      <div>
                        <div className="text-[9px] text-gray-400 font-medium mb-0.5">
                          {isS ? "Sample goes to this customer address" : "Final delivery · address from the enquiry"}
                        </div>
                        <div className="font-bold text-[12px] text-gray-900">
                          {activeSampleAddr?.label || `${client?.name || "Client"} Office`}
                        </div>
                        {activeSampleAddr?.address && (
                          <div className="text-[11px] text-gray-600 mt-0.5">
                            {formatAddress(activeSampleAddr.address)}
                            {activeSampleAddr.city ? `, ${activeSampleAddr.city}` : ""}
                            {activeSampleAddr.pin ? ` - ${activeSampleAddr.pin}` : ""}
                          </div>
                        )}
                        {activeSampleAddr?.contact && (
                          <div className="text-[10px] text-gray-500 mt-0.5">
                            Site contact: {activeSampleAddr.contact} {activeSampleAddr.phone ? `(${activeSampleAddr.phone})` : ""}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex flex-col justify-between items-end">
                      <div className="text-[10px] text-emerald-700 font-bold mb-1.5">{isS ? "✓ Sample goes here" : "✓ Confirmed"}</div>
                      <button type="button" className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer" onClick={() => set({ isChangingAddress: true })}>Change</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-[90px_1fr] gap-3 items-start py-4 border-t border-gray-100">
              <div className="text-[10px] font-bold text-gray-500 mt-2">Delivery</div>
              <div className="p-3.5 bg-gradient-to-r from-indigo-50/80 to-purple-50/50 border border-indigo-200 rounded-xl flex items-center justify-between text-xs text-indigo-950">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">📷</span>
                  <div>
                    <div className="font-bold text-indigo-950">Digital Sample Review (Photos &amp; Video)</div>
                    <div className="text-[11px] text-indigo-700 mt-0.5">
                      Completed sample photos &amp; video will be sent digitally via WhatsApp / Email. Physical shipping address and receiver details are not required.
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-indigo-200 text-indigo-900 shrink-0">
                  Digital Review ✓
                </span>
              </div>
            </div>
          )}

          {/* Receiver & When - Hidden if Carrier is Photos / video only */}
          {!isPhotoVideoCarrier && (
            <div className="grid grid-cols-2 gap-6 py-4 border-t border-gray-100">
              <div>
                <div className="text-[10px] font-bold text-gray-500 mb-1.5">Receiver</div>
                <select className="w-full px-3 py-1.5 text-[11px] font-medium text-gray-700 border border-gray-200 rounded-full outline-none focus:border-indigo-500 bg-white transition shadow-2xs" value={s.sampleReceiver || ""} onChange={e => set({ sampleReceiver: e.target.value })}>
                  <option value="">
                    {client?.contacts?.[0]
                      ? `${client.contacts[0].name} - ${client.contacts[0].role || "Contact"}`
                      : (client?.contact_person || "Select receiver")}
                  </option>
                  {client?.contacts?.slice(1).map(c => (
                    <option key={c.id || c.name} value={c.name}>{c.name} - {c.role || "Contact"}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="text-[10px] font-bold text-gray-500 mb-1.5">When</div>
                <select className="w-full px-3 py-1.5 text-[11px] font-medium text-gray-700 border border-gray-200 rounded-full outline-none focus:border-indigo-500 bg-white transition shadow-2xs" value={s.sampleWhen || "Office hours"} onChange={e => set({ sampleWhen: e.target.value })}>
                  <option value="Office hours">Office hours</option>
                  <option value="Anytime">Anytime</option>
                  <option value="Morning only">Morning only</option>
                </select>
              </div>
            </div>
          )}

          {/* Delivery & Logistics Charges Lifecycle */}
          <DeliveryChargesBlock
            s={s}
            set={set}
            client={client}
            ids={ids}
            isS={isS}
            activeSampleAddr={activeSampleAddr}
            activeFinalAddr={activeFinalAddr}
            onOpenPreview={() => set({ isPreviewingDeliveryCharges: true })}
          />

          <div className="grid grid-cols-[90px_1fr] gap-3 items-center py-4 border-t border-gray-100">
            <div className="text-[10px] font-bold text-gray-500">Notes</div>
            <input type="text" className="w-full px-4 py-1.5 text-[11px] font-medium text-gray-700 border border-gray-200 rounded-full outline-none focus:border-indigo-500 transition shadow-2xs" placeholder="e.g. Call 30 minutes before; reception, 8th floor" value={s.sampleNotes || s.delivNotes || ""} onChange={e => set({ sampleNotes: e.target.value, delivNotes: e.target.value })} />
          </div>

          <div className="py-4 border-t border-gray-100">
            <div className="text-[10px] font-bold text-gray-500 mb-2 flex items-center gap-2">
              Anything new for the team? <span className="font-normal text-[9px] text-gray-400">(optional · the enquiry brief is already attached)</span>
            </div>
            <textarea className="w-full px-4 py-2 text-[11px] font-medium text-gray-700 border border-gray-200 rounded-xl outline-none focus:border-indigo-500 transition min-h-[60px] shadow-2xs" placeholder="e.g. Winner names will come by Friday" value={s.sampleBrief || s.remarks || ""} onChange={e => set({ sampleBrief: e.target.value, remarks: e.target.value })}></textarea>
          </div>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="pt-3 border-t space-y-2">
        {Boolean(!isS && (isJobDeliveryAfterNeededBy || s.jobDeliveryDateError)) && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800 flex items-center gap-2">
            <span>⚠️</span>
            <span>{s.jobDeliveryDateError || `Job delivery date must be on or before the needed by date (${fmt(neededByDate)}).`}</span>
          </div>
        )}

        <div className="actions flex justify-between items-center">
          <button
            type="button"
            className="btn ghost text-xs text-gray-600 hover:bg-gray-100 px-3 py-2 rounded cursor-pointer"
            onClick={() => set({ step: s.step - 1 })}
          >
            ← Back
          </button>
          <button
            type="button"
            className={`btn gold px-6 py-2.5 text-xs font-bold rounded-lg transition shadow-xs ${isReviewDisabled
                ? "bg-gray-200 text-gray-400 cursor-not-allowed opacity-60 border border-gray-300"
                : "bg-amber-500 hover:bg-amber-600 text-white cursor-pointer"
              }`}
            disabled={isReviewDisabled}
            onClick={() => {
              if (isReviewDisabled) return;
              const ch = s.charge || "foc";
              const effLeadDate = s.leadDate || effectiveLeadDate;
              const effLead = s.lead || workDaysTo(effLeadDate);
              const targetSampleRate = ch === "foc"
                ? 0
                : Number((s.sampleRateManual !== undefined && Number(s.sampleRateManual) > 0) ? s.sampleRateManual : (displaySampleRate || s.sampleRate || 0));

              const oldCostingSum = costingLines.reduce((acc, l) => acc + (Number(l.sampleRate) || 0), 0);
              const syncedCostingLines = costingLines.map((l) => {
                let r = Number((l.sampleRate !== undefined && Number(l.sampleRate) > 0) ? l.sampleRate : (l.quotationSampleRate || 0));
                if (ch === "foc") {
                  r = 0;
                } else if (targetSampleRate > 0 && Math.abs(oldCostingSum - targetSampleRate) > 0.05) {
                  r = costingLines.length === 1
                    ? targetSampleRate
                    : (oldCostingSum > 0 ? Number(((r / oldCostingSum) * targetSampleRate).toFixed(2)) : Number((targetSampleRate / costingLines.length).toFixed(2)));
                }
                return {
                  ...l,
                  sampleRate: ch === "foc" ? 0 : r,
                  quotationSampleRate: l.quotationSampleRate || r,
                };
              });

              set({
                charge: ch,
                sampleRate: targetSampleRate,
                sampleRateManual: targetSampleRate,
                sampleQty: s.sampleQty || 1,
                sampleGst: s.sampleGst !== undefined ? s.sampleGst : 18,
                sampleGstIncl: s.sampleGstIncl !== undefined ? s.sampleGstIncl : false,
                costing: {
                  ...(s.costing || {}),
                  lines: syncedCostingLines,
                },
                sub_jobs: (Array.isArray(s.sub_jobs) && s.sub_jobs.length > 0)
                  ? s.sub_jobs.map((sj, idx) => {
                    const matchedLine = syncedCostingLines.find(
                      (l) => l.subJobNo === sj.sub_job_no || l.id === sj.id || l.name === sj.theme
                    ) || syncedCostingLines[idx];
                    return {
                      ...sj,
                      sample_rate: matchedLine?.sampleRate !== undefined ? matchedLine.sampleRate : (ch === "foc" ? 0 : targetSampleRate)
                    };
                  })
                  : s.sub_jobs,
                leadDate: effLeadDate,
                lead: effLead,
                dmode: s.delivCarrier || s.sampleCarrier || s.dmode || "Our vehicle",
                sampleCarrier: s.sampleCarrier || s.delivCarrier || "Our vehicle",
                delivCarrier: s.delivCarrier || s.sampleCarrier || "Our vehicle",
                sampleWhen: isPhotoVideoCarrier ? "Digital" : (s.sampleWhen || "Office hours"),
                sampleReceiver: isPhotoVideoCarrier ? "Digital (Photos & Video)" : (s.sampleReceiver || client?.contacts?.[0]?.name || client?.contact_person || ""),
                sampleShipTo: isPhotoVideoCarrier ? "Digital Review" : (s.sampleShipTo || ""),
              });
              next();
            }}
          >
            Review ticket
          </button>
        </div>
      </div>

      {s.isPreviewingDeliveryCharges && (
        <PreviewDeliveryChargesSheet
          s={s}
          client={client}
          ids={ids}
          onClose={() => set({ isPreviewingDeliveryCharges: false })}
          onSend={(channel) => {
            const sentChannel = typeof channel === 'string' ? channel : 'WhatsApp';
            set({
              sampleChargesState: 'awaiting_approval',
              sampleChargesSentVia: sentChannel,
              isPreviewingDeliveryCharges: false
            });
          }}
        />
      )}
    </div>
  );
};

export default DetailsStep;
