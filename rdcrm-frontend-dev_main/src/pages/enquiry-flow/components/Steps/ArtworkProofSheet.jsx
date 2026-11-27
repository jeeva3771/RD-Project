import React from "react";
import { contactsOf, digits, getProductDesignImage, getAllProductPreviews } from "../../utils/helpers";
import SendDocumentOverlay from "../common/SendDocumentOverlay";

const ArtworkProofSheet = ({
  s,
  set,
  client,
  job,
  ids = {},
  phase = "sample",
  onBack,
  onMarkSent
}) => {
  const d = s?.dtp?.[phase] || {};
  const round = d.round || 1;
  const isS = phase === "sample";

  // Compute job number formats as planned in flow: RD21071 and RD21071-A1
  const parentJobNo = s?.seq
    ? String(s.seq).startsWith("RD")
      ? s.seq
      : `RD${s.seq}`
    : (ids?.enq?.startsWith("RD") ? ids.enq : ids?.enq?.replace("ENQ/26/", "RD")) || "RD21071";

  const subJobCode = s?.e?.subJobNo || `${parentJobNo}-A1`;

  const contacts = contactsOf(client, s);
  const selectedContact =
    contacts.find((c) => c.id === s?.contactId) || contacts[0] || {};

  const todayStr = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  const productName = s?.e?.theme || job?.product || "Million Dollar Club Trophy";
  const contentFileName =
    d.content?.name || (d.text ? `Sample text: "${d.text}"` : "Sample Artwork Content");

  // Build earlier corrections text
  const earlierCorrections = (d.corrections || [])
    .map((c) => `Round ${c.round}: ${c.note}`)
    .join(" · ");

  // Derive all products in this order with their images
  const allProducts = getAllProductPreviews(s, s?.e || {}, parentJobNo);

  return (
    <SendDocumentOverlay
      s={s}
      client={client}
      onClose={onBack}
      onSend={(method) => onMarkSent && onMarkSent(method || "WhatsApp")}
    >
      {/* Official Proof Sheet Document */}
      <article className="w-full max-w-4xl mx-auto bg-white shadow-2xl p-8 sm:p-12 rounded-xl mb-8 relative z-10 print-content text-gray-800 text-xs">
        {/* Document Header */}
        <div className="flex justify-between items-start border-b-2 border-indigo-600 pb-4 mb-8">
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">RD Custom Awards Pvt. Ltd.</h2>
            <p className="text-xs text-gray-500 mt-1 font-medium">
              Artwork proof for approval · {isS ? "sample" : "production"}
            </p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-black text-indigo-900 tracking-tight">
              {subJobCode}
            </h2>
            <p className="text-xs text-gray-500 font-semibold mt-0.5">Job: {parentJobNo}</p>
            <p className="text-xs text-gray-400 mt-0.5">{todayStr}</p>
          </div>
        </div>

        {/* To & Attention Grid */}
        <div className="grid grid-cols-2 gap-12 text-xs mb-8">
          <div className="grid grid-cols-[80px_1fr] items-start">
            <span className="text-gray-400 font-medium">To</span>
            <div className="text-gray-900 font-medium leading-relaxed">
              {client?.name || "Client Name Ltd"}<br />
              {client?.billing || "Plot 14, MIDC, Andheri East, Mumbai 400093"}<br />
              GSTIN {client?.gstin || "27AADCM5561H1Z6"}
            </div>
          </div>
          <div className="grid grid-cols-[80px_1fr] items-start">
            <span className="text-gray-400 font-medium">Attention</span>
            <div className="text-gray-900 font-medium leading-relaxed">
              {selectedContact?.name || "Contact Person"}{" "}
              <span className="font-normal text-gray-500">({selectedContact?.role || "Sales ops"})</span><br />
              {selectedContact?.email || "contact@client.example"}<br />
              +91 {digits(selectedContact?.phone || selectedContact?.mobile || "9820055123")}
            </div>
          </div>
        </div>

        {/* Section: Artwork proof round */}
        <div className="pt-4 border-t border-gray-100 space-y-4 mb-8">
          <h3 className="text-sm font-bold text-gray-900">
            Artwork proof · round {round}
          </h3>

          <div className="border-t border-gray-200">
            <table className="w-full text-xs text-left">
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-3 text-gray-400 font-medium w-36">Job / Sub-job</td>
                  <td className="py-3 font-semibold text-gray-900">{parentJobNo} · {subJobCode}</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-3 text-gray-400 font-medium w-36">For</td>
                  <td className="py-3 font-semibold text-gray-900">{isS ? "Sample piece" : "Production run"} · {productName}</td>
                </tr>
                {allProducts.some((p) => p.imgUrl) && (
                  <tr className="border-b border-gray-100">
                    <td className="py-3 text-gray-400 font-medium w-36 align-top">Product preview</td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-3 items-start">
                        {allProducts.filter((p) => Boolean(p.imgUrl)).map((prod, pIdx) => (
                          <div
                            key={prod.subJobNo || pIdx}
                            className="flex items-center gap-3 p-2.5 rounded-xl border border-gray-200 bg-white shadow-2xs max-w-sm"
                          >
                            <div className="w-16 h-16 rounded-lg border border-gray-200 overflow-hidden bg-white shrink-0 p-0.5 shadow-2xs">
                              <img
                                src={prod.imgUrl}
                                alt={prod.theme || "Trophy"}
                                className="w-full h-full object-cover rounded"
                              />
                            </div>
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
                )}
                <tr className="border-b border-gray-100">
                  <td className="py-3 text-gray-400 font-medium w-36">Content</td>
                  <td className="py-3 text-gray-800 font-medium">{contentFileName}</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-3 text-gray-400 font-medium w-36">Proof file</td>
                  <td className="py-3 text-indigo-900 font-semibold flex items-center gap-1.5">
                    <span>📄</span>
                    <span>{d.proofFile?.name || (isS ? "Sample_Artwork_Proof_v1.pdf" : "Production_Artwork_Proof_v1.pdf")}</span>
                  </td>
                </tr>
                {earlierCorrections && (
                  <tr className="border-b border-gray-100">
                    <td className="py-3 text-gray-400 font-medium w-36">Corrections made</td>
                    <td className="py-3 text-gray-800 font-medium">{earlierCorrections}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Callout Boxes */}
          <div className="space-y-3 pt-3">
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 leading-relaxed">
              The proof files are attached with this message. Please check every name, spelling, logo and layout, then reply to approve or list corrections.
            </div>
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 leading-relaxed">
              Please check the details and reply within 24 hours if anything needs to change.
            </div>
          </div>
        </div>

        {/* Signature Lines & Document Footer */}
        <div className="print-break-inside-avoid print:pt-4">
          <div className="grid grid-cols-3 gap-8 pt-8 pb-2 text-xs text-gray-500">
            <div>
              <div className="border-t border-gray-900 mb-2"></div>
              For RD Custom Awards Pvt. Ltd.
            </div>
            <div>
              <div className="border-t border-gray-900 mb-2"></div>
              Coordinator
            </div>
            <div>
              <div className="border-t border-gray-900 mb-2"></div>
              Client acceptance
            </div>
          </div>

          <div className="pt-6 print:pt-3 text-center text-[10px] text-gray-400">
            {subJobCode} · Job reference since enquiry {parentJobNo}
          </div>
        </div>
      </article>
    </SendDocumentOverlay>
  );
};

export default ArtworkProofSheet;
