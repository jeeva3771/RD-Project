import React from "react";
import { contactsOf, roundOf, subJobsOf, getProductDesignImage } from "../../utils/helpers";
import SendDocumentOverlay from "../common/SendDocumentOverlay";

const PreviewSampleConfirmationSheet = ({ s = {}, e = {}, client = {}, item, items, job = {}, ids = {}, onClose, onSend }) => {
  const ct = contactsOf(client, s).find((x) => x.id === s.contactId);
  const contactName = ct?.name || client?.contact || client?.name || "Vikas Rao";
  const contactRole = ct?.role ? `(${ct.role})` : "(Sales ops)";
  const phone = ct?.mobile || client?.mobile || "+919820055123";
  const email = ct?.email || client?.email || "vikas.rao@meridianpharma.example";

  // Job number & Sub-job number format as planned in flow: RD21071 and RD21071-A1
  const parentJobNo = s?.seq
    ? String(s.seq).startsWith("RD")
      ? s.seq
      : `RD${s.seq}`
    : (ids?.enq?.startsWith("RD")
      ? ids.enq
      : ids?.enq?.replace("ENQ/26/", "RD")) || (ids?.s?.replace("RD/S/26/", "RD")) || "RD21071";

  // Compute all subjobs/items
  const computedSubJobs = subJobsOf(s, parentJobNo);
  const rawItems = (items && items.length > 0)
    ? items
    : (computedSubJobs.length > 0
      ? computedSubJobs
      : (item ? [item] : (e?.products || job?.items || [])));

  const allTrophies = rawItems.length > 0
    ? rawItems.map((it, idx) => {
      const subCode = it.subJobNo || (parentJobNo.includes("-") ? parentJobNo : `${parentJobNo}-A${idx + 1}`);
      const theme = it.theme || it.product || it.name || s?.e?.theme || "Custom Trophy";
      const type = it.type || s?.e?.type || "Plaque";
      const rawSize = it.size || s?.e?.size || 11;
      const sizeStr = String(rawSize).includes("in") ? rawSize : `${rawSize} in`;
      const mat = it.mat || it.material || s?.e?.mat || "Fusion: Crystal + MDF";
      const description = `${theme} · ${type} · ${sizeStr} · ${mat}`;
      const pcs = it.sampleQty || s?.sampleQty || it.qty || 1;
      return {
        ...it,
        subJobNo: subCode,
        theme,
        type,
        sizeStr,
        mat,
        description,
        pieces: pcs
      };
    })
    : [{
      subJobNo: s?.e?.subJobNo || (parentJobNo.includes("-") ? parentJobNo : `${parentJobNo}-A1`),
      theme: s?.e?.theme || "Custom Trophy",
      type: s?.e?.type || "Plaque",
      sizeStr: `${s?.e?.size || 11} in`,
      mat: s?.e?.mat || "Fusion: Crystal + MDF",
      description: `${s?.e?.theme || "Custom Trophy"} · ${s?.e?.type || "Plaque"} · ${s?.e?.size || 11} in · ${s?.e?.mat || "Fusion: Crystal + MDF"}`,
      pieces: s?.sampleQty || 1
    }];

  const subJobCode = allTrophies[0]?.subJobNo || s?.e?.subJobNo || `${parentJobNo}-A1`;

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

  // Calculate charge string matching format in screenshot:
  // e.g. "Chargeable · taxable ₹6,648 + GST @ 5% ₹332 = ₹6,980" or "Free of cost"
  let chargeStr = "Free of cost";
  const isFoc = (s?.charge || "foc") === "foc" || !s?.sampleRate || Number(s?.sampleRate) === 0;
  if (!isFoc) {
    const qty = s?.sampleQty || 1;
    const rate = s?.sampleRate || 6980;
    const gstRate = s?.sampleGst !== undefined ? s.sampleGst : 18;
    const isGstIncl = s?.sampleGstIncl === true;
    const totalBase = rate * qty;
    let taxableVal = totalBase;
    let gstVal = Math.round(taxableVal * (gstRate / 100));
    let invTotal = taxableVal + gstVal;

    if (isGstIncl) {
      invTotal = totalBase;
      taxableVal = Math.round(totalBase / (1 + gstRate / 100));
      gstVal = invTotal - taxableVal;
    }

    chargeStr = `Chargeable · taxable ₹${taxableVal.toLocaleString('en-IN')} + GST @ ${gstRate}% ₹${gstVal.toLocaleString('en-IN')} = ₹${invTotal.toLocaleString('en-IN')}`;
  }

  // Delivery address / venue
  const deliveryAddress = s.isAddingNewAddress
    ? (s.newAddrName || "New Address")
    : (client?.shipTos?.[0]?.label || client?.address || "Lonavala offsite venue");

  return (
    <SendDocumentOverlay
      s={s}
      client={client}
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
              {allTrophies.length > 1
                ? `Sub-jobs: ${allTrophies.map((t) => t.subJobNo).join(", ")}`
                : `Sub-job: ${allTrophies[0]?.subJobNo || subJobCode}`}
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
                {client?.billing || client?.address || "Plot 14, MIDC, Andheri East,\nMumbai 400093"}
              </span>
              <span className="text-gray-600 block mt-0.5">
                GSTIN {client?.gstin || "27AADCM5561H1Z6"}
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
            Sample v{currentV} {allTrophies.length > 1 ? `(${allTrophies.length} items / sub-jobs)` : ""}
          </h3>
        </div>

        <div className="border-t border-gray-200 mb-8 overflow-hidden rounded-lg">
          {allTrophies.length === 1 ? (() => {
            const singleImg = getProductDesignImage(s, e, allTrophies[0], 0);
            return (
              <table className="w-full text-xs text-left">
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-3.5 text-gray-400 font-medium w-32 align-top">Sub-job No</td>
                    <td className="py-3.5 font-bold text-indigo-700">{allTrophies[0].subJobNo}</td>
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
                              alt={allTrophies[0].theme}
                              className="w-full h-full object-cover rounded-lg"
                              style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
                            />
                          </div>
                        ) : null}
                        <div>
                          <div className="font-bold text-gray-900 text-sm mb-0.5">{allTrophies[0].theme}</div>
                          <div className="text-[11px] text-gray-500">{allTrophies[0].description}</div>
                        </div>
                      </div>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-3.5 text-gray-400 font-medium w-32">Pieces</td>
                    <td className="py-3.5 text-gray-900 font-medium">{allTrophies[0].pieces}</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-3.5 text-gray-400 font-medium w-32">Charge</td>
                    <td className="py-3.5 text-gray-900 font-medium">{chargeStr}</td>
                  </tr>
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
                    <th className="py-3 px-3 w-44 text-right">Charge</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {allTrophies.map((trophy, idx) => {
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
                          {chargeStr}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
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
            {allTrophies.map((t) => t.subJobNo).join(", ")} · Job reference since enquiry {ids?.enq || s?.enqNo || "ENQ/26/0415"}
          </div>
        </div>
      </div>
    </SendDocumentOverlay>
  );
};

export default PreviewSampleConfirmationSheet;
