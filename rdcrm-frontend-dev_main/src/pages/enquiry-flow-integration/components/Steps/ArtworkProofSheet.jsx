import React from "react";
import { contactsOf, digits, getProductDesignImage, getAllProductPreviews, formatEnquiryNo, ENQUIRY_CONFIG, formatAddress } from "../../utils/helpers";
import SendDocumentOverlay from "../common/SendDocumentOverlay";

const ArtworkProofSheet = ({
  s,
  set,
  client,
  job,
  ids = {},
  phase = "sample",
  dtpProofData = null,
  onBack,
  onMarkSent
}) => {
  const d = s?.dtp?.[phase] || {};
  const round = d.round || 1;
  const isS = phase === "sample";

  const masterFiles = dtpProofData?.master_template_files || [];
  const contentFiles = dtpProofData?.content_proofing_files || [];
  const artistName = dtpProofData?.assigned_to_name || "DTP Artist";

  // Compute job number formats as planned in flow: RD21071 and RD21071-A1
  const parentJobNo = s?.seq
    ? formatEnquiryNo(s.seq)
    : (ids?.enq?.startsWith("RD") ? ids.enq : ids?.enq?.replace("ENQ/26/", "RD")) || ENQUIRY_CONFIG.DEFAULT_ENQUIRY_NO;

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
  const contentFileUrl =
    d.content?.file_url ||
    d.content?.signed_url ||
    d.content?.raw_url ||
    contentFiles[0]?.file_url ||
    dtpProofData?.cs_uploaded_content?.file_url ||
    dtpProofData?.content_file_url ||
    null;

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
      docType="proof"
      phase={phase}
      mode={phase}
      subJobNos={[subJobCode]}
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
              {(s.billTo?.on && s.billTo.name) ? s.billTo.name : (client?.name || "Client Name Ltd")}<br />
              {(s.billTo?.on && s.billTo.address) ? formatAddress(s.billTo.address) : (formatAddress(client?.billing) || formatAddress(client?.address) || "Plot 14, MIDC, Andheri East, Mumbai 400093")}<br />
              GSTIN {(s.billTo?.on && s.billTo.gstin) ? (typeof s.billTo.gstin === "object" ? (s.billTo.gstin?.gst_no || "") : s.billTo.gstin) : (typeof client?.gstin === "object" ? (client.gstin?.gst_no || "") : (client?.gstin || "27AADCM5561H1Z6"))}
            </div>
          </div>
          <div className="grid grid-cols-[80px_1fr] items-start">
            <span className="text-gray-400 font-medium">Attention</span>
            <div className="text-gray-900 font-medium leading-relaxed">
              {(s.billTo?.on && s.billTo.contact?.name) ? s.billTo.contact.name : (selectedContact?.name || "Contact Person")}{" "}
              <span className="font-normal text-gray-500">({selectedContact?.role || "Sales ops"})</span><br />
              {(s.billTo?.on && s.billTo.contact?.email) ? s.billTo.contact.email : (selectedContact?.email || "contact@client.example")}<br />
              +91 {digits((s.billTo?.on && s.billTo.contact?.phone) ? s.billTo.contact.phone : (selectedContact?.phone || selectedContact?.mobile || "9820055123"))}
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
                {artistName && (
                  <tr className="border-b border-gray-100">
                    <td className="py-3 text-gray-400 font-medium w-36">DTP Artist</td>
                    <td className="py-3 font-semibold text-gray-900">{artistName}</td>
                  </tr>
                )}
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
                                {(typeof prod.spec === "string" && prod.spec) ||
                                  prod.specLine ||
                                  prod.spec_line ||
                                  `${(typeof prod.size === "object" ? (prod.size?.trophyH || prod.size?.size) : prod.size) ? (typeof prod.size === "object" ? (prod.size?.trophyH || prod.size?.size) : prod.size) + ' in · ' : ''}${prod.qty} pcs`}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
                {!isS && masterFiles.length > 0 && (
                  <tr className="border-b border-gray-100">
                    <td className="py-3 text-gray-400 font-medium w-36 align-top">
                      Master Proof (DTP)
                    </td>
                    <td className="py-3">
                      {/* Production Stage: Visual layout thumbnails */}
                      <div className="flex flex-wrap gap-3 items-start">
                        {masterFiles.map((m, mIdx) => (
                          <div
                            key={mIdx}
                            className="border border-indigo-200 rounded-xl overflow-hidden bg-slate-50 p-2 max-w-[220px] shadow-2xs group"
                          >
                            <a
                              href={m.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block relative overflow-hidden rounded-lg bg-white"
                            >
                              <img
                                src={m.file_url}
                                alt={`Master Proof ${mIdx + 1}`}
                                className="w-full h-32 object-contain rounded-lg mb-1.5 bg-white group-hover:scale-105 transition"
                              />
                              <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-gray-900/70 text-white text-[9px] rounded font-bold">
                                ↗ Full View
                              </span>
                            </a>
                            <div className="flex items-center justify-between text-[10px] mt-1">
                              <span className="font-bold text-gray-800">Layout Proof #{mIdx + 1}</span>
                              <span
                                className={`px-2 py-0.5 rounded font-black text-[9px] uppercase ${
                                  m.status === "Approved"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-indigo-100 text-indigo-700"
                                }`}
                              >
                                {m.status || "Ready"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
                {!isS && contentFiles.length > 0 && (
                  <tr className="border-b border-gray-100">
                    <td className="py-3 text-gray-400 font-medium w-36 align-top">Content Proof Files</td>
                    <td className="py-3 space-y-1.5">
                      {contentFiles.map((c, cIdx) => (
                        <div
                          key={cIdx}
                          className="flex items-center justify-between gap-3 text-xs bg-slate-50 border border-gray-200 px-3 py-2 rounded-lg max-w-md"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-indigo-600 font-bold">📄</span>
                            <span className="font-semibold text-gray-800 text-[11px] truncate">
                              Content File #{cIdx + 1}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                c.status === "Approved"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {c.status || "Pending"}
                            </span>
                            <a
                              href={c.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-600 font-bold hover:underline text-[11px]"
                            >
                              View ↗
                            </a>
                          </div>
                        </div>
                      ))}
                    </td>
                  </tr>
                )}
                <tr className="border-b border-gray-100">
                  <td className="py-3 text-gray-400 font-medium w-36">Content</td>
                  <td className="py-3 text-gray-800 font-medium">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-1">
                        <span>📎</span>
                        <span>{contentFileName}</span>
                      </span>
                      {contentFileUrl && (
                        <div className="flex items-center gap-2 ml-2">
                          <a
                            href={contentFileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline flex items-center gap-0.5"
                          >
                            <span>👁️</span> View
                          </a>
                          <a
                            href={contentFileUrl}
                            download={d.content?.name || contentFileName || "Content_File"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold text-emerald-600 hover:text-emerald-800 underline flex items-center gap-0.5"
                          >
                            <span>⬇️</span> Download
                          </a>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-3 text-gray-400 font-medium w-36">
                    {isS ? "Sample Proof" : "Proof file"}
                  </td>
                  <td className="py-3 text-indigo-900 font-semibold flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1">
                      <span>📄</span>
                      <span>
                        {d.proofFile?.name ||
                          masterFiles[0]?.original_name ||
                          masterFiles[0]?.name ||
                          (isS ? "Sample_Artwork_Proof_v1.pdf" : "Production_Artwork_Proof_v1.pdf")}
                      </span>
                    </span>
                    {(masterFiles[0]?.status || d.proofFile?.status) && (
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                          (masterFiles[0]?.status || d.proofFile?.status) === "Approved"
                            ? "bg-emerald-100 text-emerald-800"
                            : (masterFiles[0]?.status || d.proofFile?.status) === "Rejected"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-indigo-100 text-indigo-700"
                        }`}
                      >
                        {masterFiles[0]?.status || d.proofFile?.status || "Pending"}
                      </span>
                    )}
                    {(d.proofFile?.file_url || masterFiles[0]?.file_url) && (
                      <div className="flex items-center gap-2 ml-2">
                        <a
                          href={d.proofFile?.file_url || masterFiles[0]?.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline"
                        >
                          👁️ View
                        </a>
                        <a
                          href={d.proofFile?.file_url || masterFiles[0]?.file_url}
                          download={
                            d.proofFile?.name ||
                            masterFiles[0]?.original_name ||
                            masterFiles[0]?.name ||
                            "Sample_Artwork_Proof"
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-bold text-emerald-600 hover:text-emerald-800 underline"
                        >
                          ⬇️ Download
                        </a>
                      </div>
                    )}
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
