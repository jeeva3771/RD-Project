import React, { useState } from "react";
import { contactsOf, inr, getProductDesignImage } from "../../utils/helpers";
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
  
  // Compute job number and sub-job number formats: RD21071 and RD21071-A1
  const parentJobNo = s?.seq
    ? String(s.seq).startsWith("RD")
      ? s.seq
      : `RD${s.seq}`
    : (ids?.enq?.startsWith("RD") ? ids.enq : ids?.enq?.replace("ENQ/26/", "RD")) || "RD21071";

  const subJobCode = s?.e?.subJobNo || `${parentJobNo}-A1`;

  // Filter products based on selection (default to all if none or empty)
  const selectedProducts = (!quoteSelectedProducts || quoteSelectedProducts.size === 0)
    ? productsList
    : productsList.filter(p => quoteSelectedProducts.has(p.rateKey));

  return (
    <SendDocumentOverlay 
      s={s} 
      client={client} 
      onClose={onClose} 
      onSend={onSend}
    >
      {/* Document Sheet */}
      <div className="w-full max-w-4xl mx-auto bg-white shadow-2xl p-8 sm:p-12 rounded-xl mb-8 relative z-10 print-content">
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-indigo-600 pb-4 print:pb-2 mb-8 print:mb-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">RD Custom Awards Pvt. Ltd.</h1>
            <p className="text-xs text-gray-500 mt-1 font-medium">Quotation</p>
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
              {client?.name || "Kavach Health Insurance"}<br/>
              {client?.billing || "Unit 402, Kanakia Wall Street,\nAndheri East, Mumbai 400093"}<br/>
              GSTIN {client?.gstin || "27AACCK7730Q1Z1"}
            </div>
          </div>
          <div className="grid grid-cols-[80px_1fr] items-start">
            <span className="text-gray-400 font-medium">Attention</span>
            <div className="text-gray-900 font-medium leading-relaxed">
              {contactName} {contactRole}<br/>
              {email}<br/>
              {phone}
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
              {selectedProducts.map((p, displayIndex) => {
                const qty = p.qty;
                const rate = simulatedRates[p.rateKey]?.rate || 1210;
                const amount = qty * rate;
                const imgUrl = getProductDesignImage(s, e, p, p.originalProductIndex ?? displayIndex);
                return (
                  <tr key={p.rateKey} className="border-b border-gray-100">
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
                          <div className="font-bold text-gray-900 mb-0.5">{ids?.enq || "RD21071"}-{p.subjobId} {p.name}</div>
                          <div className="text-[10px] text-gray-500 leading-tight">
                            Plaque · Self-standing block · {p.size} in · Fusion: Crystal + Glass · Metal elements
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 text-right align-top whitespace-nowrap">{qty} pcs</td>
                    <td className="py-4 text-right align-top whitespace-nowrap">{inr(rate)}/pc</td>
                    <td className="py-4 text-right align-top font-bold text-gray-900 whitespace-nowrap">{inr(amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 border-b border-gray-100 pb-4 print:mt-2 print:pb-2">
          <div className="grid grid-cols-[120px_1fr] text-xs gap-4 mb-2">
            <span className="text-gray-500 font-medium">Sample rates</span>
            <div className="text-gray-700">
              {selectedProducts.map((p) => `${ids?.enq || "RD21071"}-${p.subjobId} ${p.name} (Self-standing block): ${inr(simulatedRates[p.rateKey]?.sample || 1820)}/pc`).join(' · ')}
            </div>
          </div>
          <div className="grid grid-cols-[120px_1fr] text-xs gap-4">
            <span className="text-gray-500 font-medium">Setup / artwork</span>
            <div className="text-gray-700">
              ₹1,500 one-time
            </div>
          </div>
        </div>

        <div className="mt-6 print:mt-3 space-y-4 print:space-y-2">
          <div className="p-4 print:p-2.5 border border-gray-200 rounded-lg text-xs text-gray-700 bg-gray-50/50 leading-relaxed">
            Amounts are before GST. Each quantity is an option; you choose the final quantity per item. Payment terms: 100% advance.<br/>
            Ref {ids?.enq || "RD21071"}.
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
