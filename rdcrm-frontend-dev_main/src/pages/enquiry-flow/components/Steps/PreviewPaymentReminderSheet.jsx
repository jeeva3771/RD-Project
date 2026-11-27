import React from "react";
import { contactsOf, inr, getAllProductPreviews } from "../../utils/helpers";
import SendDocumentOverlay from "../common/SendDocumentOverlay";

const PreviewPaymentReminderSheet = ({
  s = {},
  client = {},
  job = {},
  ids = {},
  items = [],
  totalInvoiceVal = 331700,
  advanceDue = 100000,
  deliveryDate,
  currentDeliv = {},
  onClose,
  onSend
}) => {
  const allContacts = contactsOf(client, s);
  const ct = allContacts.find((x) => x.id === s.contactId) || allContacts[0];
  const contactName = ct?.name || client?.contact || client?.name || "Vikas Rao";
  const contactRole = ct?.role ? `(${ct.role})` : "(Sales ops)";
  const phone = ct?.mobile || client?.mobile || "9820055123";
  const email = ct?.email || client?.email || "vikas.rao@meridianpharma.example";

  const parentJobNo = s?.seq
    ? String(s.seq).startsWith("RD")
      ? s.seq
      : `RD${s.seq}`
    : (ids?.enq?.startsWith("RD") ? ids.enq : ids?.enq?.replace("ENQ/26/", "RD")) || "RD/P/26/0415";

  const docNo = `${parentJobNo}-PR3`;
  const enqRef = ids?.enq || `ENQ/26/${String(parentJobNo).replace(/\D/g, "").slice(-4) || "0415"}`;

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

  const clientAddress =
    s.diffAddress ||
    client?.address ||
    "Plot 14, MIDC, Andheri East,\nMumbai 400093";
  const clientGstin = s.diffGstin || client?.gstin || "27AADCM5561H1Z6";
  const clientCompanyName = s.diffPartyName || client?.name || client?.company || "Meridian Pharma Pvt Ltd";

  const carrier = currentDeliv?.carrier || s?.deliv?.carrier || "Tempo";
  const payerText = currentDeliv?.payer === "client" ? "client pays" : "we pay";
  const whenText = currentDeliv?.when || s?.deliv?.when || "office hours";
  const shipTo = currentDeliv?.shipTo || s?.deliv?.shipTo || "Lonavala offsite venue";

  const allProducts = getAllProductPreviews(s, s?.e || {}, parentJobNo);

  return (
    <SendDocumentOverlay
      s={s}
      client={client}
      onClose={onClose}
      onSend={onSend}
    >
      <div className="w-full max-w-4xl mx-auto bg-white shadow-2xl p-8 sm:p-12 rounded-xl mb-8 relative z-10 print-content text-left">
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-indigo-600 pb-4 mb-8">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">
              RD Custom Awards Pvt. Ltd.
            </h1>
            <p className="text-xs text-gray-500 mt-1 font-semibold uppercase tracking-wider">
              Payment reminder
            </p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-black text-indigo-900 tracking-tight">
              {docNo}
            </h2>
            <p className="text-xs text-gray-400 mt-1">{todayStr}</p>
          </div>
        </div>

        {/* Bill to / Attention / Deliver to */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs mb-8">
          <div className="space-y-4">
            <div className="grid grid-cols-[70px_1fr] items-start">
              <span className="text-gray-400 font-medium">Bill to</span>
              <div className="text-gray-900 font-medium leading-relaxed whitespace-pre-line">
                <span className="font-bold">{clientCompanyName}</span>
                {"\n"}
                {clientAddress}
                {"\n"}
                <span className="text-gray-500">GSTIN {clientGstin}</span>
              </div>
            </div>
            <div className="grid grid-cols-[70px_1fr] items-start">
              <span className="text-gray-400 font-medium">Deliver to</span>
              <div className="text-gray-900 font-medium">{shipTo}</div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-[70px_1fr] items-start">
              <span className="text-gray-400 font-medium">Attention</span>
              <div className="text-gray-900 font-medium leading-relaxed">
                <span className="font-bold">{contactName}</span> {contactRole}
                <br />
                <span className="text-gray-600">{email}</span>
                <br />
                <span className="text-gray-600">+91 {phone}</span>
              </div>
            </div>
            <div className="grid grid-cols-[70px_1fr] items-start">
              <span className="text-gray-400 font-medium">By</span>
              <div className="text-gray-900 font-medium">
                {deliveryFormatted} · {carrier}, {payerText} · {whenText}
              </div>
            </div>
          </div>
        </div>

        {/* Payment reminder table */}
        <div className="mb-6">
          <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider mb-2">
            Payment reminder
          </h3>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <tbody className="divide-y divide-gray-200">
                <tr className="bg-white">
                  <td className="py-2.5 px-4 text-gray-500 font-medium w-44">Order</td>
                  <td className="py-2.5 px-4 font-bold text-gray-900">
                    <div className="flex items-center gap-3">
                      {allProducts[0]?.imgUrl ? (
                        <div
                          className="w-10 h-10 rounded-lg border border-gray-200 overflow-hidden bg-white shrink-0 p-0.5 shadow-2xs print:border print:border-gray-300"
                          style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
                        >
                          <img
                            src={allProducts[0].imgUrl}
                            alt="Trophy"
                            className="w-full h-full object-cover rounded"
                          />
                        </div>
                      ) : null}
                      <div>
                        <div>{parentJobNo} · {s.poNo || "PO/1458"} · {allProducts.length} {allProducts.length === 1 ? 'item' : 'items'}</div>
                        <div className="text-[11px] text-gray-500 font-normal">
                          {allProducts.map(p => p.theme).join(" · ")}
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
                <tr className="bg-gray-50/50">
                  <td className="py-2.5 px-4 text-gray-500 font-medium">Order value</td>
                  <td className="py-2.5 px-4 font-bold text-gray-900">
                    {inr(totalInvoiceVal)} incl. GST
                  </td>
                </tr>
                <tr className="bg-white">
                  <td className="py-2.5 px-4 text-gray-500 font-medium">Advance due</td>
                  <td className="py-2.5 px-4 font-bold text-rose-700">
                    {inr(advanceDue)} · not received
                  </td>
                </tr>
                <tr className="bg-gray-50/50">
                  <td className="py-2.5 px-4 text-gray-500 font-medium">Planned dispatch</td>
                  <td className="py-2.5 px-4 font-bold text-gray-900">{deliveryFormatted}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Products in this order with Image Preview */}
        <div className="mb-6">
          <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Products in this order</span>
            <span className="text-[11px] text-gray-400 font-normal">{allProducts.length} {allProducts.length === 1 ? 'item' : 'items'}</span>
          </h3>
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
            <div className="divide-y divide-gray-100">
              {allProducts.map((prod, pIdx) => (
                <div key={prod.subJobNo || pIdx} className="p-3 flex items-center gap-3">
                  {prod.imgUrl ? (
                    <div
                      className="w-14 h-14 rounded-xl border border-gray-200 overflow-hidden bg-white shrink-0 p-0.5 shadow-2xs print:border print:border-gray-300"
                      style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
                    >
                      <img
                        src={prod.imgUrl}
                        alt={prod.theme || "Trophy"}
                        className="w-full h-full object-cover rounded-lg"
                        style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
                      />
                    </div>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-1.5 py-0.2 rounded">
                        {prod.subJobNo}
                      </span>
                      <span className="text-xs font-bold text-gray-900 truncate">
                        {prod.theme}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {prod.spec || `${prod.size ? prod.size + ' in · ' : ''}${prod.qty} pcs`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-gray-900">
                      {prod.qty} pcs
                    </div>
                    {prod.rate ? (
                      <div className="text-[10px] text-gray-400">
                        @ {inr(prod.rate)}/pc
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Amber Callout Box */}
        <div className="bg-[#FFF8E7] border border-[#FDE68A] text-[#92400E] p-3.5 rounded-lg text-xs font-semibold mb-6 shadow-2xs">
          Until the advance is received, the tax invoice cannot be generated and dispatch will be delayed.
        </div>

        {/* Sample history and changes */}
        <div className="mb-6">
          <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider mb-2">
            Sample history and changes
          </h3>
          <div className="border border-gray-200 rounded-lg overflow-hidden text-xs">
            <table className="w-full">
              <tbody className="divide-y divide-gray-200">
                <tr className="bg-white">
                  <td className="py-2.5 px-4 text-gray-500 font-medium w-32">Sample v1</td>
                  <td className="py-2.5 px-4 text-gray-700">
                    <span className="font-bold text-amber-800">Changes requested:</span>{" "}
                    {s.clientChanges || "Size, Text / names, Logo / artwork, Finish, Material, Base / stand, Packaging, Colour: standard"}
                  </td>
                </tr>
                <tr className="bg-gray-50/50">
                  <td className="py-2.5 px-4 text-gray-500 font-medium">Sample v2</td>
                  <td className="py-2.5 px-4 text-emerald-800 font-bold">
                    Approved: Production follows this sample.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment details */}
        <div className="mb-8">
          <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider mb-2">
            Payment details
          </h3>
          <div className="border border-gray-200 rounded-lg overflow-hidden text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-200">
              <div className="p-3.5 space-y-1.5 bg-white">
                <div className="flex justify-between">
                  <span className="text-gray-400">Account name:</span>
                  <span className="font-bold text-gray-900">RD CUSTOM AWARDS PRIVATE LIMITED</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Account no.:</span>
                  <span className="font-mono font-bold text-gray-900">50200062045098</span>
                </div>
              </div>
              <div className="p-3.5 space-y-1.5 bg-gray-50/50">
                <div className="flex justify-between">
                  <span className="text-gray-400">Bank:</span>
                  <span className="font-bold text-gray-900">HDFC Bank, Kalina Branch</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">IFSC:</span>
                  <span className="font-mono font-bold text-gray-900">HDFC0000572</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Disclaimer Notice */}
        <div className="border border-gray-200 rounded-lg p-3 text-center text-xs text-gray-500 font-medium mb-12 bg-gray-50/30">
          Please check the details and reply within 24 hours if anything needs to change.
        </div>

        {/* Signatures & Footer Reference */}
        <div className="print-break-inside-avoid print:pt-4">
          <div className="grid grid-cols-3 gap-8 pt-8 border-t border-gray-200 text-center text-xs">
            <div>
              <div className="h-10"></div>
              <div className="border-t border-gray-400 pt-2 font-bold text-gray-800">
                For RD Custom Awards Pvt. Ltd.
              </div>
            </div>
            <div>
              <div className="h-10 flex items-end justify-center pb-1 text-gray-500 italic text-[11px]">
              </div>
              <div className="border-t border-gray-400 pt-2 font-bold text-gray-800">
                Coordinator
              </div>
            </div>
            <div>
              <div className="h-10"></div>
              <div className="border-t border-gray-400 pt-2 font-bold text-gray-800">
                Client acceptance
              </div>
            </div>
          </div>

        </div>
      </div>
    </SendDocumentOverlay>
  );
};

export default PreviewPaymentReminderSheet;
