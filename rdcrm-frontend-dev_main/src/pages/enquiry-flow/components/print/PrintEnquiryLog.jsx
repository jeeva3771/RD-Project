import React from "react";
import { contactsOf, inr } from "../../utils/helpers";

const PrintEnquiryLog = ({ s, e, client, setShowPrint, ids, heat, currentUser, uploadedDesigns: propUploadedDesigns }) => {
  const ct = contactsOf(client, s).find((x) => x.id === s.contactId);
  const refNo = e.refNo || "—";
  const allUploadedDesigns = propUploadedDesigns || s?.uploadedDesigns || {};
  const designImageUrls = Object.values(allUploadedDesigns).filter(Boolean);
  
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm overflow-y-auto print:bg-white p-4 sm:p-8 flex flex-col items-center">
      {/* Top Bar - Hidden when printing */}
      <div className="w-full max-w-4xl mx-auto flex items-center gap-4 mb-6 print:hidden">
        <button 
          onClick={() => setShowPrint(false)}
          className="px-4 py-2 border border-indigo-200 bg-white text-indigo-700 rounded-lg text-sm font-semibold hover:bg-indigo-50 shadow-sm"
        >
          Back to the job
        </button>
        <button 
          onClick={handlePrint}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700"
        >
          Print
        </button>
        <span className="text-xs text-gray-500">If the button does nothing here, press Ctrl+P (Cmd+P on Mac). Only the sheet prints.</span>
      </div>

      {/* The Printable Sheet */}
      <div className="w-full max-w-4xl mx-auto bg-white shadow-2xl print:shadow-none print:border-none p-8 sm:p-12 rounded-xl print:p-0 mb-8">
        
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-indigo-600 pb-4 mb-6">
          <div>
            <h1 className="text-2xl font-black text-indigo-900 tracking-tight">RD Custom Awards Pvt. Ltd.</h1>
            <p className="text-sm text-gray-500 mt-1">Enquiry log · Client Servicing</p>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-black text-indigo-900">{ids?.enq || "RD21071"}</h2>
            <p className="text-sm text-gray-500 mt-1">{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
        </div>

        {/* Subheader Status */}
        <div className="flex flex-wrap items-center gap-6 text-sm mb-4">
          <div><span className="text-gray-500 font-semibold mr-2">Status</span><span className="font-bold text-gray-900">
            {s.quoted ? "Quoted - awaiting client" : s.optionsShared ? "Options shared - awaiting costing" : "Logged · with Design"}
          </span></div>
          <div><span className="text-gray-500 font-semibold mr-2">Heat</span><span className="font-bold text-gray-900">{heat?.label || "Hot"} · {heat?.sc || 85}/100</span></div>
          <div><span className="text-gray-500 font-semibold mr-2">Coordinator</span><span className="font-bold text-gray-900">{s.coordinator || currentUser.name}</span></div>
        </div>
        
        <div className="flex flex-wrap gap-2 mb-8">
          <span className="px-2 py-1 border border-gray-200 rounded text-xs font-semibold text-gray-600">+ Repeat client</span>
          <span className="px-2 py-1 border border-gray-200 rounded text-xs font-semibold text-gray-600">+ 78% enquiry win rate</span>
          <span className="px-2 py-1 border border-gray-200 rounded text-xs font-semibold text-gray-600">+ Target rate fits spec</span>
        </div>

        {/* Client Section */}
        <h3 className="text-lg font-black text-gray-900 mb-4">Client</h3>
        <div className="grid grid-cols-2 gap-y-3 gap-x-8 text-sm mb-8 border-b border-gray-100 pb-8">
          <div className="grid grid-cols-[120px_1fr]"><span className="text-gray-500">Client</span><span className="font-medium text-gray-900">{client?.name || "Kavach Health Insurance"}</span></div>
          <div className="grid grid-cols-[120px_1fr]"><span className="text-gray-500">GSTIN</span><span className="font-medium text-gray-900">{client?.gstin || "27AACCK7730Q1Z1"}</span></div>
          <div className="grid grid-cols-[120px_1fr]"><span className="text-gray-500">Contact</span><span className="font-medium text-gray-900">{ct?.name || "Sneha Kulkarni"} {ct?.role ? `(${ct.role})` : ""}</span></div>
          <div className="grid grid-cols-[120px_1fr]"><span className="text-gray-500">Payment terms</span><span className="font-medium text-gray-900">{client?.terms || "100% advance"}</span></div>
          <div className="grid grid-cols-[120px_1fr] items-start"><span className="text-gray-500">Billing address</span><span className="font-medium text-gray-900">{client?.billing || "Unit 402, Kanakia Wall Street, Andheri East, Mumbai 400093"}</span></div>
          <div className="grid grid-cols-[120px_1fr]"><span className="text-gray-500">Outstanding</span><span className="font-medium text-gray-900">{client?.overdue ? `₹${client.overdue} overdue` : "Clear"}</span></div>
          <div className="grid grid-cols-[120px_1fr]"><span className="text-gray-500">Jobs in progress</span><span className="font-medium text-gray-900">None</span></div>
          <div className="grid grid-cols-[120px_1fr]"><span className="text-gray-500">Enquiry win rate</span><span className="font-medium text-gray-900">78% (7 of 9)</span></div>
          <div className="grid grid-cols-[120px_1fr]"><span className="text-gray-500">Came in via</span><span className="font-medium text-gray-900">{e.origin || "WhatsApp"}</span></div>
          <div className="grid grid-cols-[120px_1fr]"><span className="text-gray-500">Client reference</span><span className="font-medium text-gray-900">{refNo}</span></div>
        </div>

        {/* Requirement Section */}
        <h3 className="text-lg font-black text-gray-900 mb-4">Requirement</h3>
        <div className="grid grid-cols-2 gap-y-3 gap-x-8 text-sm mb-8 border-b border-gray-100 pb-8">
          <div className="grid grid-cols-[120px_1fr]"><span className="text-gray-500">Product / theme</span><span className="font-medium text-gray-900">{e.theme || "cdscsdc"}</span></div>
          <div className="grid grid-cols-[120px_1fr]"><span className="text-gray-500">Type</span><span className="font-medium text-gray-900">{e.type || "Plaque"}</span></div>
          <div className="grid grid-cols-[120px_1fr]"><span className="text-gray-500">Occasion</span><span className="font-medium text-gray-900">{e.occ || "Sales contest"}</span></div>
          <div className="grid grid-cols-[120px_1fr]"><span className="text-gray-500">Event</span><span className="font-medium text-gray-900">{e.evt || "Sat, 31 Oct"}</span></div>
          <div className="grid grid-cols-[120px_1fr]"><span className="text-gray-500">Quantity</span><span className="font-medium text-gray-900">{e.qty || 100} pcs</span></div>
          <div className="grid grid-cols-[120px_1fr]"><span className="text-gray-500">Size (height)</span><span className="font-medium text-gray-900">{e.size || 8} in</span></div>
          <div className="grid grid-cols-[120px_1fr]"><span className="text-gray-500">Material</span><span className="font-medium text-gray-900">{e.mat || "Fusion: Resin + Glass"}</span></div>
          <div className="grid grid-cols-[120px_1fr]"><span className="text-gray-500">Client target rate</span><span className="font-medium text-gray-900">₹{e.target || 960} per pc</span></div>
          <div className="grid grid-cols-[120px_1fr]"><span className="text-gray-500">Spec estimate</span><span className="font-medium text-gray-900">≈ ₹{e.target || 960} per pc</span></div>
          <div className="grid grid-cols-[120px_1fr]"><span className="text-gray-500">Target vs spec</span><span className="font-medium text-gray-900">Fits</span></div>
          <div className="grid grid-cols-[120px_1fr] col-span-2 mt-2"><span className="text-gray-500">Indicative value</span><span className="font-medium text-gray-900">₹{((e.target || 960) * (e.qty || 100)).toLocaleString('en-IN')} at target rate</span></div>
        </div>

        {/* Brief and design Section */}
        <h3 className="text-lg font-black text-gray-900 mb-4">Brief and design</h3>
        <div className="p-4 border border-indigo-100 bg-indigo-50/30 rounded-lg text-sm text-gray-800 mb-6 font-medium">
          {e.globalBrief || e.productBriefs?.[e.theme]?.brief || "fdsgfdfgfgsfcacasc"}
        </div>
        
        <div className="grid grid-cols-2 gap-y-3 gap-x-8 text-sm mb-6 border-b border-gray-100 pb-8">
          <div className="grid grid-cols-[120px_1fr]"><span className="text-gray-500">Designer needed</span><span className="font-medium text-gray-900">{e.designer !== false ? "Yes" : "No"}</span></div>
          <div className="grid grid-cols-[120px_1fr]"><span className="text-gray-500">Design options</span><span className="font-medium text-gray-900">{e.designOptions || 3}, due in {e.optionsDueIn || 24} hours</span></div>
          <div className="grid grid-cols-[120px_1fr]"><span className="text-gray-500">Quote only</span><span className="font-medium text-gray-900">{e.quoteOnly ? "Yes" : "No"}</span></div>
          <div className="grid grid-cols-[120px_1fr] items-start"><span className="text-gray-500">Show RD logo / content</span><span className="font-medium text-gray-900">{e.showRDLogo ? "Logo" : "No logo"} · {e.showRDContent ? "Content" : "No content"}</span></div>
        </div>

        {/* Attached Design Options & References */}
        <div className="mb-8 border-b border-gray-100 pb-8">
          <div className="grid grid-cols-[140px_1fr] text-sm mb-4">
            <span className="text-gray-500 font-medium">Design options</span>
            <span className="font-semibold text-gray-900">
              {designImageUrls.length > 0 ? `${designImageUrls.length} option image(s) attached` : "No design images attached"}
            </span>
          </div>

          {designImageUrls.length > 0 ? (
            <div className="flex flex-wrap gap-4 mb-4">
              {Object.entries(allUploadedDesigns).map(([k, imgUrl]) => {
                if (!imgUrl) return null;
                const parts = k.split("-");
                const optNum = parts.length > 1 ? Number(parts[1]) + 1 : 1;
                return (
                  <div key={k} className="flex flex-col items-center">
                    <div className="w-24 h-24 rounded-lg border border-gray-200 bg-white p-1 overflow-hidden shadow-2xs flex items-center justify-center">
                      <img src={imgUrl} alt={`Option ${optNum}`} className="w-full h-full object-contain" />
                    </div>
                    <span className="text-[10px] font-bold text-gray-700 mt-1 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                      Option {optNum}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : Array.isArray(e.globalRefs) && e.globalRefs.length > 0 ? (
            <div className="flex flex-wrap gap-4 mb-4">
              {e.globalRefs.map((ref, idx) => (
                <div key={idx} className="w-20 h-20 rounded-lg border border-gray-200 bg-white p-1 overflow-hidden shadow-2xs flex items-center justify-center">
                  <img src={ref.dataUrl || ref.url || ref} alt={`Ref ${idx + 1}`} className="w-full h-full object-contain" />
                </div>
              ))}
            </div>
          ) : null}

          {/* Proof of Confirmation if available */}
          {(s?.decision?.attachment || s?.proofFile) && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <span className="text-xs font-bold text-indigo-900 block mb-2">Confirmation / PO Proof Document</span>
              <div className="flex items-center gap-3">
                {typeof s.decision?.attachment === "string" || s.decision?.attachment?.url ? (
                  <div className="w-20 h-20 rounded-lg border border-gray-200 bg-white p-1 overflow-hidden shadow-2xs flex items-center justify-center">
                    <img src={s.decision.attachment?.url || s.decision.attachment} alt="Confirmation Proof" className="w-full h-full object-contain" />
                  </div>
                ) : null}
                <div className="text-xs text-gray-700">
                  <p className="font-semibold">{s.decision?.whoConfirmed || "Client Confirmation"}</p>
                  <p className="text-[11px] text-gray-500">Method: {s.decision?.method || "Verified"} {s.decision?.date ? `· ${s.decision.date}` : ""}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Timeline Section */}
        <h3 className="text-lg font-black text-gray-900 mb-4">Timeline</h3>
        <div className="text-sm border-b border-gray-100 pb-12 mb-12">
          <div className="grid grid-cols-[150px_1fr] py-3 border-b border-gray-50">
            <span className="text-gray-500">Enquiry logged</span>
            <span className="font-medium text-gray-900">{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}, {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div className="grid grid-cols-[150px_1fr] py-3 border-b border-gray-50">
            <span className="text-gray-500">{e.designOptions || 3} design options</span>
            <span className="font-medium text-gray-900">{s.optionsShared ? "Shared with client" : `Due in ${e.optionsDueIn || 24} hours`}</span>
          </div>
          <div className="grid grid-cols-[150px_1fr] py-3 border-b border-gray-50">
            <span className="text-gray-500">Costing</span>
            <span className="font-medium text-gray-900">
              {s.costing 
                ? `BOM v1 · ${s.costing.lines ? s.costing.lines.map(l => `${inr(l.rate)}/pc`).join(', ') : `${inr(s.costing.rate || 1210)}/pc`}` 
                : "Pending"}
            </span>
          </div>
          <div className="grid grid-cols-[150px_1fr] py-3">
            <span className="text-gray-500">Client decision</span>
            <span className="font-medium text-gray-900">{s.decision ? s.decision : "Pending"}</span>
          </div>
        </div>

        {/* Footer Signatures */}
        <div className="grid grid-cols-3 gap-8 mb-8">
          <div className="border-t border-gray-400 pt-2 text-[10px] text-gray-500 text-center font-medium">CS executive</div>
          <div className="border-t border-gray-400 pt-2 text-[10px] text-gray-500 text-center font-medium">Coordinator ({s.coordinator || currentUser.name})</div>
          <div className="border-t border-gray-400 pt-2 text-[10px] text-gray-500 text-center font-medium">Costing</div>
        </div>

        <div className="text-[9px] text-gray-400 text-center pb-8">
          Generated from RD Command Centre: {ids?.enq || `RD${s?.seq || 21071}`} · job number carries through sample ({ids?.s || `RD/S/${s?.seq || 21071}`}) and production ({ids?.p || `RD/P/${s?.seq || 21071}`})
        </div>

      </div>

      <div className="w-full max-w-4xl mx-auto mt-2 mb-8 print:hidden">
        <button 
          onClick={() => setShowPrint(false)}
          className="px-4 py-2 border border-indigo-200 bg-white text-indigo-700 rounded-lg text-sm font-semibold hover:bg-indigo-50 shadow-sm"
        >
          ← Back to the job
        </button>
      </div>
      
      {/* Utility to ensure correct printing styles */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          .print\\:hidden { display: none !important; }
          .fixed { position: absolute !important; }
          .fixed > div:nth-child(2) { visibility: visible; position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; box-shadow: none; border: none; }
          .fixed > div:nth-child(2) * { visibility: visible; }
        }
      `}} />
    </div>
  );
};

export default PrintEnquiryLog;
