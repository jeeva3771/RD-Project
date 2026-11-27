import React from "react";
import { contactsOf, fmt, inr, getProductDesignImage } from "../../utils/helpers";
import SendDocumentOverlay from "../common/SendDocumentOverlay";

const PreviewProformaSheet = ({
  s = {},
  client = {},
  job = {},
  ids = {},
  items = [],
  prodGst = 18,
  adjustSampleCharges = false,
  advanceDue = 100000,
  deliveryDate,
  onClose,
  onSend
}) => {
  const ct = contactsOf(client, s).find((x) => x.id === s.contactId);
  const contactName = ct?.name || client?.contact || client?.name || "Vikas Rao";
  const contactRole = ct?.role ? `(${ct.role})` : "(Sales ops)";
  const phone = ct?.mobile || client?.mobile || "+91 9820055123";
  const email = ct?.email || client?.email || "vikas.rao@meridianpharma.example";

  const parentJobNo = s?.seq
    ? String(s.seq).startsWith("RD")
      ? s.seq
      : `RD${s.seq}`
    : (ids?.enq?.startsWith("RD") ? ids.enq : ids?.enq?.replace("ENQ/26/", "RD")) || "RD21072";

  const cleanSeq = String(parentJobNo).replace(/^RD/i, "") || "21072";
  const piNumber = ids?.pi || `PI/26/${cleanSeq}`;
  const enquiryRef = ids?.enq || `ENQ/26/${cleanSeq}`;

  const todayStr = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  const delDateObj = deliveryDate ? new Date(deliveryDate) : new Date("2026-10-24");
  const deliveryFormatted = delDateObj.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short"
  });

  // Calculate totals
  const totalAmountBeforeGst = items.reduce(
    (sum, it) => sum + (Number(it.qty) || 0) * (Number(it.rate) || 0),
    0
  );

  const sampleV1Adjusted = 13960;
  const sampleV2Adjusted = 6648;
  const totalSampleAdjusted = adjustSampleCharges ? sampleV1Adjusted + sampleV2Adjusted : 0;

  const taxableValue = Math.max(0, totalAmountBeforeGst - totalSampleAdjusted);
  const gstRate = prodGst || 18;
  const halfGstRate = gstRate / 2;
  const cgstAmount = Math.round(taxableValue * (halfGstRate / 100));
  const sgstAmount = Math.round(taxableValue * (halfGstRate / 100));
  const totalGst = Math.round(taxableValue * (gstRate / 100));
  const invoiceTotal = taxableValue + totalGst;

  const balanceDue = Math.max(0, invoiceTotal - advanceDue);

  const sampleV1Invoice = 16473;
  const sampleV2Invoice = 6980;
  const totalJobValue = invoiceTotal + (sampleV1Invoice + sampleV2Invoice);

  const poNumber = s.relPo || "BANK";

  return (
    <SendDocumentOverlay
      s={s}
      client={client}
      onClose={onClose}
      onSend={onSend}
      docType="pi"
      subJobNos={items.map((it) => it.subJobNo || it.name).filter(Boolean)}
      totalAmount={invoiceTotal}
    >
      <div className="w-full max-w-4xl mx-auto bg-white border border-gray-200/90 shadow-2xl rounded-2xl p-8 sm:p-12 mb-8 relative z-10 print-content text-left">
        {/* Header with application standard Job number, Sub-jobs, and PI format */}
        <div className="flex justify-between items-start border-b border-indigo-600/30 pb-4 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
              RD Custom Awards Pvt. Ltd.
            </h1>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">
              Quotation & proforma invoice
            </p>
          </div>
          <div className="text-right">
            <h2 className="text-xl sm:text-2xl font-black text-indigo-700 tracking-tight">
              {parentJobNo}
            </h2>
            <div className="text-xs font-bold text-indigo-900 mt-0.5">
              {piNumber}
            </div>
            <p className="text-[11px] font-bold text-gray-500 mt-0.5">
              {items.length > 1
                ? `Sub-jobs: ${items.map((it, idx) => it.subJobNo || `${parentJobNo}-A${idx + 1}`).join(", ")}`
                : `Sub-job: ${items[0]?.subJobNo || `${parentJobNo}-A1`}`}
            </p>
            <p className="text-xs font-semibold text-gray-500 mt-0.5">
              {todayStr} · Your PO: {poNumber}
            </p>
          </div>
        </div>

        {/* 4 Info Blocks */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-4 text-xs mb-8">
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
              Bill to
            </span>
            <div className="text-gray-900 font-medium leading-relaxed">
              <b className="font-bold">{client?.name || "Meridian Pharma Pvt Ltd"}</b>
              <br />
              {client?.billing || "Plot 14, MIDC, Andheri East, Mumbai 400093"}
              <br />
              GSTIN {client?.gstin || "27AADCM6681H1Z0"}
            </div>
          </div>

          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
              Attention
            </span>
            <div className="text-gray-900 font-medium leading-relaxed">
              <b className="font-bold">{contactName} {contactRole}</b>
              <br />
              {email}
              <br />
              {phone}
            </div>
          </div>

          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
              Deliver to
            </span>
            <div className="text-gray-900 font-medium leading-relaxed">
              {s.deliveryVenue || client?.venue || "Lonavala offsite venue"}
            </div>
          </div>

          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
              By
            </span>
            <div className="text-gray-900 font-medium leading-relaxed">
              {deliveryFormatted} · {s.sampleCarrier || "Our vehicle"}
            </div>
          </div>
        </div>

        {/* Quotation & proforma Table */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-gray-900 mb-3">
            Quotation & proforma
          </h3>

          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/60 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  <th className="py-2.5 px-4 font-semibold">DESCRIPTION</th>
                  <th className="py-2.5 px-4 text-right font-semibold">AMOUNT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {items.map((it, idx) => {
                  const subCode = it.subJobNo || `${parentJobNo}-A${idx + 1}`;
                  const itemImg = getProductDesignImage(s, s?.e || {}, it, idx);
                  return (
                    <tr key={it.id || idx}>
                      <td className="py-3 px-4 align-top">
                        <div className="flex items-start gap-3">
                          {itemImg ? (
                            <div
                              className="w-14 h-14 rounded-xl border border-gray-200 overflow-hidden bg-white shrink-0 p-0.5 shadow-2xs print:border print:border-gray-300"
                              style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
                            >
                              <img
                                src={itemImg}
                                alt={it.theme}
                                className="w-full h-full object-cover rounded-lg"
                                style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
                              />
                            </div>
                          ) : null}
                          <div>
                            <div className="font-bold text-gray-900 text-xs">
                              {idx + 1}. {subCode} · {it.theme}
                            </div>
                            <div className="text-[11px] text-gray-500 mt-0.5">
                              {it.desc} · {it.qty} pcs × {inr(it.rate)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right align-top font-bold text-gray-900 whitespace-nowrap">
                        {inr(Number(it.qty) * Number(it.rate))}
                      </td>
                    </tr>
                  );
                })}

                {adjustSampleCharges && (
                  <>
                    <tr className="text-emerald-700 bg-emerald-50/20">
                      <td className="py-2.5 px-4">
                        <span className="font-bold">Less: sample v1 charge adjusted</span>
                        <div className="text-[10px] text-emerald-600">
                          2 pc × ₹6,980 · taxable value
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold whitespace-nowrap">
                        − {inr(sampleV1Adjusted)}
                      </td>
                    </tr>
                    <tr className="text-emerald-700 bg-emerald-50/20">
                      <td className="py-2.5 px-4">
                        <span className="font-bold">Less: sample v2 charge adjusted</span>
                        <div className="text-[10px] text-emerald-600">
                          1 pc × ₹6,980 incl. GST · taxable value
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold whitespace-nowrap">
                        − {inr(sampleV2Adjusted)}
                      </td>
                    </tr>
                  </>
                )}

                <tr className="border-t border-gray-200 font-medium">
                  <td className="py-2 px-4 text-gray-700 font-bold">Taxable value</td>
                  <td className="py-2 px-4 text-right font-bold text-gray-900 whitespace-nowrap">
                    {inr(taxableValue)}
                  </td>
                </tr>

                <tr>
                  <td className="py-1 px-4 text-gray-600">CGST @ {halfGstRate}%</td>
                  <td className="py-1 px-4 text-right text-gray-900 whitespace-nowrap font-medium">
                    {inr(cgstAmount)}
                  </td>
                </tr>

                <tr>
                  <td className="py-1 px-4 text-gray-600">
                    <div>SGST @ {halfGstRate}%</div>
                    <div className="text-[10px] text-gray-400">Place of supply: Maharashtra (27)</div>
                  </td>
                  <td className="py-1 px-4 text-right text-gray-900 whitespace-nowrap font-medium align-top">
                    {inr(sgstAmount)}
                  </td>
                </tr>

                <tr className="border-t-2 border-indigo-100 bg-indigo-50/30">
                  <td className="py-3 px-4 font-black text-sm text-indigo-900">
                    Invoice total
                  </td>
                  <td className="py-3 px-4 text-right font-black text-sm text-indigo-900 whitespace-nowrap">
                    {inr(invoiceTotal)}
                  </td>
                </tr>

                <tr>
                  <td className="py-2 px-4">
                    <span className="font-bold text-gray-800">Advance due now</span>
                    <div className="text-[10px] text-gray-400">Amount agreed with the client</div>
                  </td>
                  <td className="py-2 px-4 text-right font-bold text-gray-900 whitespace-nowrap">
                    {inr(advanceDue)}
                  </td>
                </tr>

                <tr className="border-t border-gray-100">
                  <td className="py-2 px-4 font-bold text-gray-800">
                    Balance due before dispatch
                  </td>
                  <td className="py-2 px-4 text-right font-bold text-gray-900 whitespace-nowrap">
                    {inr(balanceDue)}
                  </td>
                </tr>

                {/* BILLED SEPARATELY */}
                <tr className="bg-gray-50/70 border-t border-gray-200">
                  <td colSpan={2} className="py-1.5 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    BILLED SEPARATELY
                  </td>
                </tr>

                <tr>
                  <td className="py-2 px-4">
                    <span className="font-semibold text-gray-800">Sample v1 invoice</span>
                    <div className="text-[10px] text-gray-400">
                      2 pc × ₹6,980 + 18% GST {adjustSampleCharges && "· taxable value adjusted above"}
                    </div>
                  </td>
                  <td className="py-2 px-4 text-right font-medium text-gray-800 whitespace-nowrap">
                    {inr(sampleV1Invoice)}
                  </td>
                </tr>

                <tr>
                  <td className="py-2 px-4">
                    <span className="font-semibold text-gray-800">Sample v2 invoice</span>
                    <div className="text-[10px] text-gray-400">
                      1 pc × ₹6,980 incl. 5% GST {adjustSampleCharges && "· taxable value adjusted above"}
                    </div>
                  </td>
                  <td className="py-2 px-4 text-right font-medium text-gray-800 whitespace-nowrap">
                    {inr(sampleV2Invoice)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Purple Card: Total job value incl. GST */}
        <div className="bg-[#EEF2FF] border border-indigo-100 rounded-xl p-4 flex items-center justify-between mb-4">
          <div>
            <div className="font-bold text-xs text-indigo-950">
              Total job value incl. GST
            </div>
            <div className="text-[10px] text-indigo-700/70">
              Invoice total + sample invoices
            </div>
          </div>
          <div className="text-base sm:text-lg font-black text-indigo-900">
            {inr(totalJobValue)}
          </div>
        </div>

        {/* Yellow Banner: Advance payable now */}
        <div className="bg-[#FEF9C3] border border-amber-200 rounded-xl p-3 text-center mb-6">
          <span className="text-xs font-black text-amber-950">
            Advance payable now: {inr(advanceDue)}
          </span>
        </div>

        {/* Sample history and changes */}
        <div className="border border-gray-200 rounded-xl p-4 mb-6 space-y-2.5">
          <h4 className="font-bold text-xs text-gray-900">
            Sample history and changes
          </h4>
          <div className="space-y-1.5 text-[11px] leading-relaxed">
            <div className="flex items-start gap-2">
              <b className="font-semibold text-gray-700 shrink-0">Sample v1:</b>
              <span className="text-gray-600">
                Changes requested: Size, Text / names, Logo / artwork, Finish, Material, Base / stand, Packaging, Colour: standard
              </span>
            </div>
            <div className="flex items-start gap-2">
              <b className="font-semibold text-gray-700 shrink-0">Sample v2:</b>
              <span className="text-emerald-700 font-medium">
                Approved. Production follows this sample.
              </span>
            </div>
          </div>
        </div>

        {/* Payment details */}
        <div className="border border-gray-200 rounded-xl p-4 mb-6 space-y-3">
          <h4 className="font-bold text-xs text-gray-900">Payment details</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
            <div>
              <span className="text-gray-400 font-medium block">Account name</span>
              <span className="font-bold text-gray-800">RD CUSTOM AWARDS PRIVATE LIMITED</span>
            </div>
            <div>
              <span className="text-gray-400 font-medium block">Bank</span>
              <span className="font-bold text-gray-800">HDFC Bank, Kalina Branch</span>
            </div>
            <div>
              <span className="text-gray-400 font-medium block">Account no.</span>
              <span className="font-bold text-gray-800">502001920490288</span>
            </div>
            <div>
              <span className="text-gray-400 font-medium block">IFSC</span>
              <span className="font-bold text-gray-800">HDFC0001672</span>
            </div>
          </div>

          <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-2.5 text-[11px] text-indigo-950 font-medium">
            Please reply to approve this quotation. On approval it serves as the proforma invoice; the tax invoice is issued on dispatch.
          </div>
        </div>

        {/* Signatures & Job ref */}
        <div className="print-break-inside-avoid print:pt-4">
          <div className="grid grid-cols-3 gap-6 pt-6 border-t border-gray-300 text-center text-[11px] mb-6 print:mb-3">
            <div className="border-t border-gray-400 pt-2 font-medium text-gray-600">
              For RD Custom Awards Pvt. Ltd.
            </div>
            <div className="border-t border-gray-400 pt-2 font-medium text-gray-600">
              Coordinator
            </div>
            <div className="border-t border-gray-400 pt-2 font-medium text-gray-600">
              Client acceptance
            </div>
          </div>

          <div className="text-[10px] text-gray-400 text-center pb-2">
            Job: {parentJobNo} · {piNumber} · Job reference since enquiry {enquiryRef}
          </div>
        </div>
      </div>
    </SendDocumentOverlay>
  );
};

export default PreviewProformaSheet;
