import React, { useState, useRef, useEffect } from "react";
import { contactsOf } from "../../utils/helpers";
import { useDispatch } from "react-redux";
import { toast } from "react-toastify";
import { useLoader } from "../../../../context/LoaderContext";
import { axiosInstance, backendUrl } from "../../../../utils/url/config";
import { sendEnquiryMail } from "../../../../reducer/enquiryReducer";

const SendDocumentOverlay = ({ s, client, onClose, onSend, children }) => {
  const docSheetRef = useRef(null);
  const allContacts = contactsOf(client, s);
  const contactsList = allContacts.length > 0 ? allContacts : [
    { id: "c1", name: client?.contact || client?.name || "Vikas Rao", role: "Sales ops", phone: client?.mobile || "9820055123", email: client?.email || "vikas.rao@meridianpharma.example" },
    { id: "c2", name: "Lata Pillai", role: "Events", phone: "9820055124", email: "lata.pillai@meridianpharma.example" }
  ];

  const [activeContactId, setActiveContactId] = useState(s?.contactId || contactsList[0]?.id);
  const selectedContact = contactsList.find((c) => c.id === activeContactId) || contactsList[0];

  const contactName = selectedContact?.name || "Client Name";
  const contactRole = selectedContact?.role || "";
  const rawPhone = String(selectedContact?.phone || selectedContact?.mobile || "");
  const [inputPhone, setInputPhone] = useState(() => rawPhone.replace(/\+91/g, "").trim());
  const [inputEmail, setInputEmail] = useState(() => String(selectedContact?.email || ""));

  const dispatch = useDispatch();
  const { showLoader, hideLoader } = useLoader();

  const handleAction = (channel = "WhatsApp") => {
    if (onSend) onSend(channel);
    if (onClose) onClose();
  };

  const handlePrint = () => {
    if (!docSheetRef.current) {
      window.print();
      return;
    }

    // Remove any previous temporary print iframe
    const oldIframe = document.getElementById("rdca-print-frame");
    if (oldIframe) oldIframe.remove();

    const iframe = document.createElement("iframe");
    iframe.id = "rdca-print-frame";
    // Off-screen but fully rendered dimensions (1024px width ensures responsive desktop print styling)
    iframe.style.position = "fixed";
    iframe.style.left = "-10000px";
    iframe.style.top = "0";
    iframe.style.width = "1024px";
    iframe.style.height = "100%";
    iframe.style.border = "none";
    iframe.style.zIndex = "-9999";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;

    // Collect all stylesheet links and style tags, excluding the native fallback style to avoid conflicts
    const headStyles = Array.from(
      document.querySelectorAll("link[rel='stylesheet'], style:not(#rdca-native-print-style)")
    )
      .map((el) => el.outerHTML)
      .join("\n");

    const contentHtml = docSheetRef.current.innerHTML;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${client?.name || "Document"} - ${s?.enquiry_no || s?.seq || "Print"}</title>
          ${headStyles}
          <style>
            @page {
              size: A4 portrait;
              margin: 18mm 12mm 16mm 12mm;
            }
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              box-sizing: border-box !important;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              color: #111827 !important;
              width: 100% !important;
              height: auto !important;
              font-family: inherit;
            }
            .print-isolated-sheet {
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .print-isolated-sheet > div,
            .print-isolated-sheet > article,
            .print-content {
              box-shadow: none !important;
              border: none !important;
              margin: 0 auto !important;
              width: 100% !important;
              max-width: 100% !important;
              padding: 0 !important;
            }
            img {
              max-width: 100% !important;
              page-break-inside: avoid;
            }
            table {
              width: 100% !important;
              border-collapse: collapse !important;
            }
            thead {
              display: table-header-group !important;
            }
            tr {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .print-break-inside-avoid,
            .avoid-break {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .print\\:hidden, .print-hidden {
              display: none !important;
            }
          </style>
        </head>
        <body>
          <div class="print-isolated-sheet">
            ${contentHtml}
          </div>
        </body>
      </html>
    `);
    doc.close();

    const images = iframe.contentWindow.document.images;
    let loaded = 0;
    const total = images.length;

    const doPrint = () => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (err) {
        console.error("Print frame error:", err);
        window.print();
      }
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 5000);
    };

    if (total === 0) {
      setTimeout(doPrint, 250);
    } else {
      let fired = false;
      const onDone = () => {
        loaded++;
        if (loaded >= total && !fired) {
          fired = true;
          setTimeout(doPrint, 200);
        }
      };

      for (let i = 0; i < total; i++) {
        if (images[i].complete) {
          loaded++;
        } else {
          images[i].onload = onDone;
          images[i].onerror = onDone;
        }
      }

      if (loaded >= total && !fired) {
        fired = true;
        setTimeout(doPrint, 200);
      } else {
        setTimeout(() => {
          if (!fired) {
            fired = true;
            doPrint();
          }
        }, 1200);
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEmailClick = async (e) => {
    if (e?.currentTarget) e.currentTarget.disabled = true;
    showLoader();
    try {
      const enquiryId = s?.id || s?._id || "dummy_id";
      const result = await dispatch(sendEnquiryMail(enquiryId));
      if (result.payload?.success) toast.success("Mail sent successfully!");
      else toast.error(result.payload?.message || "Unable to send mail");
    } catch (error) {
      toast.error("Server error while sending mail");
    } finally {
      hideLoader();
      handleAction("Email");
    }
  };

  const handleWhatsAppClick = async (e) => {
    if (e?.currentTarget) e.currentTarget.disabled = true;
    showLoader();
    try {
      const response = await axiosInstance.post(`${backendUrl}/enquiry/send-enquiry-template`, {
        phone_number: String(inputPhone || '').replace(/\D/g, ''),
        values: {
          "1": `Design Options for Approval`,
          "2": contactName,
          "3": "Please review the attached options",
          "4": "",
          "5": ""
        }
      });
      if (response.data.success) {
        toast.success("WhatsApp message sent successfully!");
      } else {
        toast.error(response.data.message || "Failed to send WhatsApp message");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Server error while sending WhatsApp");
    } finally {
      hideLoader();
      handleAction("WhatsApp");
    }
  };

  return (
    <div className="rdca-document-overlay fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm overflow-y-auto p-4 sm:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl mx-auto flex items-center mb-4 print:hidden">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-xl text-xs font-bold hover:bg-gray-50 shadow-2xs flex items-center gap-2 cursor-pointer"
        >
          ← Back to the job
        </button>
        <span className="text-xs text-gray-400 ml-4 hidden sm:block">
          Pick who receives it, check their mobile and email, then send.
        </span>
      </div>

      {/* Action Card matching Screenshot */}
      <div className="w-full max-w-4xl mx-auto bg-white border border-gray-200/90 shadow-sm p-6 rounded-2xl mb-6 print:hidden">
        <div className="mb-4">
          <p className="text-xs font-bold text-gray-700 mb-2">Send to</p>
          <div className="flex flex-wrap gap-2 items-center">
            {contactsList.map((c) => {
              const isSel = c.id === activeContactId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setActiveContactId(c.id);
                    setInputPhone(String(c.phone || c.mobile || "").replace('+91', '').trim());
                    setInputEmail(String(c.email || ""));
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${isSel
                    ? "bg-indigo-600 text-white shadow-2xs"
                    : "bg-white text-gray-700 border border-gray-200 hover:border-gray-300"
                    }`}
                >
                  <span>{c.name}</span>
                  {c.role && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded ${isSel ? "bg-indigo-700/60 text-white" : "text-gray-400"}`}>
                      {c.role}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Mobile / WhatsApp</label>
            <div className="flex w-full border border-gray-200 rounded-xl overflow-hidden focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition">
              <span className="bg-gray-50 border-r border-gray-200 px-3 py-2 text-xs text-gray-500 font-medium">+91</span>
              <input
                type="text"
                className="w-full px-3 py-2 text-xs text-gray-900 outline-none font-medium"
                value={inputPhone}
                onChange={(e) => setInputPhone(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Email</label>
            <input
              type="email"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition font-medium"
              value={inputEmail}
              onChange={(e) => setInputEmail(e.target.value)}
            />
          </div>
        </div>

        <button type="button" className="text-xs font-bold text-indigo-600 hover:text-indigo-700 mb-5 cursor-pointer block">
          + Add another contact
        </button>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleEmailClick}
            disabled={!inputEmail.trim()}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer ${!inputEmail.trim()
              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
              : "bg-indigo-600 text-white hover:bg-indigo-700"
              }`}
          >
            Email {contactName.split(' ')[0]}
          </button>
          <button
            type="button"
            onClick={handleWhatsAppClick}
            disabled={!inputPhone.trim()}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer ${!inputPhone.trim()
              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
              : "bg-emerald-600 text-white hover:bg-emerald-700"
              }`}
          >
            WhatsApp
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2.5 bg-white text-gray-700 border border-gray-200 rounded-xl text-xs font-bold hover:bg-gray-50 transition shadow-2xs cursor-pointer ml-auto"
          >
            Print / PDF
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-3">
          Email and WhatsApp open with the message already written. Ctrl+P prints only the document below.
        </p>
      </div>

      {/* Embedded Document Sheet */}
      <div ref={docSheetRef} className="rdca-document-sheet print-content w-full flex justify-center">
        {children}
      </div>

      {/* Bottom Back Button matching Screenshot */}
      <div className="w-full max-w-4xl mx-auto flex items-center justify-start mt-2 mb-8 print:hidden">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-xl text-xs font-bold hover:bg-gray-50 shadow-2xs flex items-center gap-2 cursor-pointer"
        >
          ← Back to the job
        </button>
      </div>
      {/* Utility to ensure correct printing styles for native print fallback */}
      <style id="rdca-native-print-style" dangerouslySetInnerHTML={{
        __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 18mm 12mm 16mm 12mm;
          }
          html, body {
            overflow: visible !important;
            height: auto !important;
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body > * { 
            visibility: hidden !important; 
          }
          .print\\:hidden, .print-hidden { 
            display: none !important; 
          }
          .rdca-document-overlay { 
            visibility: visible !important;
            position: static !important; 
            display: block !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            padding: 0 !important; 
            margin: 0 !important; 
            background: #ffffff !important;
            backdrop-filter: none !important;
            z-index: auto !important;
            overflow: visible !important;
          }
          .rdca-document-overlay * { 
            visibility: visible !important; 
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .rdca-document-sheet { 
            width: 100% !important; 
            max-width: 100% !important; 
            margin: 0 !important; 
            padding: 0 !important; 
            box-shadow: none !important; 
            border: none !important;
          }
          .rdca-document-sheet > div,
          .rdca-document-sheet > article,
          .print-content {
            box-shadow: none !important;
            border: none !important;
            margin: 0 auto !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
          }
          img {
            max-width: 100% !important;
            page-break-inside: avoid;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          thead {
            display: table-header-group !important;
          }
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .print-break-inside-avoid,
          .avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}} />
    </div>
  );
};

export default SendDocumentOverlay;
