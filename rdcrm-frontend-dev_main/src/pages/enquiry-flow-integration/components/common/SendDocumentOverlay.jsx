import React, { useState, useRef, useEffect } from "react";
import { contactsOf } from "../../utils/helpers";
import { formatEnquiryNo, ENQUIRY_CONFIG } from "../../utils/constants";
import { useDispatch } from "react-redux";
import { toast } from "react-toastify";
import { useLoader } from "../../../../context/LoaderContext";
import { axiosInstance, backendUrl } from "../../../../utils/url/config";
import { sendEnquiryMail } from "../../../../reducer/enquiryReducer";

const SendDocumentOverlay = ({
  s,
  client,
  onClose,
  onSend,
  docType = "design",
  subJobNos = [],
  totalAmount = 0,
  selectedItems = [],
  mode,
  round,
  phase,
  children
}) => {
  const isPP = mode === "pre_production" || (mode !== "sample" && s?.mode === "production" && Boolean(s?.pp || s?.ppAfter));
  const sampleRound = round || s?.round || 1;
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
  const [signedLink, setSignedLink] = useState("");
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const dispatch = useDispatch();
  const { showLoader, hideLoader } = useLoader();

  useEffect(() => {
    let isCancelled = false;
    const fetchSignedLink = async () => {
      try {
        const targetJobId = String(s?.dbJobId || s?._id || s?.rawJob?._id || s?.id || s?.seq || "");
        if (!targetJobId) return;
        const durationHours = Number(s?.e?.links_duration) || 24;
        const subjobsStr = Array.isArray(subJobNos) && subJobNos.length > 0 ? subJobNos.join(",") : "";
        const tab = docType === "delivery" ? "delivery" : (docType === "sample" ? "sample" : (docType === "proof" ? "proof" : (docType === "sample_proof" ? "sample_proof" : (docType === "pi" || docType === "proforma" ? "proforma" : ""))));
        const res = await axiosInstance.get(`/enquiry-flow-integration/${targetJobId}/public-link`, {
          params: {
            duration: durationHours,
            docType,
            type: docType,
            tab,
            subjobs: subjobsStr,
            mode: isPP ? "pre_production" : "sample",
            phase: phase || (s?.step >= 4 ? "production" : "sample"),
          },
        });
        if (!isCancelled && (res.data?.url || res.data?.link)) {
          setSignedLink(res.data.url || res.data.link);
        }
      } catch (err) {
        console.warn("Could not fetch signed link from backend:", err);
      }
    };
    fetchSignedLink();
    return () => {
      isCancelled = true;
    };
  }, [s?.dbJobId, s?._id, s?.rawJob?._id, s?.id, s?.seq, s?.step, s?.e?.links_duration, docType, subJobNos, isPP, phase]);

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

  const generateClientLink = () => {
    if (signedLink) return signedLink;
    const durationHours = Number(s?.e?.links_duration) || 24;
    const expiryTimestamp = Date.now() + durationHours * 60 * 60 * 1000;
    const encodedExpiry = btoa(expiryTimestamp.toString());
    const targetJobId = String(s?.dbJobId || s?._id || s?.rawJob?._id || s?.id || s?.seq || "");
    const isPi = docType === "pi" || docType === "proforma";
    const isSampleProof = docType === "sample_proof";
    if (isSampleProof) {
      return `${window.location.origin}/rd/sample-proof/${targetJobId}?mode=${isPP ? "pre_production" : "sample"}&exp=${encodedExpiry}`;
    }
    const routeSegment = isPi ? "proforma-view" : ((docType === "quote" || docType === "delivery" || docType === "sample" || docType === "proof") ? "quote-view" : "design-view");
    let url = `${window.location.origin}/rd/${routeSegment}/${targetJobId}?exp=${encodedExpiry}`;
    if (docType === "delivery") {
      url += `&tab=delivery`;
    } else if (docType === "sample") {
      url += `&tab=sample`;
      if (Array.isArray(subJobNos) && subJobNos.length > 0) {
        url += `&subjobs=${encodeURIComponent(subJobNos.join(","))}`;
      }
    } else if (docType === "proof") {
      url += `&tab=proof`;
      if (Array.isArray(subJobNos) && subJobNos.length > 0) {
        url += `&subjobs=${encodeURIComponent(subJobNos.join(","))}`;
      }
      const isSampleProof = Boolean(
        s?.is_sample ||
        s?.phase === "sample" ||
        s?.dtpPhase === "sample" ||
        s?.e?.order_type === "sample" ||
        s?.job_type === "sample" ||
        s?.rawJob?.order_type === "sample"
      );
      if (isSampleProof) {
        url += `&phase=sample`;
      } else {
        url += `&phase=production`;
      }
    } else if (Array.isArray(subJobNos) && subJobNos.length > 0) {
      url += `&subjobs=${encodeURIComponent(subJobNos.join(","))}`;
    }
    return url;
  };

  const handleEmailClick = async (e) => {
    if (isSendingEmail) return;

    if (!inputEmail.trim()) {
      toast.error("Please enter a valid email address");
      return;
    }

    if (e?.currentTarget) e.currentTarget.disabled = true;
    setIsSendingEmail(true);
    showLoader();
    try {
      const targetJobId = String(s?.dbJobId || s?._id || s?.rawJob?._id || s?.id || s?.seq || "");
      const clientLink = signedLink || undefined;

      if (docType === "quote") {
        const response = await axiosInstance.post(`/enquiry-flow-integration/${targetJobId}/quote-mail`, {
          to_email: inputEmail.trim(),
          client_link: clientLink,
          contact_name: contactName,
          duration: s?.e?.links_duration || 24,
          subJobNos: subJobNos,
        });

        if (response.data?.success) {
          toast.success(response.data.message || `Quotation email sent successfully to ${inputEmail.trim()}!`);
        } else {
          toast.error(response.data?.message || "Unable to send quote email");
        }
      } else if (docType === "delivery") {
        const response = await axiosInstance.post(`/enquiry-flow-integration/${targetJobId}/delivery-mail`, {
          to_email: inputEmail.trim(),
          client_link: clientLink,
          contact_name: contactName,
          duration: s?.e?.links_duration || 24,
          carrier: s?.sampleCarrier || s?.delivCarrier || s?.carrier || "Tempo",
          chargesAmount: Number(s?.sampleChargesAmount || s?.chargesAmount || totalAmount || 0),
          isClientPayer: Boolean(s?.sampleFreight === 'Client pays freight' || s?.delivPayer === 'client' || s?.payer === 'client'),
          destination: s?.sampleShipTo || s?.shipTo || (client?.name ? `${client.name} office` : "Destination"),
        });

        if (response.data?.success) {
          toast.success(response.data.message || `Delivery charges email sent successfully to ${inputEmail.trim()}!`);
        } else {
          toast.error(response.data?.message || "Unable to send delivery email");
        }
      } else if (docType === "sample") {
        const response = await axiosInstance.post(`/enquiry-flow-integration/${targetJobId}/sample-mail`, {
          to_email: inputEmail.trim(),
          client_link: clientLink,
          contact_name: contactName,
          duration: s?.e?.links_duration || 24,
          subJobNos: subJobNos,
          selectedItems: selectedItems,
          totalAmount: totalAmount,
          charge: s?.charge || "charge",
          gstRate: s?.sampleGst !== undefined ? Number(s.sampleGst) : 18,
          carrier: s?.sampleCarrier || s?.carrier || "Our vehicle",
          destination: s?.sampleShipTo || s?.shipTo || (client?.name ? `${client.name} office` : "Destination"),
        });

        if (response.data?.success) {
          toast.success(response.data.message || `Sample confirmation email sent successfully to ${inputEmail.trim()}!`);
        } else {
          toast.error(response.data?.message || "Unable to send sample confirmation email");
        }
      } else if (docType === "sample_proof") {
        const response = await axiosInstance.post(`/enquiry-flow-integration/${targetJobId}/sample-proof-mail`, {
          to_email: inputEmail.trim(),
          client_link: clientLink,
          contact_name: contactName,
          duration: s?.e?.links_duration || 48,
          mode: isPP ? "pre_production" : "sample",
          notes: isPP
            ? "Kindly inspect the attached photos and video clip of the pre-production sample piece."
            : `Kindly inspect the attached photos and video clip of the Sample v${sampleRound} production piece.`,
        });

        if (response.data?.success) {
          toast.success(
            response.data.message ||
            (isPP
              ? `Pre-production sample proof email sent successfully to ${inputEmail.trim()}!`
              : `Sample v${sampleRound} production proof email sent successfully to ${inputEmail.trim()}!`)
          );
        } else {
          toast.error(response.data?.message || `Unable to send ${isPP ? "pre-production" : "sample"} proof email`);
        }
      } else if (docType === "proof") {
        const explicitPhase = String(
          phase || mode || s?.phase || s?.dtpPhase || ""
        ).trim().toLowerCase();

        const isProductionPhase = Boolean(
          explicitPhase === "production" ||
          explicitPhase === "prod" ||
          s?.step >= 4 ||
          s?.rawJob?.step >= 4 ||
          s?.currentPhase === "production" ||
          s?.activeTab === "production"
        );

        const isSampleProof = !isProductionPhase && Boolean(
          explicitPhase === "sample" ||
          s?.is_sample ||
          s?.step === 2 ||
          (s?.e?.order_type === "sample" && !s?.step)
        );

        const response = await axiosInstance.post(`/enquiry-flow-integration/${targetJobId}/share-dtp-proof`, {
          channel: "email",
          recipient: inputEmail.trim(),
          subJobNo: subJobNos[0] || undefined,
          duration: s?.e?.links_duration || 48,
          phase: isSampleProof ? "sample" : "production",
        });

        if (response.data?.success) {
          toast.success(response.data.message || `Artwork proof email sent successfully to ${inputEmail.trim()}!`);
        } else {
          toast.error(response.data?.message || "Unable to send proof email");
        }
      } else if (docType === "pi" || docType === "proforma") {
        const response = await axiosInstance.post(`/enquiry-flow-integration/${targetJobId}/proforma-mail`, {
          to_email: inputEmail.trim(),
          client_link: clientLink,
          contact_name: contactName,
          duration: s?.e?.links_duration || 24,
          subJobNos: subJobNos,
          totalAmount: totalAmount,
        });

        if (response.data?.success) {
          toast.success(response.data.message || `Official Proforma Invoice email sent successfully to ${inputEmail.trim()}!`);
        } else {
          toast.error(response.data?.message || "Unable to send proforma email");
        }
      } else {
        const response = await axiosInstance.post(`/enquiry-flow-integration/${targetJobId}/mail`, {
          to_email: inputEmail.trim(),
          client_link: clientLink,
          contact_name: contactName,
          duration: s?.e?.links_duration || 24,
          subJobNos: subJobNos,
        });

        if (response.data?.success) {
          toast.success(response.data.message || `Design email sent successfully to ${inputEmail.trim()}!`);
        } else {
          toast.error(response.data?.message || "Unable to send mail");
        }
      }
    } catch (error) {
      console.error(`Error sending ${docType} email:`, error);
      toast.error(error.response?.data?.message || "Server error while sending email");
    } finally {
      hideLoader();
      setIsSendingEmail(false);
      handleAction("Email");
    }
  };

  const handleWhatsAppClick = async (e) => {
    if (isSendingWhatsApp) return;

    const rawCleanPhone = String(inputPhone || "").replace(/\D/g, "");
    if (!rawCleanPhone) {
      toast.error("Please enter a valid mobile number for WhatsApp");
      return;
    }

    if (e?.currentTarget) e.currentTarget.disabled = true;
    setIsSendingWhatsApp(true);
    showLoader();

    const fullPhone = rawCleanPhone.length === 10 ? `91${rawCleanPhone}` : rawCleanPhone;
    let clientLink = signedLink;
    if (!clientLink) {
      const targetJobId = String(s?.dbJobId || s?._id || s?.rawJob?._id || s?.id || s?.seq || "");
      if (targetJobId) {
        const durationHours = Number(s?.e?.links_duration) || 24;
        const subjobsStr = Array.isArray(subJobNos) && subJobNos.length > 0 ? subJobNos.join(",") : "";
        const tab = docType === "delivery" ? "delivery" : (docType === "sample" ? "sample" : (docType === "proof" ? "proof" : (docType === "sample_proof" ? "sample_proof" : (docType === "pi" || docType === "proforma" ? "proforma" : ""))));
        try {
          const res = await axiosInstance.get(`/enquiry-flow-integration/${targetJobId}/public-link`, {
            params: {
              duration: durationHours,
              docType,
              type: docType,
              tab,
              subjobs: subjobsStr,
              mode: isPP ? "pre_production" : "sample",
              phase: phase || (s?.step >= 4 ? "production" : "sample"),
            },
          });
          if (res.data?.url || res.data?.link) {
            clientLink = res.data.url || res.data.link;
            setSignedLink(clientLink);
          }
        } catch (err) {
          console.warn("Could not fetch signed link for WhatsApp:", err);
        }
      }
    }
    if (!clientLink) clientLink = generateClientLink();
    const parentJobNo = s?.seq
      ? formatEnquiryNo(s.seq)
      : (s?.enquiry_no ? formatEnquiryNo(s.enquiry_no) : ENQUIRY_CONFIG.DEFAULT_ENQUIRY_NO);
    const duration = s?.e?.links_duration || 24;

    const targetedJobLabel = Array.isArray(subJobNos) && subJobNos.length > 0
      ? subJobNos.map((sj) => (String(sj).startsWith("RD") ? sj : `RD${sj}`)).join(", ")
      : (s?.e?.subJobNo ? (String(s.e.subJobNo).startsWith("RD") ? s.e.subJobNo : `RD${s.e.subJobNo}`) : `${parentJobNo}-A1`);

    // Resolve matched sub job, theme and product name
    const matchedSubJob = Array.isArray(subJobNos) && subJobNos.length > 0 && Array.isArray(s?.sub_jobs)
      ? s.sub_jobs.find((sj) => subJobNos.includes(sj.sub_job_no) || subJobNos.includes(sj.sub_job_no?.replace("RD", "")))
      : null;
    const currentTheme =
      matchedSubJob?.theme ||
      s?.sub_jobs?.[0]?.theme ||
      s?.the_ask?.theme ||
      s?.e?.theme ||
      s?.rawJob?.the_ask?.theme ||
      "";
    const resolvedProductName =
      currentTheme ||
      matchedSubJob?.product_name ||
      s?.sub_jobs?.[0]?.product_name ||
      s?.e?.productName ||
      s?.the_brief?.product_name ||
      s?.rawJob?.product_name ||
      s?.e?.type ||
      "Custom Trophy";

    let message = "";
    if (docType === "quote") {
      let itemsSummary = "";
      if (Array.isArray(selectedItems) && selectedItems.length > 0) {
        itemsSummary = "\n" + selectedItems.map((it) => {
          const r = Number(it.unitRate || it.target_rate || it.rate || 0);
          const q = Number(it.qty || 1);
          let itemNo = it.subJobNo || (it.subjobId ? `${parentJobNo}-${it.subjobId}` : it.name);
          if (itemNo && !String(itemNo).startsWith("RD") && /^\d/.test(String(itemNo))) {
            itemNo = `RD${itemNo}`;
          }
          return `• *${itemNo}* (${it.theme || it.name || "Custom Trophy"}): ${q} pcs @ ₹${r.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/pc`;
        }).join("\n") + "\n";
      }

      const amountNote = totalAmount > 0
        ? `\n💰 *Total Estimate:* ₹${Number(totalAmount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (excl. GST)\n`
        : "\n";

      message = `Hello ${contactName || "Sir/Madam"},

Please find the commercial quotation for *${targetedJobLabel}* from *RD Custom Awards Pvt. Ltd.*:
${itemsSummary}${amountNote}
📄 *View & Review Quotation Online:*
${clientLink}

Please review the details and let us know your approval.

Regards,
*RD Custom Awards Pvt. Ltd.*`;
    } else if (docType === "delivery") {
      const carrierName = s?.sampleCarrier || s?.delivCarrier || s?.carrier || "Tempo";
      const isClientPayer = Boolean(s?.sampleFreight === 'Client pays freight' || s?.delivPayer === 'client' || s?.payer === 'client');
      const payerText = isClientPayer ? 'Payable by Client (will be added to final invoice)' : 'Borne by RD Custom Awards';
      const dest = s?.sampleShipTo || s?.shipTo || (client?.name ? `${client.name} office` : "Destination");
      const baseAmt = Number(s?.sampleChargesAmount || s?.chargesAmount || totalAmount || 0);
      const gstAmt = Math.round(baseAmt * 0.18);
      const totAmt = baseAmt + gstAmt;

      message = `Hello ${contactName || "Sir/Madam"},

Please find the sample delivery & courier charges details for *${targetedJobLabel}* from *RD Custom Awards Pvt. Ltd.*:

🚚 *Carrier Mode:* ${carrierName}
📍 *Deliver To:* ${dest}
💰 *Courier / Delivery Rate:* ₹${baseAmt.toLocaleString("en-IN")} + 18% GST (₹${gstAmt.toLocaleString("en-IN")}) = *₹${totAmt.toLocaleString("en-IN")}*
💳 *Payment Term:* ${payerText}

🔗 *View Document Sheet Online:*
${clientLink}

Please reply with your approval so we can proceed with dispatch.

Regards,
*RD Custom Awards Pvt. Ltd.*`;
    } else if (docType === "sample") {
      let itemsSummary = "";
      if (Array.isArray(selectedItems) && selectedItems.length > 0) {
        itemsSummary = "\n" + selectedItems.map((it) => {
          const r = Number(it.sampleRate || it.sample_rate || it.unitRate || 0);
          const q = Number(it.pieces || it.sampleQty || s?.sampleQty || 1);
          let itemNo = it.subJobNo || (it.subjobId ? `${parentJobNo}-${it.subjobId}` : it.name);
          if (itemNo && !String(itemNo).startsWith("RD") && /^\d/.test(String(itemNo))) {
            itemNo = `RD${itemNo}`;
          }
          const isFocItem = (s?.charge || "foc") === "foc" || (!s?.sampleRate && r === 0);
          const ratePart = isFocItem ? "Free of cost (₹0)" : `₹${r.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/pc`;
          return `• *${itemNo}* (${it.theme || it.name || "Custom Trophy"}): ${q} pc · ${ratePart}`;
        }).join("\n") + "\n";
      }

      const isFoc = (s?.charge || "foc") === "foc" || !s?.sampleRate || Number(s?.sampleRate) === 0;
      const rateSummary = isFoc
        ? `\n🎁 *Sample Charge:* Free of cost (₹0)\n`
        : `\n💰 *Total Sample Charge:* ₹${Number(totalAmount || s?.sampleRate || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (taxable + GST)\n`;

      message = `Hello ${contactName || "Sir/Madam"},

Please find the sample order confirmation & rates for *${targetedJobLabel}* from *RD Custom Awards Pvt. Ltd.*:
${itemsSummary}${rateSummary}
📄 *View & Review Sample Sheet Online:*
${clientLink}

Please review the details and let us know your approval so we can proceed with sample production.

Regards,
*RD Custom Awards Pvt. Ltd.*`;
    } else if (docType === "sample_proof") {
      message = isPP
        ? `Hello ${contactName || "Sir/Madam"},

Our shop floor has crafted the 1-piece pre-production sample for *${targetedJobLabel}* from *RD Custom Awards Pvt. Ltd.*:

📸 *Inspect Pre-Production Sample Photos & 360° Video Online:*
${clientLink}

Please inspect the trophy finish, laser engraving clarity, logo alignment, and proportions, and reply to approve or request adjustments.

Regards,
*RD Custom Awards Pvt. Ltd.*`
        : `Hello ${contactName || "Sir/Madam"},

Our shop floor has crafted the Sample v${sampleRound} production piece for *${targetedJobLabel}* from *RD Custom Awards Pvt. Ltd.*:

📸 *Inspect Sample v${sampleRound} Production Photos & 360° Video Online:*
${clientLink}

Please inspect the trophy finish, laser engraving clarity, logo alignment, and proportions, and reply to approve or request adjustments.

Regards,
*RD Custom Awards Pvt. Ltd.*`;
    } else if (docType === "proof") {
      message = `Hello ${contactName || "Sir/Madam"},

Our DTP design studio has prepared the artwork and content proof for *${targetedJobLabel}* from *RD Custom Awards Pvt. Ltd.*:

📄 *Review & Approve Proof Online:*
${clientLink}

Please check every name, spelling, logo positioning, and layout, and reply to approve or request alterations.

Regards,
*RD Custom Awards Pvt. Ltd.*`;
    } else if (docType === "pi" || docType === "proforma") {
      const piNo = s?.pi?.no || `PI/2026/${parentJobNo}`;
      const piDownloadUrl = s?.pi?.signed_file_url || s?.pi?.file_url;
      const pdfLine = piDownloadUrl ? `\n📥 *Download Official PI PDF:*\n${piDownloadUrl}\n` : "";
      const amountNote = totalAmount > 0
        ? `\n💰 *Total Invoice Amount:* ₹${Number(totalAmount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (incl. GST)\n`
        : "";

      message = `Hello ${contactName || "Sir/Madam"},

Please find the *Official Proforma Invoice* (${piNo}) for *${targetedJobLabel}* from *RD Custom Awards Pvt. Ltd.*:
${amountNote}${pdfLine}
📄 *View & Review Details Online:*
${clientLink}

Please review the proforma invoice and confirm your approval / advance payment details.

Regards,
*RD Custom Awards Pvt. Ltd.*`;
    } else {
      const subJobCode = s?.e?.subJobNo || `${parentJobNo}-A1`;
      const themeLabel = currentTheme ? ` (${currentTheme})` : "";
      message = `Hello ${contactName || "Sir/Madam"},

Please find the design options for your enquiry *${subJobCode}*${themeLabel} from *RD Custom Awards Pvt. Ltd.*:

🔗 *View & Approve Designs:*
${clientLink}

Please review the details and reply within ${duration} hours with your choice or any changes needed.

Regards,
*RD Custom Awards Pvt. Ltd.*`;
    }

    const expiryTimestamp = Date.now() + duration * 60 * 60 * 1000;
    const expiryDateFormatted = new Date(expiryTimestamp).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    const getDocTitle = () => {
      if (docType === "quote") return `Quotation – Sub Job No: ${targetedJobLabel}`;
      if (docType === "delivery") return `Delivery Charges – Sub Job No: ${targetedJobLabel}`;
      if (docType === "sample") return `Sample Confirmation – Sub Job No: ${targetedJobLabel}`;
      if (docType === "sample_proof") return `Sample Production Proof – Sub Job No: ${targetedJobLabel}`;
      if (docType === "proof") return `Artwork Proof Approval – Sub Job No: ${targetedJobLabel}`;
      if (docType === "pi" || docType === "proforma") {
        const piNo = s?.pi?.no || `PI/2026/${parentJobNo}`;
        return `Proforma Invoice – ${piNo} (${targetedJobLabel})`;
      }
      return `Design Options – Sub Job No: ${targetedJobLabel}`;
    };

    const templateValues = {
      "1": getDocTitle(),
      "2": contactName || "Client",
      "3": resolvedProductName,
      "4": clientLink,
      "5": expiryDateFormatted,
    };

    // 1. Dispatch 2Factor WhatsApp official template for all document shares
    try {
      await axiosInstance.post("/enquiry/send-enquiry-template", {
        phone_number: fullPhone,
        values: templateValues,
      });
    } catch (e2f) {
      console.warn("Direct /enquiry/send-enquiry-template dispatch notice:", e2f);
    }

    try {
      const targetJobId = String(s?.dbJobId || s?._id || s?.rawJob?._id || s?.id || s?.seq || "");
      if (targetJobId) {
        if (docType === "quote") {
          await axiosInstance.post(`/enquiry-flow-integration/${targetJobId}/send-quotes`, {
            channel: "WhatsApp",
            subJobNos: subJobNos,
            recipient: fullPhone,
            clientLink: clientLink,
            values: templateValues,
          });
        } else if (docType === "delivery") {
          await axiosInstance.post(`/enquiry-flow-integration/${targetJobId}/share-options`, {
            channel: "WhatsApp",
            recipient: fullPhone,
            subJobNos: subJobNos,
            clientLink: clientLink,
            values: templateValues,
            notes: `Delivery charges shared via 2Factor WhatsApp (Carrier: ${s?.sampleCarrier || "Courier"}, ₹${s?.sampleChargesAmount || 0})`
          });
        } else if (docType === "sample") {
          await axiosInstance.post(`/enquiry-flow-integration/${targetJobId}/sample-share`, {
            channel: "WhatsApp",
            recipient: fullPhone,
            subJobNos: subJobNos,
            selectedItems: selectedItems,
            totalAmount: totalAmount,
            clientLink: clientLink,
            values: templateValues,
            notes: `Sample confirmation sheet shared via 2Factor WhatsApp (${subJobNos.join(", ")})`
          });
        } else if (docType === "sample_proof") {
          await axiosInstance.post(`/enquiry-flow-integration/${targetJobId}/sample-proof-mail`, {
            channel: "WhatsApp",
            recipient: fullPhone,
            subJobNos: subJobNos,
            clientLink: clientLink,
            values: templateValues,
          }).catch(() => {});
        } else if (docType === "proof") {
          const explicitPhase = String(
            phase || mode || s?.phase || s?.dtpPhase || ""
          ).trim().toLowerCase();

          const isProductionPhase = Boolean(
            explicitPhase === "production" ||
            explicitPhase === "prod" ||
            s?.step >= 4 ||
            s?.rawJob?.step >= 4 ||
            s?.currentPhase === "production" ||
            s?.activeTab === "production"
          );

          const isSampleProof = !isProductionPhase && Boolean(
            explicitPhase === "sample" ||
            s?.is_sample ||
            s?.step === 2 ||
            (s?.e?.order_type === "sample" && !s?.step)
          );

          await axiosInstance.post(`/enquiry-flow-integration/${targetJobId}/share-dtp-proof`, {
            channel: "whatsapp",
            recipient: fullPhone,
            subJobNo: subJobNos[0] || undefined,
            notes: `Artwork proof shared via 2Factor WhatsApp (${subJobNos.join(", ")})`,
            duration: s?.e?.links_duration || 48,
            phase: isSampleProof ? "sample" : "production",
            clientLink: clientLink,
            values: templateValues,
          });
        } else if (docType === "pi" || docType === "proforma") {
          await axiosInstance.post(`/enquiry-flow-integration/${targetJobId}/share-proforma`, {
            channel: "WhatsApp",
            recipient: fullPhone,
            clientLink: clientLink,
            values: templateValues,
          });
        } else {
          // Design share
          await axiosInstance.post(`/enquiry-flow-integration/${targetJobId}/share-options`, {
            channel: "WhatsApp",
            recipient: fullPhone,
            subJobNos: subJobNos,
            clientLink: clientLink,
            values: templateValues,
          });
        }
      }
    } catch (err) {
      console.warn("Could not record WhatsApp share to backend:", err);
    } finally {
      hideLoader();
      setIsSendingWhatsApp(false);
    }

    toast.success(
      docType === "quote"
        ? "Quotation sent successfully via WhatsApp!"
        : docType === "delivery"
          ? "Delivery charges sent successfully via WhatsApp!"
          : docType === "sample"
            ? "Sample confirmation sent successfully via WhatsApp!"
            : docType === "sample_proof"
              ? "Sample production proof sent successfully via WhatsApp!"
              : docType === "proof"
                ? "Artwork proof sent successfully via WhatsApp!"
                : docType === "pi" || docType === "proforma"
                  ? "Proforma Invoice sent successfully via WhatsApp!"
                  : "Design options sent successfully via WhatsApp!"
    );
    handleAction("WhatsApp");
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
            disabled={!inputEmail.trim() || isSendingEmail}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold shadow-2xs transition ${!inputEmail.trim() || isSendingEmail
              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
              : "bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer"
              }`}
          >
            {isSendingEmail ? "Sending Email..." : `Email ${contactName.split(' ')[0]}`}
          </button>
          <button
            type="button"
            onClick={handleWhatsAppClick}
            disabled={!inputPhone.trim() || isSendingWhatsApp}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold shadow-2xs transition ${!inputPhone.trim() || isSendingWhatsApp
              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
              : "bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
              }`}
          >
            {isSendingWhatsApp ? "Sending WhatsApp..." : "WhatsApp"}
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
