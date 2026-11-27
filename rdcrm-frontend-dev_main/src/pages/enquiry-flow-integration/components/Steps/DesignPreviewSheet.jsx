import React from "react";
import { contactsOf, formatEnquiryNo, ENQUIRY_CONFIG } from "../../utils/helpers";
import SendDocumentOverlay from "../common/SendDocumentOverlay";

const DesignPreviewSheet = ({ s, e, client, setShowDesignPreview, ids, uploadedDesigns, selectedProducts, productsList, currentUser, onSend }) => {
  const ct = contactsOf(client, s).find((x) => x.id === s.contactId);
  const contactName = ct?.name || "Client Name";
  const contactRole = ct?.role ? `(${ct.role})` : "";
  const phone = ct?.mobile || client?.mobile || "";
  const email = ct?.email || client?.email || "";

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

  const formatAddress = (addr) => {
    if (!addr) return "";
    if (typeof addr === "string") return addr;
    if (Array.isArray(addr) && addr.length > 0) return formatAddress(addr[0]);
    if (typeof addr === "object") {
      const parts = [
        addr.address_1,
        addr.address_2,
        addr.city,
        addr.state,
        addr.postal_code || addr.pincode,
      ].filter(Boolean);
      return parts.join(", ");
    }
    return "";
  };

  // Compute job number and sub-job number formats: RD21001 and RD21001-A1
  const parentJobNo = s?.seq
    ? formatEnquiryNo(s.seq)
    : (ids?.enq?.startsWith("RD") ? ids.enq : ids?.enq?.replace("ENQ/26/", "RD")) || ENQUIRY_CONFIG.DEFAULT_ENQUIRY_NO;

  // Filter products based on selection (strictly exclude held or dropped products)
  const sendingProducts = productsList.filter((p, idx) => selectedProducts.has(idx) && !p.is_on_hold && !p.is_dropped);

  const sendingSubJobNos = sendingProducts.flatMap((p) => {
    const originalIndex = productsList.indexOf(p);
    const groupChar = String.fromCharCode(65 + originalIndex);
    const matchedSubJobs = (s?.sub_jobs || []).filter(
      (sj) => !sj.is_dropped && !sj.is_on_hold && (sj.design_group === groupChar || sj.sub_job_no?.toUpperCase().includes(`-${groupChar}`))
    );
    if (matchedSubJobs.length > 0) {
      return matchedSubJobs.map((sj) => sj.sub_job_no);
    }
    const items = p.items && p.items.length > 0 ? p.items : [{}];
    return items.map((_, sIdx) => `${parentJobNo}-${groupChar}${sIdx + 1}`);
  });

  const subJobCode = sendingSubJobNos.length > 0 ? sendingSubJobNos.join(", ") : (s?.e?.subJobNo || `${parentJobNo}-A1`);

  return (
    <SendDocumentOverlay 
      s={s} 
      client={client} 
      onClose={() => setShowDesignPreview(false)} 
      onSend={onSend}
      docType="design"
      subJobNos={sendingSubJobNos}
    >
      {/* Document Sheet */}
      <div className="w-full max-w-4xl mx-auto bg-white shadow-2xl p-8 sm:p-12 rounded-xl mb-8 relative z-10">
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-indigo-600 pb-4 mb-8">
          <div>
            {e?.showRDLogo !== false && (
              <div className="mb-2.5">
                <img
                  src="https://rdcustomawards.com/cdn/shop/files/logo.svg?v=1700546283&width=90"
                  alt="RD Custom Awards Logo"
                  className="h-10 sm:h-12 w-auto object-contain"
                />
              </div>
            )}
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">RD Custom Awards Pvt. Ltd.</h1>
            <p className="text-xs text-gray-500 mt-1 font-medium">Design options for approval</p>
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
              {formatAddress(client?.billing || client?.address) || "Unit 402, Kanakia Wall Street, Andheri East, Mumbai 400093"}<br/>
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

        {/* Design Options Table */}
        <h3 className="text-sm font-extrabold text-gray-900 mb-4">Design options</h3>
        <div className="border-t border-gray-200">
          {sendingProducts.map((p, idx) => {
            const originalIndex = productsList.indexOf(p);
            const uploadedKeys = Object.keys(uploadedDesigns || {}).filter(k => k.startsWith(`${originalIndex}-`));
            const uploadedCount = uploadedKeys.length;
            
            return (
              <div key={idx} className="grid grid-cols-[160px_1fr] py-5 border-b border-gray-200 text-xs">
                <div>
                  <div className="font-bold text-gray-900 text-sm">{ids?.enq || ENQUIRY_CONFIG.DEFAULT_ENQUIRY_NO}-{getSubjobId(originalIndex)} {p.name}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{p.items[0]?.size || e?.size || 8} in</div>
                </div>
                <div>
                  <div className="font-bold text-gray-900 mb-1">{uploadedCount} {uploadedCount === 1 ? 'option' : 'options'} attached</div>
                  <div className="text-gray-500 mb-3">Brief: {e?.globalBrief || e?.productBriefs?.[p.name]?.brief || "—"}</div>

                  {/* Render Uploaded Design Images for Preview & Print */}
                  {uploadedCount > 0 ? (
                    <div className="flex flex-wrap gap-4 pt-1">
                      {Array.from({ length: 10 }).map((_, optIdx) => {
                        const imgUrl = uploadedDesigns[`${originalIndex}-${optIdx}`];
                        if (!imgUrl) return null;
                        return (
                          <div key={optIdx} className="flex flex-col items-center">
                            <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-xl border-2 border-gray-200 bg-white p-1 shadow-xs flex items-center justify-center overflow-hidden">
                              <img 
                                src={imgUrl} 
                                alt={`Option ${optIdx + 1}`} 
                                className="w-full h-full object-contain rounded-lg"
                              />
                            </div>
                            <span className="text-[11px] font-bold text-gray-800 mt-1.5 px-2.5 py-0.5 bg-gray-100 rounded-full border border-gray-200 shadow-2xs">
                              Option {optIdx + 1}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-amber-600 italic">No design images uploaded yet.</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Proof of confirmation / PO Copy if present on Job */}
        {s?.decision?.attachment && (
          <div className="mt-6 p-4 border border-indigo-100 rounded-xl bg-indigo-50/30 text-xs">
            <h4 className="font-bold text-indigo-950 mb-2 flex items-center gap-1.5">
              <span>📎</span>
              <span>Client Confirmation / PO Proof</span>
            </h4>
            <div className="flex items-center gap-4">
              {typeof s.decision.attachment === "string" || s.decision.attachment?.url ? (
                <div className="w-24 h-24 rounded-lg border border-gray-300 bg-white p-1 overflow-hidden shadow-xs">
                  <img 
                    src={s.decision.attachment?.url || s.decision.attachment} 
                    alt="Proof" 
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : null}
              <div className="text-gray-700">
                <p className="font-semibold">{s.decision.whoConfirmed || "Client contact"}</p>
                <p className="text-[11px] text-gray-500">Method: {s.decision.method || "WhatsApp"} · {s.decision.date || ""}</p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 space-y-4">
          <div className="p-4 border border-gray-200 rounded-lg text-xs text-gray-700 bg-gray-50/50">
            Design files are attached with this message. Please reply with your choice for each product, or the changes you need.
          </div>
          <div className="p-4 border border-gray-200 rounded-lg text-xs text-gray-700 bg-gray-50/50">
            Please check the details and reply within {e?.links_duration || e?.optionsDueIn || 24} hours if anything needs to change.
          </div>
          {(e?.showRDContent || e?.copyrightContent) && (
            <div className="p-3.5 border border-amber-200 rounded-xl text-xs text-amber-900 bg-amber-50/80 flex items-center gap-2">
              <span className="text-base">🛡️</span>
              <span className="font-medium">
                {e?.copyrightContent || "This artwork is the intellectual property of RD Custom Awards Pvt. Ltd., and all copyrights are held exclusively by RD Custom Awards Pvt. Ltd."}
              </span>
            </div>
          )}
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

export default DesignPreviewSheet;
