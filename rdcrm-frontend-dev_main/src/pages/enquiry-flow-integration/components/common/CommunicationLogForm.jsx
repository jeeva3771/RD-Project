import React, { useState, useRef, useEffect } from 'react';
import { contactsOf } from "../../utils/helpers";
import { axiosInstance } from "../../../../utils/url/config";
import { toast } from "react-toastify";

const CommunicationLogForm = ({
  client,
  pName,
  feedbackMode = 'approve',
  optIdxs,
  onBack,
  onLog,
  mode = 'design',
  amount,
  hideCard = false,
  title,
  subTitle,
  buttonText,
  buttonHint
}) => {
  const [method, setMethod] = useState('whatsapp');
  
  const contacts = client ? contactsOf(client) : [];
  const defaultContactStr = contacts[0]
    ? `${contacts[0].name}${contacts[0].designation || contacts[0].role ? ` · ${contacts[0].designation || contacts[0].role}` : ''}`
    : (client?.contact_person || client?.name || "Client Contact");

  // Common fields
  const [whoConfirmed, setWhoConfirmed] = useState(defaultContactStr);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(() => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  });
  const [feedbackDetails, setFeedbackDetails] = useState("");
  
  // WhatsApp fields
  const [waNumber, setWaNumber] = useState(() => {
    const raw = String(contacts[0]?.phone || contacts[0]?.mobile || contacts[0]?.mobile_no || client?.mobile_no || client?.mobile || "");
    const clean = raw.replace(/\D/g, "").slice(-10);
    return clean || "";
  });
  const [waType, setWaType] = useState("text");
  const [waMessage, setWaMessage] = useState("");
  
  // Email fields
  const [emailFrom, setEmailFrom] = useState(() => {
    return contacts[0]?.email || client?.email || "";
  });
  const [emailSubject, setEmailSubject] = useState("");
  const [emailKeyLines, setEmailKeyLines] = useState("");
  
  // Verbal fields
  const [verbalType, setVerbalType] = useState("phone");
  const [verbalSay, setVerbalSay] = useState("");
  const [verbalWrittenSummary, setVerbalWrittenSummary] = useState(true);

  // Written / PO fields
  const [poNumber, setPoNumber] = useState("");
  
  const [attachment, setAttachment] = useState(null);
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState({});

  // Sync WhatsApp number and Email automatically when contact changes
  const handleWhoConfirmedChange = (selectedVal) => {
    setWhoConfirmed(selectedVal);
    if (errors.whoConfirmed) {
      setErrors((prev) => ({ ...prev, whoConfirmed: null }));
    }
    const matched = contacts.find(
      (c) => `${c.name} · ${c.designation || c.role || 'Sales ops'}` === selectedVal || c.name === selectedVal
    );
    if (matched) {
      const rawNum = String(matched.phone || matched.mobile || matched.mobile_no || "");
      const cleanNum = rawNum.replace(/\D/g, "").slice(-10);
      if (cleanNum) {
        setWaNumber(cleanNum);
        if (errors.waNumber) setErrors((prev) => ({ ...prev, waNumber: null }));
      }
      if (matched.email) {
        setEmailFrom(matched.email);
        if (errors.emailFrom) setErrors((prev) => ({ ...prev, emailFrom: null }));
      }
    }
  };

  const handleMethodChange = (newMethod) => {
    setMethod(newMethod);
    setErrors((prev) => ({
      whoConfirmed: prev.whoConfirmed
    }));
  };

  useEffect(() => {
    if (contacts.length > 0) {
      const currentMatched = contacts.find(
        (c) => `${c.name} · ${c.designation || c.role || 'Sales ops'}` === whoConfirmed
      );
      if (!currentMatched) {
        const first = contacts[0];
        const defaultStr = `${first.name} · ${first.designation || first.role || 'Sales ops'}`;
        setWhoConfirmed(defaultStr);
        const raw = String(first.phone || first.mobile || first.mobile_no || client?.mobile_no || client?.mobile || "");
        const clean = raw.replace(/\D/g, "").slice(-10);
        if (clean) setWaNumber(clean);
        if (first.email) setEmailFrom(first.email);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  const uploadFile = async (file) => {
    if (!file) return;

    setIsUploading(true);
    const localUrl = URL.createObjectURL(file);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("clientId", client?.id || client?._id || "general");
      formData.append("enquiryNo", "PROOF");
      formData.append("folderType", "proof");

      const res = await axiosInstance.post("/enquiry-flow-integration/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      const url = res.data?.data?.signed_url || res.data?.data?.file_url || localUrl;
      setAttachment({ url, name: file.name, size: file.size });
      setErrors((prev) => ({ ...prev, attachment: null }));
      toast.success("Proof uploaded to Cloudflare R2!");
    } catch (err) {
      console.warn("Could not upload proof to R2, saving locally:", err);
      setAttachment({ url: localUrl, name: file.name, size: file.size });
      setErrors((prev) => ({ ...prev, attachment: null }));
      toast.info("Proof attached locally");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadFile(file);
    }
  };

  useEffect(() => {
    const handlePaste = (e) => {
      if (method !== 'screenshot' && method !== 'whatsapp' && method !== 'written') return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            uploadFile(blob);
            break;
          }
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, client]);
  
  const handleSubmit = () => {
    const errs = {};

    // 1. Who confirmed is mandatory across all methods
    if (!whoConfirmed || !whoConfirmed.trim()) {
      errs.whoConfirmed = "Please select who confirmed";
    }

    // 2. Method-specific mandatory validations
    if (method === 'whatsapp') {
      const cleanWa = String(waNumber || "").replace(/\D/g, "");
      if (!cleanWa || cleanWa.length < 10) {
        errs.waNumber = "WhatsApp number (From) is required (10 digits)";
      }
      if (!waMessage || !waMessage.trim()) {
        errs.waMessage = "Please paste their message";
      }
    } else if (method === 'screenshot') {
      if (!attachment || !attachment.url) {
        errs.attachment = "Screenshot proof upload is required";
      }
    } else if (method === 'email') {
      if (!emailFrom || !emailFrom.trim()) {
        errs.emailFrom = "From email address is required";
      }
      if (!emailSubject || !emailSubject.trim()) {
        errs.emailSubject = "Email subject is required";
      }
      if (!emailKeyLines || !emailKeyLines.trim()) {
        errs.emailKeyLines = "Key lines from the email are required";
      }
    } else if (method === 'verbal') {
      if (!verbalSay || !verbalSay.trim()) {
        errs.verbalSay = "What exactly did they say is required";
      }
    } else if (method === 'written') {
      if (!poNumber || !poNumber.trim()) {
        errs.poNumber = "PO Number is required";
      }
      if (!attachment || !attachment.url) {
        errs.attachment = "Upload of PO or Signed Copy is required";
      }
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      const firstError = Object.values(errs)[0];
      toast.warn(firstError, { position: "top-right", autoClose: 3500 });
      return;
    }

    setErrors({});

    let loggedInUser = null;
    try {
      const rawUser = localStorage.getItem("user");
      if (rawUser) loggedInUser = JSON.parse(rawUser);
    } catch (e) {
      console.warn("Could not parse logged in user", e);
    }
    const loggedBy = loggedInUser?.name || loggedInUser?.username || "Client Servicing";
    const loggedByRole = loggedInUser?.role || (loggedBy.toLowerCase().includes("admin") ? "Admin" : "Client Servicing");

    const logData = {
      approval_type: "cs_logged",
      logged_by: loggedBy,
      logged_by_role: loggedByRole,
      method,
      whoConfirmed,
      date,
      time,
      attachment,
      feedbackDetails
    };
    
    if (method === 'whatsapp') {
      Object.assign(logData, { waNumber, waType, waMessage });
    } else if (method === 'email') {
      Object.assign(logData, { emailFrom, emailSubject, emailKeyLines });
    } else if (method === 'verbal') {
      Object.assign(logData, { verbalType, verbalSay, verbalWrittenSummary });
    } else if (method === 'written') {
      Object.assign(logData, { poNumber });
    }
    
    onLog(logData);
  };

  const actionText = feedbackMode === 'approve' ? 'approved' : feedbackMode === 'revision' ? 'asked for changes' : 'rejected';
  const optText = optIdxs?.length > 0 ? `option ${optIdxs.map(i => i+1).join(', ')}` : 'the design';

  const content = (
    <>
      {!hideCard && (
        <div className="p-6 border-b border-gray-100 bg-white">
          <h3 className="text-xl font-extrabold text-gray-900 tracking-tight leading-tight">
            {title ||
              (mode === 'won-sample'
                ? 'Won, sample first. How did the client confirm?'
                : mode === 'won-production'
                ? 'Won, straight to production. How did the client confirm?'
                : mode === 'sample-approval' || (mode === 'sample' && !amount)
                ? `${pName || 'Sample v1'} approved. How did the client confirm?`
                : mode === 'sample'
                ? `Sample rates ₹${amount} approved? How did they confirm?`
                : mode === 'delivery-charges'
                ? `Delivery charges ₹${amount} + GST approved? How did they confirm?`
                : `${pName || 'Sample v1'}: ${optText} ${actionText}. How did they confirm?`)}
          </h3>
          <p className="text-xs text-gray-500 mt-1 font-normal">
            {subTitle || "Record how the client said yes, so there's proof on the job if anything is questioned later."}
          </p>
        </div>
      )}
      
      <div className={hideCard ? "space-y-5" : "p-4 space-y-5"}>
        <div>
          <label className="text-[10px] font-bold text-gray-700 mb-2 block">How did they confirm?</label>
          <div className="flex flex-wrap gap-3">
            {[
              { id: 'whatsapp', label: 'WhatsApp', sub: 'Message or voice note', icon: '💬' },
              { id: 'screenshot', label: 'Screenshot', sub: 'Any chat or app', icon: '📸' },
              { id: 'email', label: 'Email', sub: 'Reply or mail', icon: '✉️' },
              { id: 'verbal', label: 'Verbal', sub: 'Call or meeting', icon: '🗣️' },
              { id: 'written', label: 'Written / PO', sub: 'Signed copy or PO', icon: '📄' }
            ].map(m => (
              <button 
                key={m.id} 
                onClick={() => handleMethodChange(m.id)}
                className={`flex flex-col items-start p-3 w-36 rounded-xl border-2 transition text-left cursor-pointer ${method === m.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <span className="text-lg mb-1">{m.icon}</span>
                <span className={`text-xs font-bold ${method === m.id ? 'text-indigo-900' : 'text-gray-800'}`}>{m.label}</span>
                <span className="text-[9px] text-gray-500">{m.sub}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-[10px] font-bold text-gray-700 mb-1 block">
              Who confirmed <span className="text-red-500">*</span>
            </label>
            <select 
              className={`w-full p-2 text-xs border rounded-lg bg-white transition ${errors.whoConfirmed ? 'border-red-400 ring-1 ring-red-400' : 'border-gray-200'}`} 
              value={whoConfirmed} 
              onChange={e => handleWhoConfirmedChange(e.target.value)}
            >
              {contacts.length === 0 && (
                <option value="Vikas Rao · Sales ops">Vikas Rao · Sales ops</option>
              )}
              {contacts.map((c, i) => (
                <option key={i} value={`${c.name} · ${c.designation || c.role || 'Sales ops'}`}>{c.name} · {c.designation || c.role || 'Sales ops'}</option>
              ))}
            </select>
            {errors.whoConfirmed && (
              <p className="text-[10px] text-red-600 font-semibold mt-1">{errors.whoConfirmed}</p>
            )}
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-700 mb-1 block">Date</label>
            <input type="date" className="w-full p-2 text-xs border border-gray-200 rounded-lg bg-white" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-700 mb-1 block">Time</label>
            <input type="time" className="w-full p-2 text-xs border border-gray-200 rounded-lg bg-white" value={time} onChange={e => setTime(e.target.value)} />
          </div>
        </div>

        {feedbackMode !== 'approve' && (
          <div className="bg-red-50/50 p-3 rounded-lg border border-red-100 mb-4">
            <label className="text-[10px] font-bold text-red-900 mb-1 block">
              {feedbackMode === 'revision' ? 'What changes did they ask for?' : 'Reason for rejection'}
            </label>
            <textarea 
              className="w-full p-2 text-xs border border-red-200 rounded-lg focus:border-red-400 focus:ring-1 focus:ring-red-400" 
              rows="2" 
              placeholder={feedbackMode === 'revision' ? "e.g. Make the base wider..." : "e.g. Budget constraints..."}
              value={feedbackDetails} 
              onChange={e => setFeedbackDetails(e.target.value)}
            ></textarea>
          </div>
        )}

        {method === 'whatsapp' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-gray-700 mb-1 block">
                  From (WhatsApp number) <span className="text-red-500">*</span>
                </label>
                <div className="flex">
                  <span className="px-2 py-2 text-xs border border-r-0 border-gray-200 rounded-l-lg bg-gray-50">+91</span>
                  <input 
                    type="text" 
                    className={`w-full p-2 text-xs border rounded-r-lg transition ${errors.waNumber ? 'border-red-400 ring-1 ring-red-400' : 'border-gray-200'}`} 
                    value={waNumber} 
                    onChange={e => {
                      setWaNumber(e.target.value);
                      if (errors.waNumber) setErrors(prev => ({ ...prev, waNumber: null }));
                    }} 
                    placeholder="e.g. 9867123456" 
                  />
                </div>
                {errors.waNumber && (
                  <p className="text-[10px] text-red-600 font-semibold mt-1">{errors.waNumber}</p>
                )}
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-700 mb-1 block">Type</label>
                <div className="flex gap-2">
                  {['text', 'voice', 'emoji'].map(t => (
                    <button key={t} onClick={() => setWaType(t)} className={`px-3 py-1.5 text-xs rounded-full border transition cursor-pointer ${waType === t ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-200'}`}>
                      {t === 'text' ? 'Text message' : t === 'voice' ? 'Voice note' : 'Emoji / thumbs up'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-700 mb-1 block">
                Paste their message <span className="text-red-500">*</span>
              </label>
              <textarea 
                className={`w-full p-2 text-xs border rounded-lg transition ${errors.waMessage ? 'border-red-400 ring-1 ring-red-400' : 'border-gray-200'}`} 
                rows="3" 
                placeholder="e.g. 'Approved, go ahead with the sample.'" 
                value={waMessage} 
                onChange={e => {
                  setWaMessage(e.target.value);
                  if (errors.waMessage) setErrors(prev => ({ ...prev, waMessage: null }));
                }}
              ></textarea>
              {errors.waMessage && (
                <p className="text-[10px] text-red-600 font-semibold mt-1">{errors.waMessage}</p>
              )}
            </div>
            <input 
              ref={fileInputRef} 
              type="file" 
              accept="image/*,.pdf" 
              className="hidden" 
              onChange={handleFileUpload} 
            />
            {attachment ? (
              <div className="p-3 border border-emerald-200 bg-emerald-50/50 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {attachment.url && (
                    <div className="w-12 h-12 rounded-lg border border-emerald-300 bg-white p-1 overflow-hidden shrink-0 shadow-2xs flex items-center justify-center">
                      <img src={attachment.url} alt="Attachment" className="w-full h-full object-contain" />
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-bold text-emerald-950 truncate max-w-xs">{attachment.name || "Proof file"}</p>
                    <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1 mt-0.5">
                      ✓ Uploaded to R2 Cloud
                    </span>
                  </div>
                </div>
                <button 
                  type="button" 
                  onClick={() => {
                    setAttachment(null);
                    setErrors(prev => {
                      const next = { ...prev };
                      delete next.attachment;
                      return next;
                    });
                  }} 
                  className="px-2.5 py-1 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`border border-dashed rounded-lg p-4 flex flex-col items-center justify-center bg-gray-50/50 hover:bg-indigo-50/30 cursor-pointer transition ${errors.attachment ? 'border-red-400 bg-red-50/20' : 'border-gray-300'}`}
              >
                <span className="text-xs text-gray-700 font-semibold mb-2">
                  Add a screenshot of the chat too (optional): paste with Ctrl+V or
                </span>
                <button 
                  type="button" 
                  disabled={isUploading}
                  className="px-4 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition cursor-pointer"
                >
                  {isUploading ? "Uploading to R2..." : "Choose image"}
                </button>
                {errors.attachment && (
                  <p className="text-[10px] text-red-600 font-semibold mt-2">{errors.attachment}</p>
                )}
              </div>
            )}
            {waNumber && (
              <a 
                href={`https://wa.me/91${waNumber.replace(/\D/g, '')}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-block text-xs font-bold text-indigo-600 hover:text-indigo-800 underline underline-offset-2 decoration-indigo-300 hover:decoration-indigo-600 transition"
              >
                Open this chat in WhatsApp ↗
              </a>
            )}
          </div>
        )}

        {method === 'email' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-gray-700 mb-1 block">
                  From <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  className={`w-full p-2 text-xs border rounded-lg transition ${errors.emailFrom ? 'border-red-400 ring-1 ring-red-400' : 'border-gray-200'}`} 
                  value={emailFrom} 
                  onChange={e => {
                    setEmailFrom(e.target.value);
                    if (errors.emailFrom) setErrors(prev => ({ ...prev, emailFrom: null }));
                  }} 
                  placeholder="e.g. client@company.com" 
                />
                {errors.emailFrom && (
                  <p className="text-[10px] text-red-600 font-semibold mt-1">{errors.emailFrom}</p>
                )}
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-700 mb-1 block">
                  Subject <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  className={`w-full p-2 text-xs border rounded-lg transition ${errors.emailSubject ? 'border-red-400 ring-1 ring-red-400' : 'border-gray-200'}`} 
                  value={emailSubject} 
                  onChange={e => {
                    setEmailSubject(e.target.value);
                    if (errors.emailSubject) setErrors(prev => ({ ...prev, emailSubject: null }));
                  }} 
                  placeholder="e.g. RE: Quotation" 
                />
                {errors.emailSubject && (
                  <p className="text-[10px] text-red-600 font-semibold mt-1">{errors.emailSubject}</p>
                )}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-700 mb-1 block">
                Key lines from the email <span className="text-red-500">*</span>
              </label>
              <textarea 
                className={`w-full p-2 text-xs border rounded-lg transition ${errors.emailKeyLines ? 'border-red-400 ring-1 ring-red-400' : 'border-gray-200'}`} 
                rows="3" 
                placeholder="Paste the line where they approve..." 
                value={emailKeyLines} 
                onChange={e => {
                  setEmailKeyLines(e.target.value);
                  if (errors.emailKeyLines) setErrors(prev => ({ ...prev, emailKeyLines: null }));
                }} 
              ></textarea>
              {errors.emailKeyLines && (
                <p className="text-[10px] text-red-600 font-semibold mt-1">{errors.emailKeyLines}</p>
              )}
            </div>
          </div>
        )}

        {method === 'verbal' && (
          <div className="space-y-4">
            <div>
              <div className="flex gap-2">
                {['phone', 'inperson', 'video'].map(t => (
                  <button key={t} onClick={() => setVerbalType(t)} className={`px-4 py-2 text-xs rounded-full border transition cursor-pointer ${verbalType === t ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-200'}`}>
                    {t === 'phone' ? 'Phone call' : t === 'inperson' ? 'In person' : 'Video call'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-700 mb-1 block">
                What exactly did they say? <span className="text-red-500">*</span>
              </label>
              <textarea 
                className={`w-full p-2 text-xs border rounded-lg transition ${errors.verbalSay ? 'border-red-400 ring-1 ring-red-400' : 'border-gray-200'}`} 
                rows="3" 
                placeholder="e.g. Anita confirmed on call: go ahead..." 
                value={verbalSay} 
                onChange={e => {
                  setVerbalSay(e.target.value);
                  if (errors.verbalSay) setErrors(prev => ({ ...prev, verbalSay: null }));
                }}
              ></textarea>
              {errors.verbalSay && (
                <p className="text-[10px] text-red-600 font-semibold mt-1">{errors.verbalSay}</p>
              )}
            </div>
            <div className="flex items-center gap-3 p-3 border border-indigo-100 bg-indigo-50/30 rounded-lg">
              <input type="checkbox" className="w-5 h-5 text-indigo-600 rounded border-indigo-300 cursor-pointer" checked={verbalWrittenSummary} onChange={e => setVerbalWrittenSummary(e.target.checked)} />
              <div>
                <p className="text-xs font-bold text-indigo-900">Send a written confirmation to the client</p>
                <p className="text-[10px] text-indigo-700">A verbal yes should be followed by a WhatsApp or email summary they can reply to</p>
              </div>
            </div>
          </div>
        )}

        {method === 'screenshot' && (
          <div className="space-y-4">
            <input 
              ref={fileInputRef} 
              type="file" 
              accept="image/*,.pdf" 
              className="hidden" 
              onChange={handleFileUpload} 
            />

            {attachment ? (
              <div className="p-4 border border-emerald-200 bg-emerald-50/50 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {attachment.url && (
                    <div className="w-14 h-14 rounded-lg border border-emerald-300 bg-white p-1 overflow-hidden shrink-0 shadow-2xs flex items-center justify-center">
                      <img src={attachment.url} alt="Attachment" className="w-full h-full object-contain" />
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-bold text-emerald-950 truncate max-w-xs">{attachment.name || "Proof file"}</p>
                    <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1 mt-0.5">
                      ✓ Uploaded to R2 Cloud
                    </span>
                  </div>
                </div>
                <button 
                  type="button" 
                  onClick={() => {
                    setAttachment(null);
                    setErrors(prev => ({ ...prev, attachment: "Screenshot proof upload is required" }));
                  }} 
                  className="px-2.5 py-1 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center bg-gray-50/50 hover:bg-indigo-50/40 hover:border-indigo-300 cursor-pointer transition group ${errors.attachment ? 'border-red-400 bg-red-50/20' : 'border-gray-300'}`}
              >
                <span className="text-2xl mb-1 text-gray-400 group-hover:text-indigo-600">📷</span>
                <span className="text-xs text-gray-700 font-bold mb-1">
                  Upload screenshot proof <span className="text-red-500">*</span>
                </span>
                <span className="text-[10px] text-gray-500 mb-2">paste with Ctrl+V or click to browse</span>
                <button 
                  type="button" 
                  disabled={isUploading}
                  className="px-4 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 group-hover:bg-indigo-100 rounded-lg border border-indigo-200 transition cursor-pointer"
                >
                  {isUploading ? "Uploading to R2..." : "Choose file"}
                </button>
                {errors.attachment && (
                  <p className="text-[11px] text-red-600 font-semibold mt-2">{errors.attachment}</p>
                )}
              </div>
            )}
          </div>
        )}

        {method === 'written' && (
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-gray-700 mb-1 block">
                PO Number <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                className={`w-full p-2 text-xs border rounded-lg transition ${errors.poNumber ? 'border-red-400 ring-1 ring-red-400' : 'border-gray-200'}`} 
                value={poNumber} 
                onChange={e => {
                  setPoNumber(e.target.value);
                  if (errors.poNumber) setErrors(prev => ({ ...prev, poNumber: null }));
                }} 
                placeholder="e.g. PO-2026-001" 
              />
              {errors.poNumber && (
                <p className="text-[10px] text-red-600 font-semibold mt-1">{errors.poNumber}</p>
              )}
            </div>
            <input 
              ref={fileInputRef} 
              type="file" 
              accept="image/*,.pdf" 
              className="hidden" 
              onChange={handleFileUpload} 
            />

            {attachment ? (
              <div className="p-4 border border-emerald-200 bg-emerald-50/50 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {attachment.url && (
                    <div className="w-14 h-14 rounded-lg border border-emerald-300 bg-white p-1 overflow-hidden shrink-0 shadow-2xs flex items-center justify-center">
                      <img src={attachment.url} alt="Attachment" className="w-full h-full object-contain" />
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-bold text-emerald-950 truncate max-w-xs">{attachment.name || "Proof file"}</p>
                    <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1 mt-0.5">
                      ✓ Uploaded to R2 Cloud
                    </span>
                  </div>
                </div>
                <button 
                  type="button" 
                  onClick={() => {
                    setAttachment(null);
                    setErrors(prev => ({ ...prev, attachment: "Upload of PO or Signed Copy is required" }));
                  }} 
                  className="px-2.5 py-1 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center bg-gray-50/50 hover:bg-indigo-50/40 hover:border-indigo-300 cursor-pointer transition group ${errors.attachment ? 'border-red-400 bg-red-50/20' : 'border-gray-300'}`}
              >
                <span className="text-2xl mb-1 text-gray-400 group-hover:text-indigo-600">📄</span>
                <span className="text-xs text-gray-700 font-bold mb-2">
                  Upload PO or Signed Copy <span className="text-red-500">*</span>
                </span>
                <button 
                  type="button" 
                  disabled={isUploading}
                  className="px-4 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 group-hover:bg-indigo-100 rounded-lg border border-indigo-200 transition cursor-pointer"
                >
                  {isUploading ? "Uploading to R2..." : "Choose file"}
                </button>
                {errors.attachment && (
                  <p className="text-[11px] text-red-600 font-semibold mt-2">{errors.attachment}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition cursor-pointer"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition cursor-pointer"
        >
          {buttonText ||
            (mode === 'won-sample'
              ? 'Log approval and start the sample'
              : mode === 'won-production'
              ? 'Log approval and start the order'
              : mode === 'sample-approval'
              ? 'Log approval and process the order'
              : `Log ${actionText === 'approved' ? 'approval' : actionText === 'rejected' ? 'rejection' : 'revision'}`)}
        </button>
        {(buttonHint || mode === 'sample-approval' || buttonText === 'Log approval and process the order') && (
          <span className="text-xs text-gray-400 font-normal">
            {buttonHint || 'Paste their message or add a screenshot.'}
          </span>
        )}
      </div>
    </>
  );

  if (hideCard) return content;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mt-3">
      {content}
    </div>
  );
};

export default CommunicationLogForm;
