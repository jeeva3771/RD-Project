import React, { useState } from "react";
import { contactsOf, getProductDesignImage, formatEnquiryNo, ENQUIRY_CONFIG, formatAddress } from "../../utils/helpers";
import SendDocumentOverlay from "../common/SendDocumentOverlay";

const FinalDesignSheet = ({ s, e, client, setShowFinalDesign, ids, productsList, currentUser, onSend, approvedFeedback, uploadedDesigns, unselectedProducts }) => {
  const ct = contactsOf(client, s).find((x) => x.id === s.contactId);
  const contactName = ct?.name || "Client Name";
  const contactRole = ct?.role ? `(${ct.role})` : "";
  const phone = ct?.mobile || client?.mobile || "";
  const email = ct?.email || client?.email || "";
  const approvedProducts = productsList.map((p, idx) => ({ ...p, originalIndex: idx }))
    .filter(p => !unselectedProducts?.has(p.originalIndex) && !p.is_on_hold && !p.is_dropped);

  const getSubjobId = (index) => {
    let group = 0;
    let variant = 1;
    for (let i = 1; i <= index; i++) {
      if (productsList[i].name === productsList[i-1].name) {
        variant++;
      } else {
        group++;
        variant = 1;
      }
    }
    return String.fromCharCode(65 + group) + variant;
  };

  let firstLog = null;
  Object.values(approvedFeedback || {}).forEach(val => {
    const fbs = Array.isArray(val) ? val : [val];
    fbs.forEach(fb => {
      if (fb && fb.mode === 'approve' && fb.communication && !firstLog) {
        firstLog = fb;
      }
    });
  });

  // Compute job number and sub-job number formats: RD21001 and RD21001-A1
  const parentJobNo = s?.seq
    ? formatEnquiryNo(s.seq)
    : (ids?.enq?.startsWith("RD") ? ids.enq : ids?.enq?.replace("ENQ/26/", "RD")) || ENQUIRY_CONFIG.DEFAULT_ENQUIRY_NO;

  const subJobCode = s?.e?.subJobNo || `${parentJobNo}-A1`;

  const whoConfirmed = firstLog?.communication?.whoConfirmed || "Client";
  const confirmMethod = firstLog?.communication?.method || "Email";
  const confirmDate = firstLog?.communication?.date || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <SendDocumentOverlay 
      s={s} 
      client={client} 
      onClose={() => setShowFinalDesign(false)} 
      onSend={onSend}
    >
      {/* Document Sheet */}
      <div className="w-full max-w-4xl mx-auto bg-white shadow-2xl p-8 sm:p-12 rounded-xl mb-8 relative z-10 print-content">
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-indigo-600 pb-4 mb-8">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">RD Custom Awards Pvt. Ltd.</h1>
            <p className="text-xs text-gray-500 mt-1 font-medium">Final approved design</p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-black text-indigo-900 tracking-tight">{subJobCode}</h2>
            <p className="text-xs font-semibold text-gray-500 mt-0.5">Job: {parentJobNo}</p>
            <p className="text-xs text-gray-400 mt-0.5">{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
        </div>

        {/* To / Attention */}
        <div className="grid grid-cols-2 gap-12 text-xs mb-10">
          <div className="grid grid-cols-[80px_1fr] items-start">
            <span className="text-gray-400 font-medium">To</span>
            <div className="text-gray-900 font-medium leading-relaxed">
              {client?.name || "Kavach Health Insurance"}<br/>
              {formatAddress(client?.billing) || formatAddress(client?.address) || "Unit 402, Kanakia Wall Street,\nAndheri East, Mumbai 400093"}<br/>
              GSTIN {typeof client?.gstin === "object" ? (client.gstin?.gst_no || "") : (client?.gstin || "27AACCK7730Q1Z1")}
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
        </div>

        {/* Final Approved Design Table */}
        <h3 className="text-sm font-extrabold text-gray-900 mb-4">Final approved design</h3>
        <div className="border-t border-gray-200">
          {approvedProducts.length === 0 && (
            <div className="py-8 text-center text-gray-400 italic text-xs">No products selected</div>
          )}
          {approvedProducts.map((p, idx) => {
            const fbs = Array.isArray(approvedFeedback[p.originalIndex]) ? approvedFeedback[p.originalIndex] : (approvedFeedback[p.originalIndex] ? [approvedFeedback[p.originalIndex]] : []);
            const fb = fbs.find(f => f.mode === 'approve');
            const optText = fb?.optIdxs?.length > 0 ? `Option ${fb.optIdxs.map(i => i+1).join(', ')} approved` : 'Approved';
            
            return (
              <div key={idx} className="grid grid-cols-[150px_1fr] py-6 border-b border-gray-100 text-xs">
                <div>
                  <div className="font-bold text-gray-900">{ids?.enq || ENQUIRY_CONFIG.DEFAULT_ENQUIRY_NO}-{getSubjobId(p.originalIndex)} {p.name}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">{p.items[0]?.size || e.size || 8} in</div>
                </div>
                <div>
                  <div className="font-bold text-emerald-600 mb-3 text-sm flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">✓</span>
                    {optText}
                  </div>
                  {(() => {
                    const approvedOptionUrls = fb?.optIdxs?.length > 0 && uploadedDesigns
                      ? fb.optIdxs.map(optIdx => uploadedDesigns[`${p.originalIndex}-${optIdx}`]).filter(Boolean)
                      : [];
                    const fallbackUrl = approvedOptionUrls.length === 0
                      ? getProductDesignImage(s, e, p, p.originalIndex)
                      : null;
                    const urlsToShow = approvedOptionUrls.length > 0 ? approvedOptionUrls : (fallbackUrl ? [fallbackUrl] : []);

                    if (urlsToShow.length === 0) return null;

                    return (
                      <div className="flex flex-wrap gap-4 mb-4">
                        {urlsToShow.map((fileUrl, optIdx) => (
                          <div key={optIdx} className="w-40 h-40 rounded-lg border-2 border-emerald-100 overflow-hidden bg-white shadow-sm p-1">
                            <div className="w-full h-full rounded border border-gray-100 overflow-hidden relative group">
                               <img src={fileUrl} className="w-full h-full object-cover" />
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  <div className="text-gray-500">Brief: {e.globalBrief || e.productBriefs?.[p.name]?.brief || "—"}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 space-y-4">
          <div className="p-4 border border-gray-200 rounded-lg text-xs text-gray-700 bg-gray-50/50">
            Approved by {whoConfirmed} ({confirmMethod.charAt(0).toUpperCase() + confirmMethod.slice(1)}, {confirmDate}). Production and the sample follow this design.
          </div>
          <div className="p-4 border border-gray-200 rounded-lg text-xs text-gray-700 bg-gray-50/50">
            Please check the details and reply within {e.optionsDueIn || 24} hours if anything needs to change.
          </div>
        </div>

        {/* Signatures & Job reference */}
        <div className="print-break-inside-avoid print:pt-4">
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

export default FinalDesignSheet;
