import React, { useState } from "react";
import { contactsOf, inr, getProductDesignImage, formatEnquiryNo, ENQUIRY_CONFIG, formatAddress } from "../../utils/helpers";
import SendDocumentOverlay from "../common/SendDocumentOverlay";

const PreviewQuoteSheet = ({ s, e, client, onClose, ids, productsList, currentUser, onSend, simulatedRates, quoteSelectedProducts }) => {
  const ct = contactsOf(client, s).find((x) => x.id === s.contactId);
  const contactName = ct?.name || "Client Name";
  const contactRole = ct?.role ? `(${ct.role})` : "";
  const phone = ct?.mobile || client?.mobile || "";
  const email = ct?.email || client?.email || "";

  const [message, setMessage] = useState("");

  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 15);
  const validUntilStr = validUntil.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const todayStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  
  // Compute job number and sub-job number formats: RD21001 and RD21001-A1
  const parentJobNo = s?.seq
    ? formatEnquiryNo(s.seq)
    : (ids?.enq?.startsWith("RD") ? ids.enq : ids?.enq?.replace("ENQ/26/", "RD")) || ENQUIRY_CONFIG.DEFAULT_ENQUIRY_NO;

  // Filter products based on selection: strictly exclude dropped or on-hold sub-jobs
  const eligibleProducts = productsList.filter(
    (p) => !p.isDrop && !p.is_dropped && !p.isHold && !p.is_on_hold
  );

  const selectedProducts = (quoteSelectedProducts && quoteSelectedProducts.size > 0)
    ? eligibleProducts.filter(p => quoteSelectedProducts.has(p.rateKey))
    : eligibleProducts.filter(p => (p.costingStatus === "completed" || Number(p.unitRate || p.target_rate || 0) > 0));

  const finalSelectedProducts = selectedProducts.length > 0
    ? selectedProducts
    : eligibleProducts;

  const targetedSubJobNos = finalSelectedProducts.map(p => (
    p.subJobNo || (p.subjobId ? `${parentJobNo}-${p.subjobId}` : p.name)
  ));

  const subJobCode = targetedSubJobNos.length > 0 ? targetedSubJobNos.join(", ") : (s?.e?.subJobNo || `${parentJobNo}-A1`);

  // Resolve enquiry-wide 1-time artwork charge (default ₹1,500)
  const enquiryArtworkFee = Number(
    s?.financials?.artwork_charge !== undefined
      ? s.financials.artwork_charge
      : s?.wizard_state?.costing?.artwork !== undefined
        ? s.wizard_state.costing.artwork
        : s?.costing?.artwork !== undefined
          ? s.costing.artwork
          : 1500
  );

  const itemsSubtotal = finalSelectedProducts.reduce((sum, p) => {
    const isCompleted = p.costingStatus === "completed" || p.unitRate > 0;
    const r = isCompleted
      ? Number(simulatedRates?.[p.rateKey]?.rate !== undefined ? simulatedRates[p.rateKey].rate : (p.unitRate || p.rate || 0))
      : 0;
    const q = Number(p.qty || 1);
    return sum + (q * r);
  }, 0);

  const totalQuoteAmount = itemsSubtotal + enquiryArtworkFee;

  return (
    <SendDocumentOverlay 
      s={s} 
      client={client} 
      onClose={onClose} 
      onSend={onSend}
      docType="quote"
      subJobNos={targetedSubJobNos}
      totalAmount={totalQuoteAmount}
      selectedItems={finalSelectedProducts}
    >
      {/* Document Sheet */}
      <div className="w-full max-w-4xl mx-auto bg-white shadow-2xl p-8 sm:p-12 rounded-xl mb-8 relative z-10 print-content">
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-indigo-600 pb-4 print:pb-2 mb-8 print:mb-4">
          <div>
            <div className="mb-2.5">
              <img
                src="https://rdcustomawards.com/cdn/shop/files/logo.svg?v=1700546283&width=90"
                alt="RD Custom Awards Logo"
                className="h-10 sm:h-12 w-auto object-contain"
              />
            </div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">RD Custom Awards Pvt. Ltd.</h1>
            <p className="text-xs text-gray-500 mt-1 font-medium">Commercial Quotation</p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-black text-indigo-900 tracking-tight">{subJobCode}</h2>
            <p className="text-xs font-semibold text-gray-500 mt-0.5">Job: {parentJobNo}</p>
            <p className="text-xs text-gray-400 mt-0.5">{todayStr}</p>
          </div>
        </div>

        {/* To / Attention */}
        <div className="grid grid-cols-2 gap-12 print:gap-6 text-xs mb-10 print:mb-4">
          <div className="grid grid-cols-[80px_1fr] items-start">
            <span className="text-gray-400 font-medium">Quotation to</span>
            <div className="text-gray-900 font-medium leading-relaxed">
              {(s.billTo?.on && s.billTo.name) ? s.billTo.name : (client?.name || "Kavach Health Insurance")}<br/>
              {(s.billTo?.on && s.billTo.address) ? formatAddress(s.billTo.address) : (formatAddress(client?.billing) || formatAddress(client?.address) || "Unit 402, Kanakia Wall Street,\nAndheri East, Mumbai 400093")}<br/>
              GSTIN {(s.billTo?.on && s.billTo.gstin) ? (typeof s.billTo.gstin === "object" ? (s.billTo.gstin?.gst_no || "") : s.billTo.gstin) : (typeof client?.gstin === "object" ? (client.gstin?.gst_no || "") : (client?.gstin || "27AACCK7730Q1Z1"))}
            </div>
          </div>
          <div className="grid grid-cols-[80px_1fr] items-start">
            <span className="text-gray-400 font-medium">Attention</span>
            <div className="text-gray-900 font-medium leading-relaxed">
              {(s.billTo?.on && s.billTo.contact?.name) ? s.billTo.contact.name : contactName} {contactRole}<br/>
              {(s.billTo?.on && s.billTo.contact?.email) ? s.billTo.contact.email : email}<br/>
              {(s.billTo?.on && s.billTo.contact?.phone) ? (String(s.billTo.contact.phone).startsWith("+91") ? s.billTo.contact.phone : `+91 ${s.billTo.contact.phone}`) : phone}
            </div>
          </div>
          <div className="grid grid-cols-[80px_1fr] items-start">
            <span className="text-gray-400 font-medium">Valid until</span>
            <div className="text-gray-900 font-medium leading-relaxed">
              {validUntilStr}
            </div>
          </div>
        </div>

        {/* Quotation Details */}
        <h3 className="text-sm font-extrabold text-gray-900 mb-4 print:mb-2">Quotation</h3>
        
        <textarea
          className="w-full border border-indigo-100 rounded-lg p-3 text-xs mb-6 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-indigo-50/30 print:hidden"
          rows="2"
          placeholder="Optional message..."
          value={message}
          onChange={(ev) => setMessage(ev.target.value)}
        />
        {message && message.trim() ? (
          <div className="hidden print:block text-xs border border-indigo-100 bg-indigo-50/30 rounded-lg p-2.5 mb-3 text-gray-800">
            {message}
          </div>
        ) : null}

        <div className="border-t border-gray-200">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500 font-medium">
                <th className="py-3 font-medium">#</th>
                <th className="py-3 font-medium">Item</th>
                <th className="py-3 text-right font-medium">Qty</th>
                <th className="py-3 text-right font-medium">Rate</th>
                <th className="py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {finalSelectedProducts.map((p, displayIndex) => {
                const qty = Number(p.qty || 1);
                const isCompleted = p.costingStatus === "completed" || p.unitRate > 0;
                const rate = isCompleted
                  ? Number(simulatedRates?.[p.rateKey]?.rate !== undefined ? simulatedRates[p.rateKey].rate : (p.unitRate || p.rate || 0))
                  : 0;
                const amount = qty * rate;
                const imgUrl = getProductDesignImage(s, e, p, p.originalProductIndex ?? displayIndex);
                const subJobLabel = p.subJobNo || `${parentJobNo}-${p.subjobId}`;
                return (
                  <tr key={p.rateKey || displayIndex} className="border-b border-gray-100">
                    <td className="py-4 align-top text-gray-500">{displayIndex + 1}</td>
                    <td className="py-4 pr-4">
                      <div className="flex items-start gap-3">
                        {imgUrl ? (
                          <div 
                            className="w-16 h-16 rounded-xl border border-gray-200 overflow-hidden bg-white shrink-0 p-0.5 shadow-2xs print:border print:border-gray-300"
                            style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
                          >
                            <img 
                              src={imgUrl} 
                              alt={p.name} 
                              className="w-full h-full object-cover rounded-lg" 
                              style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
                            />
                          </div>
                        ) : null}
                        <div className="min-w-0">
                          <div className="font-bold text-gray-900 mb-0.5">{subJobLabel} {p.theme || p.name}</div>
                          <div className="text-[10px] text-gray-500 leading-tight">
                            {p.specLine || p.spec_line || p.desc || `${p.theme || p.name || 'Custom Product'} · ${p.size || 8} in · ${p.mat || 'MDF'}`}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 text-right align-top whitespace-nowrap font-medium text-gray-700">{qty} pcs</td>
                    <td className="py-4 text-right align-top whitespace-nowrap font-medium text-gray-900">
                      ₹{rate.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/pc
                    </td>
                    <td className="py-4 text-right align-top font-bold text-gray-900 whitespace-nowrap">
                      ₹{amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}

              {/* Dedicated 1-Time Setup & Artwork Line Item at End of Quotation List */}
              {enquiryArtworkFee > 0 && (
                <tr className="border-b border-gray-100 bg-indigo-50/20">
                  <td className="py-3 align-top text-gray-400 font-medium">{finalSelectedProducts.length + 1}</td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-indigo-900">1-Time Setup & Artwork Fee</span>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-indigo-100 text-indigo-700">1-TIME FEE</span>
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      Enquiry-level artwork processing & machine setup (1-time fee across all items)
                    </div>
                  </td>
                  <td className="py-3 text-right align-top whitespace-nowrap font-medium text-gray-600">1 Lot</td>
                  <td className="py-3 text-right align-top whitespace-nowrap font-medium text-gray-900">
                    ₹{enquiryArtworkFee.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 text-right align-top font-bold text-indigo-900 whitespace-nowrap">
                    ₹{enquiryArtworkFee.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50/70 font-bold">
                <td colSpan="4" className="py-3 px-3 text-right text-gray-700 text-xs uppercase tracking-wider">
                  Total Estimate (Excl. GST):
                </td>
                <td className="py-3 px-3 text-right text-sm font-black text-indigo-900 whitespace-nowrap">
                  ₹{Number(totalQuoteAmount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-4 border-b border-gray-100 pb-4 print:mt-2 print:pb-2">
          <div className="grid grid-cols-[120px_1fr] text-xs gap-4 mb-2">
            <span className="text-gray-500 font-medium">Sample rates</span>
            <div className="text-gray-700">
              {finalSelectedProducts.map((p) => {
                const isCompleted = p.costingStatus === "completed" || p.unitRate > 0;
                const r = isCompleted
                  ? Number(simulatedRates?.[p.rateKey]?.rate !== undefined ? simulatedRates[p.rateKey].rate : (p.unitRate || p.rate || 0))
                  : 0;
                const sRate = Number(simulatedRates?.[p.rateKey]?.sample !== undefined ? simulatedRates[p.rateKey].sample : (p.sampleRate || p.sample_rate || (r > 0 ? r + 200 : 0)));
                const subJobLabel = p.subJobNo || `${parentJobNo}-${p.subjobId}`;
                const sQty = Number(p.sampleQty || p.pieces || s?.sampleQty || s?.order_mode?.sample_qty || 1);
                const sTotal = sRate * sQty;
                return `${subJobLabel} ${p.name}: ₹${sRate.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/pc (${sQty} pc${sQty > 1 ? "s" : ""} = ₹${sTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
              }).join(' · ')}
            </div>
          </div>
          <div className="grid grid-cols-[120px_1fr] text-xs gap-4">
            <span className="text-gray-500 font-medium">Setup / artwork</span>
            <div className="text-gray-700">
              ₹{enquiryArtworkFee.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} one-time
            </div>
          </div>
        </div>

        <div className="mt-6 print:mt-3 space-y-4 print:space-y-2">
          <div className="p-4 print:p-2.5 border border-gray-200 rounded-lg text-xs text-gray-700 bg-gray-50/50 leading-relaxed">
            Amounts are before GST. Each quantity is an option; you choose the final quantity per item. Payment terms: 100% advance.<br/>
            Ref {ids?.enq || ENQUIRY_CONFIG.DEFAULT_ENQUIRY_NO}.
          </div>
          <div className="p-4 print:p-2.5 border border-gray-200 rounded-lg text-xs text-gray-700 bg-gray-50/50">
            Please reply to approve, or let us know any changes.
          </div>
        </div>

        {/* Signatures & Job Reference */}
        <div className="print-break-inside-avoid print:pt-6">
          <div className="grid grid-cols-3 gap-8 mt-12 print:mt-4 pt-2">
            <div className="border-t border-gray-400 pt-2 text-[9px] text-gray-500 font-medium">For RD Custom Awards Pvt. Ltd.</div>
            <div className="border-t border-gray-400 pt-2 text-[9px] text-gray-500 font-medium">{currentUser?.name || "Coordinator"}, Coordinator</div>
            <div className="border-t border-gray-400 pt-2 text-[9px] text-gray-500 font-medium">Client acceptance</div>
          </div>
          
          <div className="text-center text-[10px] text-gray-400 mt-6 print:mt-4 font-medium">
            {subJobCode} · Job reference since enquiry {parentJobNo}
          </div>
        </div>
      </div>
    </SendDocumentOverlay>
  );
};

export default PreviewQuoteSheet;
