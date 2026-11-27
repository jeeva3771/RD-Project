import React from "react";
import { contactsOf, roundOf, subJobsOf, getProductDesignImage, formatEnquiryNo, ENQUIRY_CONFIG, formatAddress } from "../../utils/helpers";
import SendDocumentOverlay from "../common/SendDocumentOverlay";

const PreviewSampleConfirmationSheet = ({ s = {}, e = {}, client = {}, item, items, job = {}, ids = {}, onClose, onSend }) => {
  const ct = contactsOf(client, s).find((x) => x.id === s.contactId);
  const contactName = ct?.name || client?.contact || client?.name || "Vikas Rao";
  const contactRole = ct?.role ? `(${ct.role})` : "(Sales ops)";
  const phone = ct?.mobile || client?.mobile || "+919820055123";
  const email = ct?.email || client?.email || "vikas.rao@meridianpharma.example";

  // Job number & Sub-job number format as planned in flow: RD21001 and RD21001-A1
  const rawParent = s?.seq ? formatEnquiryNo(s.seq) : (ids?.enq || ids?.s || ENQUIRY_CONFIG.DEFAULT_ENQUIRY_NO);
  const cleanParentDigits = rawParent.replace(/\D/g, "");
  const parentJobNo = rawParent.startsWith("RD")
    ? rawParent
    : (cleanParentDigits ? `RD${cleanParentDigits}` : (rawParent.startsWith("ENQ") ? rawParent.replace("ENQ/26/", "RD") : `RD${rawParent}`));

  const formatSubJobNo = (code, idx = 0) => {
    if (!code) return `${parentJobNo}-A${idx + 1}`;
    let str = String(code).trim();
    if (str.startsWith("RD")) return str;
    if (/^\d/.test(str)) return `RD${str}`;
    if (str.startsWith("-")) return `${parentJobNo}${str}`;
    return `RD${str}`;
  };

  // Compute all subjobs/items
  const computedSubJobs = subJobsOf(s, parentJobNo);
  const rawItems = (items && items.length > 0)
    ? items
    : (computedSubJobs.length > 0
      ? computedSubJobs
      : (item ? [item] : (e?.products || job?.items || [])));

  const allTrophies = rawItems.length > 0
    ? rawItems.map((it, idx) => {
      const subCode = formatSubJobNo(it.subJobNo, idx);
      const theme = it.theme || it.product || it.name || s?.e?.theme || "Custom Trophy";
      const type = it.type || s?.e?.type || "Plaque";
      const rawSize = it.size || s?.e?.size || 11;
      const sizeStr = String(rawSize).includes("in") ? rawSize : `${rawSize} in`;
      const mat = it.mat || it.material || s?.e?.mat || "Fusion: Crystal + MDF";
      const description = `${theme} · ${type} · ${sizeStr} · ${mat}`;
      // In sample order confirmation, pieces is the sample quantity (per set), not bulk order quantity
      const pcs = it.sampleQty || s?.sampleQty || 1;

      // Resolve individual sample rate for this sub-job
      const matchedCostingLine = (s.costing?.lines || []).find(
        (l) => l.subJobNo === subCode || l.id === it.id || l.name?.toLowerCase() === theme?.toLowerCase()
      ) || (s.costing?.lines || [])[idx];

      const simRate = s.simulatedRates?.[it.id]?.sample || s.simulatedRates?.[subCode]?.sample || s.simulatedRates?.[`${idx}-0`]?.sample || s.simulatedRates?.[idx]?.sample;

      const sj = (s.sub_jobs || job?.sub_jobs || s.rawJob?.sub_jobs || []).find(
        (x) => x.sub_job_no === subCode || x.sub_job_no?.endsWith(subCode?.split('-').slice(1).join('-'))
      );

      let itemRate = 0;
      if (matchedCostingLine?.sampleRate !== undefined && Number(matchedCostingLine.sampleRate) > 0) {
        itemRate = Number(matchedCostingLine.sampleRate);
      } else if (simRate !== undefined && Number(simRate) > 0) {
        itemRate = Number(simRate);
      } else if (it.sampleRate !== undefined && Number(it.sampleRate) > 0) {
        itemRate = Number(it.sampleRate);
      } else if (it.sample_rate !== undefined && Number(it.sample_rate) > 0) {
        itemRate = Number(it.sample_rate);
      } else if (sj?.sample_rate !== undefined && Number(sj.sample_rate) > 0) {
        itemRate = Number(sj.sample_rate);
      } else if (sj?.unit_rate !== undefined && Number(sj.unit_rate) > 0) {
        itemRate = Number(sj.unit_rate) + 200;
      } else if (sj?.target_rate !== undefined && Number(sj.target_rate) > 0) {
        itemRate = Number(sj.target_rate) + 200;
      } else if (it.unitRate !== undefined && Number(it.unitRate) > 0) {
        itemRate = Number(it.unitRate) + 200;
      } else if (it.unit_rate !== undefined && Number(it.unit_rate) > 0) {
        itemRate = Number(it.unit_rate) + 200;
      } else if (it.rate !== undefined && Number(it.rate) > 0) {
        itemRate = Number(it.rate) + 200;
      }

      return {
        ...it,
        subJobNo: subCode,
        theme,
        type,
        sizeStr,
        mat,
        description,
        pieces: pcs,
        rawItemRate: itemRate
      };
    })
    : [{
      subJobNo: formatSubJobNo(s?.e?.subJobNo, 0),
      theme: s?.e?.theme || "Custom Trophy",
      type: s?.e?.type || "Plaque",
      sizeStr: `${s?.e?.size || 11} in`,
      mat: s?.e?.mat || "Fusion: Crystal + MDF",
      description: `${s?.e?.theme || "Custom Trophy"} · ${s?.e?.type || "Plaque"} · ${s?.e?.size || 11} in · ${s?.e?.mat || "Fusion: Crystal + MDF"}`,
      pieces: s?.sampleQty || 1,
      rawItemRate: Number(s?.sampleRate || 0)
    }];

  // Rate distribution based on user input sample rate and costing lines
  const isFocMode = (s?.charge || "foc") === "foc";
  const targetTotal = isFocMode
    ? 0
    : Number(s?.sampleRateManual !== undefined ? s.sampleRateManual : (s?.sampleRate || 0));

  const totalKnownRate = allTrophies.reduce((sum, t) => sum + (t.rawItemRate || 0), 0);
  const unassignedCount = allTrophies.filter((t) => !t.rawItemRate).length;

  const finalizedTrophies = allTrophies.map((t) => {
    let finalRate = t.rawItemRate;
    if (isFocMode) {
      finalRate = 0;
    } else if (targetTotal > 0 && totalKnownRate > 0 && Math.abs(totalKnownRate - targetTotal) > 0.05) {
      finalRate = allTrophies.length === 1
        ? targetTotal
        : Number(((t.rawItemRate / totalKnownRate) * targetTotal).toFixed(2));
    } else if (targetTotal > 0 && totalKnownRate === 0) {
      finalRate = Number((targetTotal / allTrophies.length).toFixed(2));
    } else if (!finalRate && unassignedCount > 0 && targetTotal > 0) {
      finalRate = Number((targetTotal / unassignedCount).toFixed(2));
    } else if (!finalRate && allTrophies.length === 1 && targetTotal > 0) {
      finalRate = targetTotal;
    }
    return {
      ...t,
      sampleRate: isFocMode ? 0 : (finalRate || 0)
    };
  });

  const subJobCode = finalizedTrophies[0]?.subJobNo || formatSubJobNo(s?.e?.subJobNo, 0);

  const todayStr = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  // Sample delivery date formatting (e.g. Tue, 13 Oct)
  const deliveryDateObj = s.leadDate ? new Date(s.leadDate) : new Date();
  const sampleDeliveryDate = deliveryDateObj.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short"
  });

  const carrierName = s.sampleCarrier || "Our vehicle";

  // Sample round info
  const roundInfo = roundOf(s);
  const currentV = roundInfo.v || (s?.rounds?.length ? s.rounds.length + 1 : 1);

  // Determine whether sample is Free of Cost (foc) or Chargeable
  const isFoc = (s?.charge || "foc") === "foc" || (!s?.sampleRate && totalKnownRate === 0);
  const gstRate = s?.sampleGst !== undefined ? Number(s.sampleGst) : 18;
  const isGstIncl = s?.sampleGstIncl === true;

  // Format per-item charge without individual GST (overall GST is displayed in its own separate summary row)
  const formatItemCharge = (trophy) => {
    if (isFoc) {
      return "Free of cost";
    }
    const qty = trophy.pieces || 1;
    const rate = Number(trophy.sampleRate || 0);
    const totalBase = rate * qty;
    let taxableVal = totalBase;

    if (isGstIncl) {
      taxableVal = Math.round(totalBase / (1 + gstRate / 100));
    }

    const chargeLabel = s?.charge === "adjust" ? "Charge (PO) ·" : "Chargeable ·";
    return `${chargeLabel} ₹${taxableVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Grand totals across all sub-jobs for footer and share overlay
  let grandTaxable = 0;
  let grandGst = 0;
  let grandTotal = 0;
  let totalPieces = 0;

  finalizedTrophies.forEach((t) => {
    const qty = t.pieces || 1;
    const rate = Number(t.sampleRate || 0);
    const totalBase = rate * qty;
    totalPieces += qty;
    if (!isFoc) {
      let taxVal = totalBase;
      let gVal = Math.round(taxVal * (gstRate / 100));
      let iTot = taxVal + gVal;
      if (isGstIncl) {
        iTot = totalBase;
        taxVal = Math.round(totalBase / (1 + gstRate / 100));
        gVal = iTot - taxVal;
      }
      grandTaxable += taxVal;
      grandGst += gVal;
      grandTotal += iTot;
    }
  });

  // Delivery address / venue
  const isPhotoVideoCarrier = Boolean(
    s.sampleCarrier === "Photos / video only" ||
    /photo.*video|video.*photo|photos \/ video/i.test(s.sampleCarrier || "")
  );
  const selectedSampleAddr = s.sampleAddress;
  const deliveryAddress = isPhotoVideoCarrier
    ? "Digital Review (Photos & 360° Video via WhatsApp / Email)"
    : s.isAddingNewAddress
    ? (s.newAddrName || "New Address")
    : selectedSampleAddr
    ? (selectedSampleAddr.address
        ? `${selectedSampleAddr.label ? selectedSampleAddr.label + ' - ' : ''}${selectedSampleAddr.address}${selectedSampleAddr.city ? ', ' + selectedSampleAddr.city : ''}${selectedSampleAddr.pin ? ' - ' + selectedSampleAddr.pin : ''}`
        : (selectedSampleAddr.label || s.sampleShipTo || s.shipTo))
    : (s.sampleShipTo || s.shipTo || (client?.shipTos?.[0]?.label ? `${client.shipTos[0].label}${client.shipTos[0].address ? ' - ' + client.shipTos[0].address : ''}` : (formatAddress(client?.address) || (client?.name ? `${client.name} Office` : "Client Address"))));

  return (
    <SendDocumentOverlay
      s={s}
      client={client}
      docType="sample"
      subJobNos={finalizedTrophies.map((t) => t.subJobNo)}
      selectedItems={finalizedTrophies}
      totalAmount={grandTotal}
      onClose={onClose}
      onSend={(channel) => onSend && onSend(channel)}
    >
      {/* Document Sheet matching Screenshot */}
      <div className="w-full max-w-4xl mx-auto bg-white shadow-2xl p-8 sm:p-12 rounded-2xl mb-8 relative z-10 print-content text-left border border-gray-100">
        {/* Header: Job Number on top, Sub-job below, matching requirement */}
        <div className="flex justify-between items-start border-b-2 border-indigo-600 pb-4 mb-8">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">
              RD Custom Awards Pvt. Ltd.
            </h1>
            <p className="text-xs text-gray-500 mt-1 font-medium">
              Sample order confirmation
            </p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-black text-indigo-700 tracking-tight">
              {parentJobNo}
            </h2>
            <p className="text-[11px] font-bold text-gray-500 mt-0.5">
              {finalizedTrophies.length > 1
                ? `Sub-jobs: ${finalizedTrophies.map((t) => t.subJobNo).join(", ")}`
                : `Sub-job: ${finalizedTrophies[0]?.subJobNo || subJobCode}`}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{todayStr}</p>
          </div>
        </div>

        {/* Bill to / Attention / Sample to / By Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-6 text-xs mb-10">
          <div className="grid grid-cols-[80px_1fr] items-start">
            <span className="text-gray-400 font-medium">Bill to</span>
            <div className="text-gray-900 font-medium leading-relaxed">
              <span className="font-bold text-gray-900 block">{client?.name || "Meridian Pharma Pvt Ltd"}</span>
              <span className="text-gray-600 block whitespace-pre-line">
                {formatAddress(client?.billing) || formatAddress(client?.address) || "Plot 14, MIDC, Andheri East,\nMumbai 400093"}
              </span>
              <span className="text-gray-600 block mt-0.5">
                GSTIN {typeof client?.gstin === "object" ? (client.gstin?.gst_no || "") : (client?.gstin || "27AADCM5561H1Z6")}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-[80px_1fr] items-start">
            <span className="text-gray-400 font-medium">Attention</span>
            <div className="text-gray-900 font-medium leading-relaxed">
              <span className="font-bold text-gray-900 block">{contactName} {contactRole}</span>
              <span className="text-gray-600 block">{email}</span>
              <span className="text-gray-600 block">{phone}</span>
            </div>
          </div>

          <div className="grid grid-cols-[80px_1fr] items-start">
            <span className="text-gray-400 font-medium">Sample to</span>
            <div className="text-gray-900 font-medium leading-relaxed">
              {deliveryAddress}
            </div>
          </div>

          <div className="grid grid-cols-[80px_1fr] items-start">
            <span className="text-gray-400 font-medium">By</span>
            <div className="text-gray-900 font-medium leading-relaxed">
              {sampleDeliveryDate} · {carrierName}
            </div>
          </div>
        </div>

        {/* Current Sample Round Details */}
        <div className="flex justify-between items-baseline mb-3">
          <h3 className="text-sm font-extrabold text-gray-900">
            Sample v{currentV} {finalizedTrophies.length > 1 ? `(${finalizedTrophies.length} items / sub-jobs)` : ""}
          </h3>
        </div>

        <div className="border-t border-gray-200 mb-8 overflow-hidden rounded-lg">
          {finalizedTrophies.length === 1 ? (() => {
            const singleImg = getProductDesignImage(s, e, finalizedTrophies[0], 0);
            return (
              <table className="w-full text-xs text-left">
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-3.5 text-gray-400 font-medium w-32 align-top">Sub-job No</td>
                    <td className="py-3.5 font-bold text-indigo-700">{finalizedTrophies[0].subJobNo}</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-3.5 text-gray-400 font-medium w-32 align-top">Item</td>
                    <td className="py-3.5 text-gray-900 font-medium">
                      <div className="flex items-start gap-3">
                        {singleImg ? (
                          <div
                            className="w-16 h-16 rounded-xl border border-gray-200 overflow-hidden bg-white shrink-0 p-1 shadow-2xs print:border print:border-gray-300"
                            style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
                          >
                            <img
                              src={singleImg}
                              alt={finalizedTrophies[0].theme}
                              className="w-full h-full object-cover rounded-lg"
                              style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
                            />
                          </div>
                        ) : null}
                        <div>
                          <div className="font-bold text-gray-900 text-sm mb-0.5">{finalizedTrophies[0].theme}</div>
                          <div className="text-[11px] text-gray-500">{finalizedTrophies[0].description}</div>
                        </div>
                      </div>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-3.5 text-gray-400 font-medium w-32">Pieces</td>
                    <td className="py-3.5 text-gray-900 font-medium">{finalizedTrophies[0].pieces}</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-3.5 text-gray-400 font-medium w-32">Rate (taxable)</td>
                    <td className="py-3.5 text-gray-900 font-medium">
                      {isFoc ? (
                        <span className="text-emerald-700 font-semibold">Free of cost</span>
                      ) : (
                        <span>
                          <span className="text-gray-400 text-[11px] mr-1">{s?.charge === "adjust" ? "Charge (PO) ·" : "Chargeable ·"}</span>
                          <span className="font-bold text-gray-900">
                            ₹{grandTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </span>
                      )}
                    </td>
                  </tr>
                  {!isFoc && (
                    <>
                      <tr className="border-b border-gray-100">
                        <td className="py-3.5 text-gray-400 font-medium w-32">GST @ {gstRate}%</td>
                        <td className="py-3.5 text-gray-900 font-medium">
                          ₹{grandGst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                      <tr className="border-b border-gray-100 bg-indigo-50/30">
                        <td className="py-3.5 text-indigo-950 font-bold w-32">Total Charge</td>
                        <td className="py-3.5 text-indigo-950 font-black text-sm">
                          ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            );
          })() : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-200 text-gray-500 font-semibold bg-gray-50/70">
                    <th className="py-3 px-3 w-32">Sub-job No</th>
                    <th className="py-3 px-3">Item</th>
                    <th className="py-3 px-3 w-20 text-center">Pieces</th>
                    <th className="py-3 px-3 w-44 text-right">Rate (taxable)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {finalizedTrophies.map((trophy, idx) => {
                    const trophyImg = getProductDesignImage(s, e, trophy, idx);
                    return (
                      <tr key={trophy.subJobNo || idx} className="hover:bg-gray-50/50 transition">
                        <td className="py-3.5 px-3 font-bold text-indigo-700 align-top whitespace-nowrap">
                          {trophy.subJobNo}
                        </td>
                        <td className="py-3.5 px-3 font-medium text-gray-900 align-top">
                          <div className="flex items-start gap-3">
                            {trophyImg ? (
                              <div
                                className="w-12 h-12 rounded-lg border border-gray-200 overflow-hidden bg-white shrink-0 p-0.5 shadow-2xs print:border print:border-gray-300"
                                style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
                              >
                                <img
                                  src={trophyImg}
                                  alt={trophy.theme}
                                  className="w-full h-full object-cover rounded"
                                  style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
                                />
                              </div>
                            ) : null}
                            <div>
                              <div className="font-bold text-gray-900">{trophy.theme}</div>
                              <div className="text-[10px] text-gray-500">{trophy.description}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 font-medium text-gray-900 align-top text-center">
                          {trophy.pieces}
                        </td>
                        <td className="py-3.5 px-3 font-medium text-gray-900 align-top text-right whitespace-nowrap">
                          {formatItemCharge(trophy)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {finalizedTrophies.length > 1 && (
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 text-gray-700 bg-gray-50/70 font-semibold">
                      <td colSpan={2} className="py-2.5 px-3 text-right text-gray-600 font-medium">
                        Subtotal (taxable):
                      </td>
                      <td className="py-2.5 px-3 text-center text-gray-900 font-bold">
                        {totalPieces}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-gray-900 whitespace-nowrap">
                        {isFoc
                          ? "Free of cost (₹0)"
                          : `₹${grandTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      </td>
                    </tr>
                    {!isFoc && (
                      <>
                        <tr className="border-t border-gray-100 text-gray-700 bg-gray-50/70">
                          <td colSpan={3} className="py-2.5 px-3 text-right text-gray-600 font-medium">
                            GST @ {gstRate}%:
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-gray-900 whitespace-nowrap">
                            ₹{grandGst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                        <tr className="border-t-2 border-gray-300 font-black bg-indigo-50/50 text-indigo-950">
                          <td colSpan={3} className="py-3 px-3 text-right text-xs uppercase tracking-wider text-indigo-950 font-black">
                            Total Sample Order ({finalizedTrophies.length} items · {totalPieces} pcs):
                          </td>
                          <td className="py-3 px-3 text-right text-sm font-black text-indigo-950 whitespace-nowrap">
                            ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </>
                    )}
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>

        {/* Sample history and changes Section matching Screenshot */}
        <div className="mb-8">
          <h3 className="text-sm font-extrabold text-gray-900 mb-3">
            Sample history and changes
          </h3>
          <div className="border-t border-gray-200">
            <table className="w-full text-xs text-left">
              <tbody>
                {s?.rounds && s.rounds.length > 0 ? (
                  s.rounds.map((rnd, i) => {
                    const rNum = rnd.v || i + 1;
                    const changesList = rnd.changes || [];
                    const changesText = changesList.join(", ");
                    return (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-3 text-gray-400 font-medium w-32 align-top">
                          Sample v{rNum}
                        </td>
                        <td className="py-3 text-gray-900 font-medium">
                          {changesList.length > 0 && (
                            <strong className="font-bold text-gray-900">
                              Changes requested:{" "}
                            </strong>
                          )}
                          {changesText ? `${changesText}. ` : ""}
                          {rnd.note || ""}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr className="border-b border-gray-100">
                    <td className="py-3 text-gray-400 font-medium w-32 align-top">
                      Sample v1
                    </td>
                    <td className="py-3 text-gray-900 font-medium">
                      Initial sample run.
                    </td>
                  </tr>
                )}
                {s?.rounds && s.rounds.length > 0 && (
                  <tr className="border-b border-gray-100">
                    <td className="py-3 text-gray-400 font-medium w-32 align-top">
                      Sample v{currentV}
                    </td>
                    <td className="py-3 text-gray-900 font-medium">
                      Being made with the changes above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Message Box matching Screenshot */}
        <div className="w-full border border-indigo-100 bg-[#f8f9ff] rounded-xl p-3.5 text-xs text-gray-700 font-medium mb-12">
          Please check the details and reply within 24 hours if anything needs to change.
        </div>

        {/* Signatures & Footer */}
        <div className="print-break-inside-avoid print:pt-4">
          <div className="flex justify-between items-end pt-6 mb-8 text-[11px] text-gray-500">
            <div className="border-t border-gray-300 pt-2 w-48 font-medium">
              For RD Custom Awards Pvt. Ltd.
            </div>
            <div className="border-t border-gray-300 pt-2 w-48 text-center font-medium">
              Coordinator
            </div>
            <div className="border-t border-gray-300 pt-2 w-48 text-right font-medium">
              Client acceptance
            </div>
          </div>

          {/* Footer info matching Screenshot */}
          <div className="text-center text-[10px] text-gray-400 mt-10 print:mt-4 font-medium">
            {finalizedTrophies.map((t) => t.subJobNo).join(", ")} · Job reference since enquiry {ids?.enq || s?.enqNo || "ENQ/26/0415"}
          </div>
        </div>
      </div>
    </SendDocumentOverlay>
  );
};

export default PreviewSampleConfirmationSheet;
