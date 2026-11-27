import React, { useState } from "react";
import { contactsOf, inr, getProductDesignImage, getAllProductPreviews } from "../../utils/helpers";
import SendDocumentOverlay from "../common/SendDocumentOverlay";

const PreviewDeliveryChargesSheet = ({ s, e, client, onClose, ids, currentUser, onSend }) => {
  const ct = contactsOf(client, s).find((x) => x.id === s.sampleReceiver) || client?.contacts?.[0];
  const contactName = ct?.name || "Client Name";
  const contactRole = ct?.role ? `(${ct.role})` : "";
  const phone = ct?.mobile || client?.mobile || "";
  const email = ct?.email || client?.email || "";

  // Compute job number and sub-job number formats: RD21071 and RD21071-A1
  const parentJobNo = s?.seq
    ? String(s.seq).startsWith("RD")
      ? s.seq
      : `RD${s.seq}`
    : (ids?.enq?.startsWith("RD") ? ids.enq : ids?.enq?.replace("ENQ/26/", "RD")) || "RD21071";

  const subJobCode = s?.e?.subJobNo || `${parentJobNo}-A1`;

  const [message, setMessage] = useState("");

  const todayStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  
  const chargesAmount = s.chargesAmount
    ? Number(s.chargesAmount)
    : s.sampleChargesAmount
    ? Number(s.sampleChargesAmount)
    : 2500;
  const gstAmount = Math.round(chargesAmount * 0.18);
  const totalAmount = chargesAmount + gstAmount;

  const allProducts = getAllProductPreviews(s, e, parentJobNo);

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
        <div className="flex justify-between items-start border-b-2 border-indigo-600 pb-4 mb-8">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">RD Custom Awards Pvt. Ltd.</h1>
            <p className="text-xs text-gray-500 mt-1 font-medium">Delivery charges</p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-black text-indigo-900 tracking-tight">{subJobCode}</h2>
            <p className="text-xs font-semibold text-gray-500 mt-0.5">Job: {parentJobNo}</p>
            <p className="text-xs text-gray-400 mt-0.5">{todayStr}</p>
          </div>
        </div>

        {/* To / Attention */}
        <div className="grid grid-cols-2 gap-12 text-xs mb-10">
          <div className="grid grid-cols-[80px_1fr] items-start">
            <span className="text-gray-400 font-medium">Bill to</span>
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
            <span className="text-gray-400 font-medium">Deliver to</span>
            <div className="text-gray-900 font-medium leading-relaxed">
              {s.shipTo || (s.isAddingNewAddress ? (s.newAddrName || "New Address") : (client?.shipTos?.[0]?.label || "Lonavala offsite venue"))}
            </div>
          </div>
          <div className="grid grid-cols-[80px_1fr] items-start">
            <span className="text-gray-400 font-medium">By</span>
            <div className="text-gray-900 font-medium leading-relaxed">
              · {s.carrier || s.sampleCarrier || "Tempo"}, {s.payer === 'rd' || s.sampleFreight === 'RD pays freight' ? 'we pay' : 'you pay'}
            </div>
          </div>
        </div>

        {/* Delivery charges Details */}
        <h3 className="text-sm font-extrabold text-indigo-900 mb-4">Delivery charges</h3>
        
        <div className="border-t border-gray-200">
          <table className="w-full text-xs text-left">
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-4 font-medium text-gray-400 w-[120px] align-top">Shipment items</td>
                <td className="py-4 text-gray-900 font-medium">
                  <div className="flex flex-wrap gap-3 items-start">
                    {allProducts.map((prod, pIdx) => (
                      <div
                        key={prod.subJobNo || pIdx}
                        className="flex items-center gap-3 p-2 rounded-xl border border-gray-200 bg-white shadow-2xs max-w-sm print:border print:border-gray-300"
                        style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
                      >
                        {prod.imgUrl ? (
                          <div 
                            className="w-14 h-14 rounded-lg border border-gray-200 overflow-hidden bg-white shrink-0 p-0.5 shadow-2xs print:border print:border-gray-300"
                            style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
                          >
                            <img 
                              src={prod.imgUrl} 
                              alt={prod.theme || "Product"} 
                              className="w-full h-full object-cover rounded" 
                              style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
                            />
                          </div>
                        ) : null}
                        <div className="min-w-0">
                          <span className="inline-block text-[10px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-1.5 py-0.2 rounded mb-0.5">
                            {prod.subJobNo}
                          </span>
                          <div className="text-xs font-bold text-gray-900 truncate">
                            {prod.theme}
                          </div>
                          <div className="text-[10px] text-gray-500">
                            {prod.spec || `${prod.size ? prod.size + ' in · ' : ''}${prod.qty} pcs`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-4 font-medium text-gray-400">Carrier</td>
                <td className="py-4 text-gray-900 font-medium">{s.sampleCarrier || "Tempo"}, {s.sampleFreight === 'RD pays freight' ? 'we pay' : 'you pay'}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-4 font-medium text-gray-400">Deliver to</td>
                <td className="py-4 text-gray-900 font-medium">{s.isAddingNewAddress ? (s.newAddrName || "New Address") : (client?.shipTos?.[0]?.label || "Andheri East office")}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-4 font-medium text-gray-400">Charges</td>
                <td className="py-4 text-gray-900 font-bold">
                  {inr(chargesAmount)} + GST 18% ({inr(gstAmount)}) = {inr(totalAmount)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-6 space-y-4">
          <div className="p-4 border border-gray-200 rounded-lg text-xs text-gray-700 bg-gray-50/50 leading-relaxed">
            Payable by you; please reply to approve. It will be added to the tax invoice unless paid directly to the carrier.
          </div>
          <div className="p-4 border border-gray-200 rounded-lg text-xs text-gray-700 bg-gray-50/50">
            Please check the details and reply within 24 hours if anything needs to change.
          </div>
        </div>

        {/* Signatures & Job reference */}
        <div className="print-break-inside-avoid print:pt-4">
          <div className="grid grid-cols-3 gap-8 mt-12 print:mt-4 pt-2">
            <div className="border-t border-gray-900 pt-2 text-[9px] text-gray-500 font-medium">For RD Custom Awards Pvt. Ltd.</div>
            <div className="border-t border-gray-900 pt-2 text-[9px] text-gray-500 font-medium">{currentUser?.name || "Meera Joshi"}, Coordinator</div>
            <div className="border-t border-gray-900 pt-2 text-[9px] text-gray-500 font-medium">Client acceptance</div>
          </div>
          
          <div className="text-center text-[10px] text-gray-400 mt-6 print:mt-4 font-medium">
            {subJobCode} · Job reference since enquiry {parentJobNo}
          </div>
        </div>
      </div>
    </SendDocumentOverlay>
  );
};

export default PreviewDeliveryChargesSheet;
