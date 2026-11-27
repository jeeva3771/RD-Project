import React, { useState, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { X, ShoppingCart, Factory, Calendar, Clock, CheckCircle2, ChevronRight, Package, Printer, Monitor, Scissors, User, Plus, History, ChevronDown, AlertTriangle, Upload, FileText, Eye, Trash2, ExternalLink } from 'lucide-react';
import { updateShopFloorJobStatus, fetchShopFloorJobs } from '../../../reducer/shopFloorReducer';
import { toast } from 'react-toastify';
import { axiosInstance } from '../../../utils/url/config';

const OutsourceManager = ({ isOpen, onClose, jobs = [] }) => {
    const dispatch = useDispatch();
    const fileInputRef = useRef(null);
    const getCurrentDateTime = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const date = `${year}-${month}-${day}`;
        const time = d.toTimeString().slice(0, 5);
        return { date, time };
    };

    const formatDateForBackend = (dateStr) => {
        if (!dateStr || !dateStr.includes('-')) return dateStr;
        const parts = dateStr.split('-');
        if (parts[0].length === 4) return `${parts[2]}-${parts[1]}-${parts[0]}`;
        return dateStr;
    };

    const formatTimeForBackend = (timeStr) => {
        if (!timeStr || !timeStr.includes(':')) return timeStr;
        let [h, m] = timeStr.split(':');
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
    };

    const [batchInputs, setBatchInputs] = useState(() => {
        const { date, time } = getCurrentDateTime();
        return { qty: '', date, time, type: 'actual' };
    });

    const [invoiceInputs, setInvoiceInputs] = useState(() => {
        const { date } = getCurrentDateTime();
        return { no: '', date, rate: '', amt: '', qty: '', file: null, fileName: '', filePreview: '' };
    });

    const handleInvoiceQtyChange = (val) => {
        setInvoiceInputs(prev => {
            const numQty = parseFloat(val);
            const numRate = parseFloat(prev.rate);
            const calculatedAmt = (!isNaN(numQty) && !isNaN(numRate) && numQty > 0 && numRate >= 0)
                ? (Math.round(numQty * numRate * 100) / 100).toFixed(2)
                : '';
            return {
                ...prev,
                qty: val,
                amt: calculatedAmt
            };
        });
    };

    const handleInvoiceRateChange = (val) => {
        setInvoiceInputs(prev => {
            const numRate = parseFloat(val);
            const numQty = parseFloat(prev.qty);
            const calculatedAmt = (!isNaN(numQty) && !isNaN(numRate) && numQty > 0 && numRate >= 0)
                ? (Math.round(numQty * numRate * 100) / 100).toFixed(2)
                : '';
            return {
                ...prev,
                rate: val,
                amt: calculatedAmt
            };
        });
    };
    const [isUploadingInvoice, setIsUploadingInvoice] = useState(false);
    const [activeInvoiceAddKey, setActiveInvoiceAddKey] = useState(null);

    const [showHistory, setShowHistory] = useState(null); // { id: string, type: 'stage' | 'batch' }

    if (!isOpen) return null;

    // Flatten all outsource assignments from all jobs
    const allAssignments = [];
    jobs.forEach(job => {
        (job.material_groups || []).forEach(mg => {
            const assignments = mg.outsource_assignments?.length > 0
                ? mg.outsource_assignments
                : (mg.vendor_name && mg.assigned_outsource_sheets > 0 ? [{
                    vendor_name: mg.vendor_name,
                    outsource_sheets: mg.assigned_outsource_sheets,
                    outsource_qty: mg.assigned_outsource_ups,
                    outsource_rate: mg.outsource_rate,
                    outsource_delivery_date: mg.outsource_delivery_date,
                    vendor_id: mg.vendor_id,
                    current_stage_idx: 0,
                    status: mg.status || 'Pending'
                }] : []);

            assignments.forEach((assign, idx) => {
                const uniqueKey = `${job._id}-${mg._id || mg.group_id}-${idx}`;
                allAssignments.push({
                    ...assign,
                    job_no: job.job_no,
                    sub_job_no: job.sub_job_no,
                    client_name: job.client_name,
                    process_name: job.process_name,
                    group_name: mg.group_name,
                    materials: mg.materials,
                    job_id: job._id,
                    mg_id: mg._id || mg.group_id,
                    assign_idx: idx,
                    uniqueKey,
                    is_hold: job.is_hold,
                    hold_remarks: job.hold_remarks,
                    mg_input: mg.input,
                    mg_sides: mg.sides
                });
            });
        });
    });

    const timelineSteps = [
        { label: 'Material Delivered', key: 'material_delivered', btn: 'MARK: PROOF APPROVED' },
        { label: 'Proof Approved', key: 'proof_approved', btn: 'MARK: JOB INITIATED' },
        { label: 'Job Initiated', key: 'job_initiated', btn: 'MARK: QTY RECD (BATCH 1)' },
        { label: 'Qty Recd (Batch 1)', key: 'qty_recd_1', btn: 'MARK: QTY RECD (BATCH 2)' },
        { label: 'Qty Recd (Batch 2)', key: 'qty_recd_2', btn: 'MARK: JOB CLOSURE' },
        { label: 'Job Closure', key: 'job_closure', btn: 'MARK: INVOICE APPROVED' },
        { label: 'Invoice Approved', key: 'invoice_approved', btn: 'COMPLETED' }
    ];

    const handleNextStage = async (assign) => {
        if (assign.is_hold) {
            toast.error("Cannot transition stage: Job is currently on hold.");
            return;
        }
        const nextIdx = (assign.current_stage_idx || 0) + 1;
        if (nextIdx >= timelineSteps.length) return;

        let uploadedInvoiceUrl = "";
        let uploadedInvoiceFileName = "";

        // Validation for invoice details if moving from Job Closure to Invoice Approved
        if (assign.current_stage_idx === 5) {
            const rawInvoices = assign.invoices?.length > 0 ? assign.invoices : (assign.invoice_no ? [{ invoice_no: assign.invoice_no }] : []);
            const actualRecdQty = assign.batch_receipts?.filter(b => b.type === 'actual').reduce((sum, b) => sum + (Number(b.qty) || 0), 0) || 0;
            const totalAlreadyInvoiced = rawInvoices.reduce((sum, inv) => sum + (Number(inv.invoice_qty) || 0), 0);
            const remainingInwardBalance = Math.max(0, actualRecdQty - totalAlreadyInvoiced);

            if (actualRecdQty <= 0) {
                toast.error("Cannot complete: No quantity has been inwarded yet. Please add an actual batch receipt first.");
                return;
            }

            if (remainingInwardBalance > 0) {
                toast.warning(`Cannot mark as Completed: ${remainingInwardBalance} inwarded pieces are not yet invoiced. Please add an invoice above first.`);
                return;
            }

            const hasExistingInvoice = rawInvoices.length > 0;
            // Only require invoice inputs if NO invoice has been recorded yet:
            if (!hasExistingInvoice) {
                const actualRecdQty = assign.batch_receipts?.filter(b => b.type === 'actual').reduce((sum, b) => sum + (Number(b.qty) || 0), 0) || 0;
                if (actualRecdQty <= 0) {
                    toast.error("Cannot invoice: No quantity has been inwarded yet. Please add an actual batch receipt first.");
                    return;
                }

                const numQty = parseFloat(invoiceInputs.qty);
                const numRate = parseFloat(invoiceInputs.rate);
                const numAmt = parseFloat(invoiceInputs.amt);
                if (!invoiceInputs.no?.trim()) {
                    toast.warning("Please enter Invoice Number or add an invoice above first");
                    setActiveInvoiceAddKey(assign.uniqueKey);
                    return;
                }
                if (isNaN(numQty) || numQty <= 0) {
                    toast.warning("Invoice Quantity is mandatory and must be greater than 0");
                    return;
                }
                if (isNaN(numRate) || numRate <= 0) {
                    toast.warning("Per Qty Rate is mandatory and must be greater than 0");
                    return;
                }
                if (isNaN(numAmt) || numAmt <= 0) {
                    toast.warning("Invoice Amount is mandatory and must be greater than 0");
                    return;
                }
                if (!invoiceInputs.file) {
                    toast.warning("Invoice Document file upload is mandatory");
                    return;
                }

                const totalAlreadyInvoiced = rawInvoices.reduce((sum, inv) => sum + (Number(inv.invoice_qty) || 0), 0);
                const remainingInwardBalance = Math.max(0, actualRecdQty - totalAlreadyInvoiced);

                if (numQty > remainingInwardBalance) {
                    toast.error(`Invoice quantity (${numQty} pcs) cannot exceed inwarded balance of ${remainingInwardBalance} pcs. (Total inwarded: ${actualRecdQty} pcs, already invoiced: ${totalAlreadyInvoiced} pcs)`);
                    return;
                }

                try {
                    setIsUploadingInvoice(true);
                    const formData = new FormData();
                    formData.append("invoice_file", invoiceInputs.file);
                    const uploadRes = await axiosInstance.post("/shop-floor/outsource/upload-invoice", formData, {
                        headers: { "Content-Type": "multipart/form-data" }
                    });
                    if (uploadRes.data?.success && uploadRes.data.url) {
                        uploadedInvoiceUrl = uploadRes.data.url;
                        uploadedInvoiceFileName = uploadRes.data.name || invoiceInputs.fileName || invoiceInputs.file.name;
                    } else {
                        toast.error("Failed to upload invoice document");
                        setIsUploadingInvoice(false);
                        return;
                    }
                } catch (upErr) {
                    console.error("Invoice upload error:", upErr);
                    toast.error(upErr.response?.data?.message || "Failed to upload invoice file");
                    setIsUploadingInvoice(false);
                    return;
                } finally {
                    setIsUploadingInvoice(false);
                }
            }
        }

        const payload = {
            material_group_id: assign.mg_id,
            is_outsource: true,
            outsource_details: {
                assignment_index: assign.assign_idx,
                stage_update: {
                    stage_idx: nextIdx,
                    stage_label: timelineSteps[nextIdx].label,
                    ...(uploadedInvoiceUrl ? {
                        invoice_no: invoiceInputs.no.trim(),
                        invoice_date: formatDateForBackend(invoiceInputs.date),
                        invoice_qty: parseFloat(invoiceInputs.qty) || 0,
                        invoice_rate: parseFloat(invoiceInputs.rate) || 0,
                        invoice_amt: parseFloat(invoiceInputs.amt) || 0,
                        invoice_url: uploadedInvoiceUrl,
                        invoice_file_name: uploadedInvoiceFileName
                    } : {})
                }
            }
        };

        try {
            await dispatch(updateShopFloorJobStatus({ id: assign.job_id, payload })).unwrap();
            toast.success(`Stage updated to ${timelineSteps[nextIdx].label}`);

            // Reset invoice inputs if they were just submitted
            if (assign.current_stage_idx === 5) {
                const { date } = getCurrentDateTime();
                setInvoiceInputs({ no: '', date, rate: '', amt: '', qty: '', file: null, fileName: '', filePreview: '' });
            }

            dispatch(fetchShopFloorJobs());
        } catch (err) {
            toast.error(err?.message || "Failed to update stage");
        }
    };

    const handleAddSubsequentInvoice = async (assign) => {
        if (assign.is_hold) {
            toast.error("Cannot add invoice: Job is currently on hold.");
            return;
        }

        const actualRecdQty = assign.batch_receipts?.filter(b => b.type === 'actual').reduce((sum, b) => sum + (Number(b.qty) || 0), 0) || 0;
        if (actualRecdQty <= 0) {
            toast.error("Cannot invoice: No quantity has been inwarded yet. Please add an actual batch receipt first.");
            return;
        }

        const numQty = parseFloat(invoiceInputs.qty);
        const numRate = parseFloat(invoiceInputs.rate);
        const numAmt = parseFloat(invoiceInputs.amt);
        if (!invoiceInputs.no?.trim()) {
            toast.warning("Invoice Number is mandatory");
            return;
        }
        if (isNaN(numQty) || numQty <= 0) {
            toast.warning("Invoice Quantity is mandatory and must be greater than 0");
            return;
        }
        if (isNaN(numRate) || numRate <= 0) {
            toast.warning("Per Qty Rate is mandatory and must be greater than 0");
            return;
        }
        if (isNaN(numAmt) || numAmt <= 0) {
            toast.warning("Invoice Amount is mandatory and must be greater than 0");
            return;
        }
        if (!invoiceInputs.file) {
            toast.warning("Invoice Document file upload is mandatory");
            return;
        }

        const rawInvoices = assign.invoices?.length > 0
            ? assign.invoices
            : (assign.invoice_no ? [{ invoice_no: assign.invoice_no, invoice_qty: assign.invoice_qty || assign.outsource_qty }] : []);
        const totalAlreadyInvoiced = rawInvoices.reduce((sum, inv) => sum + (Number(inv.invoice_qty) || 0), 0);
        const remainingInwardBalance = Math.max(0, actualRecdQty - totalAlreadyInvoiced);

        if (numQty > remainingInwardBalance) {
            toast.error(`Invoice quantity (${numQty} pcs) cannot exceed inwarded balance of ${remainingInwardBalance} pcs. (Total inwarded: ${actualRecdQty} pcs, already invoiced: ${totalAlreadyInvoiced} pcs)`);
            return;
        }

        let uploadedInvoiceUrl = "";
        let uploadedInvoiceFileName = "";
        try {
            setIsUploadingInvoice(true);
            const formData = new FormData();
            formData.append("invoice_file", invoiceInputs.file);
            const uploadRes = await axiosInstance.post("/shop-floor/outsource/upload-invoice", formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            if (uploadRes.data?.success && uploadRes.data.url) {
                uploadedInvoiceUrl = uploadRes.data.url;
                uploadedInvoiceFileName = uploadRes.data.name || invoiceInputs.fileName || invoiceInputs.file.name;
            } else {
                toast.error("Failed to upload invoice document");
                setIsUploadingInvoice(false);
                return;
            }

            const payload = {
                material_group_id: assign.mg_id,
                is_outsource: true,
                outsource_details: {
                    assignment_index: assign.assign_idx,
                    invoice_add: {
                        invoice_no: invoiceInputs.no.trim(),
                        invoice_date: formatDateForBackend(invoiceInputs.date),
                        invoice_qty: numQty,
                        invoice_rate: numRate,
                        invoice_amt: numAmt,
                        invoice_url: uploadedInvoiceUrl,
                        invoice_file_name: uploadedInvoiceFileName
                    }
                }
            };

            await dispatch(updateShopFloorJobStatus({ id: assign.job_id, payload })).unwrap();
            toast.success("Vendor Invoice saved successfully!");
            const { date } = getCurrentDateTime();
            setInvoiceInputs({ no: '', date, rate: '', amt: '', qty: '', file: null, fileName: '', filePreview: '' });
            setActiveInvoiceAddKey(null);
            dispatch(fetchShopFloorJobs());
        } catch (err) {
            console.error("Add invoice error:", err);
            toast.error(err.response?.data?.message || err?.message || "Failed to add invoice");
        } finally {
            setIsUploadingInvoice(false);
        }
    };

    const handleOpenInvoiceDoc = (e, url) => {
        if (e) e.preventDefault();
        if (!url) return;
        // If already signed by backend with credentials/token
        if (url.includes('X-Amz-Signature') || url.includes('X-Amz-Algorithm') || url.includes('token=')) {
            window.open(url, '_blank', 'noopener,noreferrer');
            return;
        }
        // Fallback for raw R2 URLs: use the backend /image/view streaming/redirect endpoint
        const baseUrl = axiosInstance.defaults?.baseURL || '';
        const cleanBaseUrl = baseUrl.replace(/\/$/, '');
        const viewEndpoint = `${cleanBaseUrl}/image/view?url=${encodeURIComponent(url)}`;
        window.open(viewEndpoint, '_blank', 'noopener,noreferrer');
    };

    const handleDeleteInvoice = async (assign, invoiceNo) => {
        if (assign.is_hold) {
            toast.error("Cannot delete invoice: Job is currently on hold.");
            return;
        }
        if (!window.confirm(`Are you sure you want to delete Invoice #${invoiceNo}?`)) {
            return;
        }

        try {
            const payload = {
                material_group_id: assign.mg_id,
                is_outsource: true,
                outsource_details: {
                    assignment_index: assign.assign_idx,
                    invoice_delete: {
                        invoice_no: invoiceNo
                    }
                }
            };
            await dispatch(updateShopFloorJobStatus({ id: assign.job_id, payload })).unwrap();
            toast.success(`Invoice #${invoiceNo} removed successfully!`);
            dispatch(fetchShopFloorJobs());
        } catch (err) {
            console.error("Delete invoice error:", err);
            toast.error(err.response?.data?.message || err?.message || "Failed to delete invoice");
        }
    };

    const handleAddBatch = async (assign) => {
        if (assign.is_hold) {
            toast.error("Cannot add batch receipt: Job is currently on hold.");
            return;
        }
        if (!batchInputs.qty || !batchInputs.date || !batchInputs.time) {
            toast.warning("Please fill all batch details");
            return;
        }

        const inputQty = Number(batchInputs.qty);
        const currentRecd = assign.batch_receipts?.filter(b => b.type === 'actual').reduce((sum, b) => sum + (b.qty || 0), 0) || 0;
        const totalOrdered = assign.outsource_qty || 0;

        if (batchInputs.type === 'actual' && (currentRecd + inputQty) > totalOrdered) {
            toast.error(`Cannot exceed ordered quantity. Remaining balance: ${(totalOrdered - currentRecd).toLocaleString()} pcs`);
            return;
        }

        if (inputQty > totalOrdered) {
            toast.error(`Batch quantity cannot exceed total ordered (${totalOrdered.toLocaleString()} pcs)`);
            return;
        }

        const { date: today, time: now } = getCurrentDateTime();
        if (batchInputs.date < today) {
            toast.error("Cannot select a past date");
            return;
        }
        if (batchInputs.date === today && batchInputs.time < now) {
            toast.error("Cannot select a past time for today");
            return;
        }

        const payload = {
            material_group_id: assign.mg_id,
            is_outsource: true,
            outsource_details: {
                assignment_index: assign.assign_idx,
                batch_add: {
                    type: batchInputs.type,
                    qty: batchInputs.qty,
                    date: formatDateForBackend(batchInputs.date),
                    time: formatTimeForBackend(batchInputs.time)
                }
            }
        };

        try {
            await dispatch(updateShopFloorJobStatus({ id: assign.job_id, payload })).unwrap();
            toast.success("Batch added successfully");
            const { date, time } = getCurrentDateTime();
            setBatchInputs({ qty: '', date, time, type: 'actual' });
            dispatch(fetchShopFloorJobs());
        } catch (err) {
            toast.error(err?.message || "Failed to add batch");
        }
    };

    return (
        <div className="fixed inset-y-0 right-0 w-full sm:w-[540px] md:w-[650px] max-w-full bg-[#f8fafc] shadow-2xl z-[100] flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="flex-shrink-0 px-6 py-1.5 bg-[#1e293b] text-white flex justify-between items-center shadow-lg">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                        <ShoppingCart className="w-5 h-4 text-slate-100" />
                    </div>
                    <div>
                        <span className="text-lg font-[1000] text-slate-100 tracking-widest uppercase italic">OUTSOURCE MANAGER</span><br />
                        <span className="text-[10px] font-[1000] text-slate-100 uppercase tracking-tight">{allAssignments.length} ASSIGNMENTS ACTIVE</span>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin scrollbar-thumb-slate-300 bg-white">
                {allAssignments.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60 italic">
                        <Package className="w-12 h-12 mb-3 stroke-1" />
                        <p className="text-xs font-black uppercase tracking-widest">No active outsource assignments</p>
                    </div>
                ) : (
                    allAssignments.map((assign, idx) => {
                        const isCompleted = assign.status === 'Completed' || assign.current_stage_idx === 6;
                        const mainMat = assign.materials?.find(m => m.type === 'Main') || assign.materials?.[0];
                        const isUv = assign.process_name?.toUpperCase().includes('PRINTING') || assign.process_name?.toUpperCase().includes('UV');

                        const getPieceDimsLocal = (mgInput, mat) => {
                            const isSheet = mat?.material_type === 'sheet';
                            if (!isSheet) {
                                if (mgInput?.length && mgInput?.width) {
                                    return { l: mgInput.length, w: mgInput.width };
                                }
                                if (mgInput?.baselength && mgInput?.basewidth) {
                                    return { l: mgInput.baselength, w: mgInput.basewidth };
                                }
                            } else {
                                if (mat?.material_input?.one_up_length && mat?.material_input?.one_up_width) {
                                    return { l: mat.material_input.one_up_length, w: mat.material_input.one_up_width };
                                }
                                if (mat?.material_input?.size) {
                                    const parts = mat.material_input.size.toLowerCase().split('x').map(p => parseFloat(p.replace(/[^0-9.]/g, '')) || 0);
                                    if (parts.length >= 2) return { l: parts[0], w: parts[1] };
                                }
                            }
                            // Fallbacks
                            if (mgInput?.length && mgInput?.width) {
                                return { l: mgInput.length, w: mgInput.width };
                            }
                            if (mgInput?.baselength && mgInput?.basewidth) {
                                return { l: mgInput.baselength, w: mgInput.basewidth };
                            }
                            if (mat?.material_input?.one_up_length && mat?.material_input?.one_up_width) {
                                return { l: mat.material_input.one_up_length, w: mat.material_input.one_up_width };
                            }
                            return { l: 0, w: 0 };
                        };

                        const printableMat = assign.materials?.find(m => {
                            const cat = m.category_type?.toLowerCase() || "";
                            return !cat.includes('consumable') && !cat.includes('hardware');
                        }) || assign.materials?.[0];

                        const { l: pieceLength, w: pieceWidth } = getPieceDimsLocal(assign.mg_input, printableMat);
                        const sqInPerPiece = parseFloat(pieceLength) * parseFloat(pieceWidth) || 0;
                        const totalSqIn = sqInPerPiece * (parseFloat(assign.outsource_qty) || 0);
                        const totalCost = isUv
                            ? totalSqIn * (parseFloat(assign.outsource_rate) || 0)
                            : (parseFloat(assign.outsource_sheets) || 0) * (parseFloat(assign.outsource_rate) || 0);

                        const rawInvoices = assign.invoices?.length > 0
                            ? assign.invoices
                            : (assign.invoice_no ? [{
                                invoice_no: assign.invoice_no,
                                invoice_date: assign.invoice_date,
                                invoice_qty: assign.invoice_qty || assign.outsource_qty,
                                invoice_rate: assign.invoice_rate || assign.outsource_rate,
                                invoice_amt: assign.invoice_amt,
                                invoice_url: assign.invoice_url,
                                invoice_file_name: assign.invoice_file_name
                            }] : []);

                        const actualRecdQty = assign.batch_receipts?.filter(b => b.type === 'actual').reduce((sum, b) => sum + (Number(b.qty) || 0), 0) || 0;
                        const totalInvoicedQty = rawInvoices.reduce((sum, inv) => sum + (Number(inv.invoice_qty) || 0), 0);
                        const totalInvoicedAmt = rawInvoices.reduce((sum, inv) => sum + (Number(inv.invoice_amt) || 0), 0);
                        const remainingInwardBalance = Math.max(0, actualRecdQty - totalInvoicedQty);
                        const totalOrdered = assign.outsource_qty || 0;
                        const overallOrderedBalance = Math.max(0, totalOrdered - totalInvoicedQty);

                        return (
                            <div key={assign.uniqueKey} className={`rounded-[2.5rem] border ${assign.is_hold ? 'border-amber-400 bg-amber-50/10' : isCompleted ? 'border-emerald-200 bg-emerald-50/20' : 'border-purple-200 bg-purple-50/20'} overflow-hidden shadow-sm hover:shadow-md transition-all duration-500 group mb-6`}>
                                {/* Header */}
                                <div className={`px-6 py-4 border-b ${assign.is_hold ? 'border-amber-100 bg-amber-50/50' : isCompleted ? 'border-emerald-100' : 'border-purple-100'} flex justify-between items-center`}>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] font-black ${assign.is_hold ? 'text-amber-700' : isCompleted ? 'text-emerald-700' : 'text-purple-700'} uppercase tracking-widest`}>
                                                JOB: {assign.job_no} — {assign.sub_job_no}
                                            </span>
                                            {/* Vendor Outsource Status Badge */}
                                            {(!assign.status || assign.status === 'Pending') && (
                                                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 text-[8px] font-black uppercase tracking-widest shadow-sm">
                                                    ⏳ Pending Vendor
                                                </span>
                                            )}
                                            {(assign.status === 'Confirmed' || assign.status === 'In Progress') && (
                                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[8px] font-black uppercase tracking-widest shadow-sm">
                                                    ✓ Confirmed
                                                </span>
                                            )}
                                            {assign.status === 'Rejected' && (
                                                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 text-[8px] font-black uppercase tracking-widest shadow-sm animate-pulse">
                                                    ✗ Declined
                                                </span>
                                            )}
                                            {assign.is_hold && (
                                                <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[8px] font-black uppercase tracking-widest animate-pulse flex items-center gap-1 shadow-sm">
                                                    On Hold
                                                </span>
                                            )}
                                        </div>
                                        <p className={`text-[9px] font-black ${assign.is_hold ? 'text-amber-500' : isCompleted ? 'text-emerald-400' : 'text-purple-400'} uppercase tracking-tight mt-0.5`}>
                                            {assign.is_hold ? 'OPERATION PAUSED' : isCompleted ? 'INVOICE APPROVED — STAGE 7/7' : `${timelineSteps[assign.current_stage_idx || 0]?.label.toUpperCase()} — STAGE ${(assign.current_stage_idx || 0) + 1}/7`}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => setShowHistory({ id: assign.uniqueKey, type: 'stage', data: assign.stage_history })}
                                            className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
                                        >
                                            <History className="w-4 h-4" />
                                        </button>
                                        <div className="text-right">
                                            {isCompleted ? (
                                                <div className="flex items-center gap-2 px-4 py-1.5 bg-white border border-emerald-200 rounded-xl text-emerald-600 text-[10px] font-black uppercase shadow-sm">
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                    JOB CLOSED
                                                </div>
                                            ) : (
                                                <span className="text-[9px] font-[1000] text-purple-700 uppercase tracking-widest bg-white/50 px-3 py-1.5 rounded-lg border border-purple-200/30 shadow-sm block">
                                                    {timelineSteps[assign.current_stage_idx || 0]?.label.toUpperCase()}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="p-6">
                                    {assign.is_hold && (
                                        <div className="mb-5 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3 shadow-inner">
                                            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 animate-pulse" />
                                            <div>
                                                <h5 className="text-[10px] font-black text-amber-800 uppercase tracking-widest mb-0.5">THIS OUTSOURCE ASSIGNMENT IS ON HOLD</h5>
                                                <p className="text-[9px] font-bold text-amber-600 uppercase tracking-wide leading-tight">
                                                    Reason: {assign.hold_remarks || "Hold active from Production Floor or DTP studio"}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {assign.status === 'Rejected' && (
                                        <div className="mb-5 p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 shadow-inner">
                                            <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 animate-pulse" />
                                            <div>
                                                <h5 className="text-[10px] font-black text-rose-800 uppercase tracking-widest mb-0.5">THIS ASSIGNMENT WAS DECLINED BY THE VENDOR</h5>
                                                <p className="text-[9px] font-bold text-rose-600 uppercase tracking-wide leading-tight">
                                                    Reason: {assign.rejection_reason || "No reason provided"}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="mb-5">
                                        <h4 className={`text-[10px] font-black ${isCompleted ? 'text-emerald-700' : 'text-purple-700'} uppercase tracking-[0.2em] mb-3`}>OUTSOURCED MATERIALS</h4>
                                        <div className="flex gap-12">
                                            <div>
                                                <p className={`text-[8px] font-[1000] ${isCompleted ? 'text-emerald-400' : 'text-purple-400'} uppercase tracking-tight mb-0.5`}>CUSTOMER</p>
                                                <p className={`text-[11px] font-[1000] ${isCompleted ? 'text-emerald-900' : 'text-purple-900'} uppercase`}>{assign.client_name}</p>
                                            </div>
                                            <div>
                                                <p className={`text-[8px] font-[1000] ${isCompleted ? 'text-emerald-400' : 'text-purple-400'} uppercase tracking-tight mb-0.5`}>DUE DATE</p>
                                                <p className={`text-[11px] font-[1000] ${isCompleted ? 'text-emerald-900' : 'text-purple-900'} uppercase`}>30-Mar-2026</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Specs Card */}
                                    <div className={`bg-white rounded-2xl border ${isCompleted ? 'border-emerald-100 shadow-emerald-50/50' : 'border-purple-100 shadow-sm'} p-5 mb-6 transition-colors duration-500`}>
                                        <h5 className={`text-[11px] font-[1000] ${isCompleted ? 'text-emerald-900' : 'text-purple-900'} uppercase mb-4`}>
                                            {assign.group_name} — {mainMat?.material_input?.size || '-'}
                                        </h5>

                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-5 gap-x-3">
                                            {/* Row 1 */}
                                            <div>
                                                <p className={`text-[8px] font-black ${isCompleted ? 'text-emerald-400' : 'text-purple-400'} uppercase tracking-widest mb-1`}>SIZE</p>
                                                <p className="text-[11px] font-[1000] text-slate-800 uppercase">{mainMat?.material_input?.size || '-'}</p>
                                            </div>
                                            <div>
                                                <p className={`text-[8px] font-black ${isCompleted ? 'text-emerald-400' : 'text-purple-400'} uppercase tracking-widest mb-1`}>SQ.IN</p>
                                                <p className="text-[11px] font-[1000] text-slate-800 uppercase">
                                                    {isUv && totalSqIn > 0
                                                        ? (totalSqIn > 1000 ? (totalSqIn / 1000).toFixed(1) + 'k' : Math.round(totalSqIn).toLocaleString())
                                                        : '-'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className={`text-[8px] font-black ${isCompleted ? 'text-emerald-400' : 'text-purple-400'} uppercase tracking-widest mb-1`}>PRINT SIDES</p>
                                                <p className="text-[11px] font-[1000] text-slate-800 uppercase">
                                                    {isUv ? `${assign.mg_sides || 1} side` : '-'}
                                                </p>
                                            </div>

                                            {/* Row 2 */}
                                            <div>
                                                <p className={`text-[8px] font-black ${isCompleted ? 'text-emerald-400' : 'text-purple-400'} uppercase tracking-widest mb-1`}>{isUv ? 'PIECES SENT' : 'SHEETS SENT'}</p>
                                                <p className="text-[11px] font-[1000] text-slate-800 uppercase">
                                                    {isUv ? `${(assign.outsource_qty || 0).toLocaleString()} pcs` : `${assign.outsource_sheets} sheets = ${(assign.outsource_qty || 0).toLocaleString()} pcs`}
                                                </p>
                                            </div>
                                            <div>
                                                <p className={`text-[8px] font-black ${isCompleted ? 'text-emerald-400' : 'text-purple-400'} uppercase tracking-widest mb-1`}>RATE</p>
                                                <p className="text-[11px] font-[1000] text-slate-800 uppercase">₹{assign.outsource_rate || 0}/{isUv ? 'sq. in' : 'min'}</p>
                                            </div>
                                            <div>
                                                <p className={`text-[8px] font-black ${isCompleted ? 'text-emerald-400' : 'text-purple-400'} uppercase tracking-widest mb-1`}>
                                                    {isUv ? 'CYCLES' : 'UPS'}
                                                </p>
                                                <p className="text-[11px] font-[1000] text-slate-800 uppercase">
                                                    {isUv ? '20' : (mainMat?.material_input?.ups || '-')}
                                                </p>
                                            </div>

                                            {/* Row 3 */}
                                            <div>
                                                <p className={`text-[8px] font-black ${isCompleted ? 'text-emerald-400' : 'text-purple-400'} uppercase tracking-widest mb-1`}>DELIVERY</p>
                                                <p className="text-[11px] font-[1000] text-slate-800 uppercase">{assign.outsource_delivery_date || '-'}</p>
                                            </div>
                                            <div>
                                                <p className={`text-[8px] font-black ${isCompleted ? 'text-emerald-400' : 'text-purple-400'} uppercase tracking-widest mb-1`}>RATE/UNIT</p>
                                                <p className="text-[11px] font-[1000] text-slate-800 uppercase">
                                                    {isUv ? `₹${(sqInPerPiece * (parseFloat(assign.outsource_rate) || 0)).toFixed(2)}` : '-'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className={`text-[8px] font-black ${isCompleted ? 'text-emerald-400' : 'text-purple-400'} uppercase tracking-widest mb-1`}>TOTAL VALUE</p>
                                                <p className="text-[11px] font-[1000] text-slate-800 uppercase">
                                                    {totalCost > 0 ? `₹${Math.round(totalCost)}` : '-'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Vendor Footer */}
                                        <div className={`mt-6 pt-3 border-t ${isCompleted ? 'border-emerald-50' : 'border-purple-50'} flex justify-between items-center`}>
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 bg-slate-100 rounded-md">
                                                    <Factory className="w-3 h-3 text-slate-600" />
                                                </div>
                                                <span className="text-[10px] font-black text-slate-700 uppercase italic">
                                                    {assign.vendor_name || 'Pending'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-3 h-3 text-slate-400" />
                                                <span className="text-[9px] font-black text-slate-500 uppercase">
                                                    Del: {assign.outsource_delivery_date || '-'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Timeline */}
                                    <div className="px-2 mb-8 overflow-x-auto no-scrollbar pb-6">
                                        <div className="flex items-center justify-between min-w-[480px]">
                                            {timelineSteps.map((step, sIdx) => (
                                                <React.Fragment key={sIdx}>
                                                    <div className="flex flex-col items-center gap-2 relative">
                                                        <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 z-10 transition-all duration-300 ${sIdx <= (assign.current_stage_idx || 0) ? (isCompleted || sIdx < (assign.current_stage_idx || 0) ? 'bg-emerald-500 border-emerald-500' : 'bg-purple-600 border-purple-600 shadow-[0_0_8px_rgba(147,51,234,0.4)]') : 'bg-white border-slate-200'}`}>
                                                            {(isCompleted || sIdx < (assign.current_stage_idx || 0)) && <CheckCircle2 className="w-full h-full text-white p-0.5" />}
                                                        </div>
                                                        <span className={`text-[7px] font-black text-center leading-none uppercase absolute top-6 w-[60px] transition-colors duration-300 ${sIdx <= (assign.current_stage_idx || 0) ? (isCompleted || sIdx < (assign.current_stage_idx || 0) ? 'text-emerald-600' : 'text-purple-700') : 'text-slate-400'}`}>
                                                            {step.label}
                                                        </span>
                                                    </div>
                                                    {sIdx < timelineSteps.length - 1 && (
                                                        <div className={`h-[1.5px] flex-1 mx-[-2px] mt-0.5 mb-0.5 transition-colors duration-300 ${sIdx < (assign.current_stage_idx || 0) || isCompleted ? 'bg-emerald-500' : 'bg-slate-200'}`}></div>
                                                    )}
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    </div>


                                    {/* Batch Receipts Section - Available from Job Initiated (Stage 2) or if any batches exist */}
                                    {((assign.current_stage_idx || 0) >= 2 || (assign.batch_receipts?.length > 0)) && (
                                        <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                            <h4 className="text-[10px] font-black text-purple-700 uppercase tracking-[0.2em] mb-4">BATCH RECEIPTS</h4>

                                            {/* Batch Stats Summary - Only show if batches exist */}
                                            {assign.batch_receipts?.length > 0 && (
                                                <div className="bg-[#0f172a] rounded-2xl p-4 border border-slate-800 shadow-xl mb-6 grid grid-cols-3 divide-x divide-slate-800/50">
                                                    <div className="px-4">
                                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">ORDERED</p>
                                                        <p className="text-xl font-[1000] text-white italic tracking-tighter">{(assign.outsource_qty || 0).toLocaleString()}</p>
                                                    </div>
                                                    <div className="px-4">
                                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">RECD</p>
                                                        <p className="text-xl font-[1000] text-emerald-400 italic tracking-tighter">
                                                            {(assign.batch_receipts?.filter(b => b.type === 'actual').reduce((sum, b) => sum + (b.qty || 0), 0) || 0).toLocaleString()}
                                                        </p>
                                                    </div>
                                                    <div className="px-4">
                                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">BALANCE</p>
                                                        <p className="text-xl font-[1000] text-amber-400 italic tracking-tighter">
                                                            {(assign.outsource_qty - (assign.batch_receipts?.filter(b => b.type === 'actual').reduce((sum, b) => sum + (b.qty || 0), 0) || 0)).toLocaleString()}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Add Batch Form - Only when not completed */}
                                            {!isCompleted && (
                                                <div className="bg-emerald-50/30 rounded-[2.5rem] border border-emerald-100 p-6 shadow-sm mb-6">
                                                    <h5 className="text-[9px] font-black text-emerald-700 uppercase tracking-widest mb-4 ml-1">ADD BATCH</h5>

                                                    {/* Tabs */}
                                                    <div className="grid grid-cols-2 gap-2 mb-5">
                                                        <button
                                                            disabled={assign.is_hold}
                                                            onClick={() => !assign.is_hold && setBatchInputs(prev => ({ ...prev, type: 'actual' }))}
                                                            className={`py-2.5 rounded-xl border text-[10px] font-[1000] uppercase tracking-widest shadow-sm transition-all ${assign.is_hold ? 'opacity-50 cursor-not-allowed grayscale' : ''} ${batchInputs.type === 'actual' ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-white border-slate-200 text-slate-400'}`}
                                                        >
                                                            Actual
                                                        </button>
                                                        <button
                                                            disabled={assign.is_hold}
                                                            onClick={() => !assign.is_hold && setBatchInputs(prev => ({ ...prev, type: 'expected' }))}
                                                            className={`py-2.5 rounded-xl border text-[10px] font-[1000] uppercase tracking-widest shadow-sm transition-all ${assign.is_hold ? 'opacity-50 cursor-not-allowed grayscale' : ''} ${batchInputs.type === 'expected' ? 'bg-amber-500 text-white border-amber-600' : 'bg-white border-slate-200 text-slate-400'}`}
                                                        >
                                                            Expected
                                                        </button>
                                                    </div>

                                                    {/* Form Fields */}
                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                                                        <div>
                                                            <label className="text-[8px] font-black text-emerald-600 uppercase tracking-widest ml-1 mb-1.5 block">QTY</label>
                                                            <input
                                                                type="number"
                                                                disabled={assign.is_hold}
                                                                value={batchInputs.qty}
                                                                onChange={(e) => setBatchInputs(prev => ({ ...prev, qty: e.target.value }))}
                                                                placeholder="50"
                                                                className={`w-full px-3 py-2 bg-white border border-emerald-100 rounded-xl text-[10px] font-black text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-sm ${assign.is_hold ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[8px] font-black text-emerald-600 uppercase tracking-widest ml-1 mb-1.5 block">DATE</label>
                                                            <div className="relative">
                                                                <input
                                                                    type="date"
                                                                    disabled={assign.is_hold}
                                                                    min={getCurrentDateTime().date}
                                                                    value={batchInputs.date}
                                                                    onChange={(e) => setBatchInputs(prev => ({ ...prev, date: e.target.value }))}
                                                                    className={`w-full px-3 py-2 bg-white border border-emerald-100 rounded-xl text-[10px] font-black text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-sm ${assign.is_hold ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="text-[8px] font-black text-emerald-600 uppercase tracking-widest ml-1 mb-1.5 block">TIME</label>
                                                            <div className="relative">
                                                                <input
                                                                    type="time"
                                                                    disabled={assign.is_hold}
                                                                    min={batchInputs.date === getCurrentDateTime().date ? getCurrentDateTime().time : undefined}
                                                                    value={batchInputs.time}
                                                                    onChange={(e) => setBatchInputs(prev => ({ ...prev, time: e.target.value }))}
                                                                    className={`w-full px-3 py-2 bg-white border border-emerald-100 rounded-xl text-[10px] font-black text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-sm ${assign.is_hold ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <button
                                                        disabled={assign.is_hold}
                                                        onClick={() => !assign.is_hold && handleAddBatch(assign)}
                                                        className={`w-full py-2.5 rounded-xl text-[10px] font-[1000] uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 ${assign.is_hold ? 'bg-amber-500/20 text-amber-600 border border-amber-200 cursor-not-allowed shadow-none' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-100'}`}
                                                    >
                                                        {assign.is_hold ? '⚠️ JOB ON HOLD' : <><Plus className="w-4 h-4" /> ADD BATCH</>}
                                                    </button>
                                                </div>
                                            )}

                                            {/* Batch Cards */}
                                            <div className="space-y-4">
                                                {assign.batch_receipts?.slice().reverse().map((batch, bIdx) => (
                                                    <div key={bIdx} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all group relative">
                                                        <div className="flex justify-between items-start mb-3">
                                                            <div>
                                                                <span className="text-xl font-[1000] text-slate-800 italic">{batch.qty}</span>
                                                                <span className="text-[10px] font-black text-slate-400 ml-1 uppercase">PCS</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${batch.type === 'actual' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                                                                    {batch.type}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <div className="flex items-center gap-1.5">
                                                                <Calendar className="w-3 h-3 text-slate-400" />
                                                                <span className="text-[10px] font-bold text-slate-600">{batch.date}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5">
                                                                <Clock className="w-3 h-3 text-slate-400" />
                                                                <span className="text-[10px] font-bold text-slate-600">{batch.time}</span>
                                                            </div>
                                                        </div>
                                                        <div className="mt-3 pt-3 border-t border-slate-50 flex justify-between items-center">
                                                            <button className="text-[9px] font-black text-purple-600 uppercase tracking-widest hover:underline px-3 py-1 bg-purple-50 rounded-lg">
                                                                NOTIFY TEAM
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Unified Vendor Invoices & Bills Section */}
                                    {(() => {
                                        // Show section if Stage >= 2 OR batches exist OR invoices exist OR completed
                                        const shouldShowInvoicesSection = ((assign.current_stage_idx || 0) >= 2) || (assign.batch_receipts?.length > 0) || (rawInvoices.length > 0) || isCompleted;
                                        if (!shouldShowInvoicesSection) return null;

                                        const isFormOpen = activeInvoiceAddKey === assign.uniqueKey;

                                        return (
                                            <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center gap-2">
                                                        <FileText className="w-4 h-4 text-purple-700" />
                                                        <h4 className="text-[10px] font-black text-purple-700 uppercase tracking-[0.2em]">
                                                            VENDOR INVOICES & BILLS
                                                        </h4>
                                                    </div>
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">
                                                        {rawInvoices.length} RECORDED
                                                    </span>
                                                </div>

                                                <div className="p-4 bg-purple-50/50 border border-purple-200/80 rounded-[2.5rem] shadow-sm flex flex-col gap-3">
                                                    {/* Header stats bar */}
                                                    <div className="flex items-center justify-between pb-2 border-b border-purple-100">
                                                        <div className="flex flex-col">
                                                            <span className="text-[9px] font-black text-purple-900 uppercase">
                                                                Invoiced: {totalInvoicedQty.toLocaleString()} / {actualRecdQty.toLocaleString()} INWARDED PCS
                                                            </span>
                                                            <span className="text-[7.5px] font-bold text-slate-400">
                                                                Ordered: {totalOrdered.toLocaleString()} PCS · Pending Inward: {Math.max(0, totalOrdered - actualRecdQty).toLocaleString()} PCS
                                                            </span>
                                                        </div>
                                                        <div>
                                                            {actualRecdQty === 0 ? (
                                                                <span className="text-[8px] font-black text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                                                    0 PCS Inwarded
                                                                </span>
                                                            ) : remainingInwardBalance > 0 ? (
                                                                <span className="text-[8px] font-black text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                                                    Avail to Invoice: {remainingInwardBalance.toLocaleString()} PCS
                                                                </span>
                                                            ) : (
                                                                <span className="text-[8px] font-black text-purple-700 bg-purple-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                                                                    <CheckCircle2 className="w-3 h-3 text-purple-600" /> Inward Fully Invoiced
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* List of recorded invoices */}
                                                    {rawInvoices.length > 0 ? (
                                                        <div className="space-y-2">
                                                            {rawInvoices.map((inv, invIdx) => (
                                                                <div key={invIdx} className="bg-white rounded-2xl p-3 border border-purple-100 shadow-xs flex flex-wrap items-center justify-between gap-2 hover:shadow-sm transition-all">
                                                                    <div className="flex items-center gap-2.5">
                                                                        <span className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 text-[9px] font-[1000] flex items-center justify-center">
                                                                            #{invIdx + 1}
                                                                        </span>
                                                                        <div>
                                                                            <p className="text-[10px] font-[1000] text-slate-800 uppercase tracking-tight">{inv.invoice_no}</p>
                                                                            <p className="text-[8px] font-bold text-slate-400">{inv.invoice_date || '-'}</p>
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex items-center gap-3">
                                                                        <div className="text-right">
                                                                            <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">QTY</p>
                                                                            <p className="text-[10px] font-[1000] text-emerald-700">{inv.invoice_qty || 0} PCS</p>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">RATE</p>
                                                                            <p className="text-[10px] font-[1000] text-purple-800">
                                                                                ₹{Number(inv.invoice_rate !== undefined && inv.invoice_rate !== null && inv.invoice_rate !== ""
                                                                                    ? inv.invoice_rate
                                                                                    : (inv.invoice_qty > 0 && inv.invoice_amt ? (inv.invoice_amt / inv.invoice_qty) : assign.outsource_rate || 0)
                                                                                ).toFixed(2)}
                                                                            </p>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">AMOUNT</p>
                                                                            <p className="text-[10px] font-[1000] text-emerald-900">₹{Number(inv.invoice_amt || 0).toLocaleString('en-IN')}</p>
                                                                        </div>
                                                                        {inv.invoice_url && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => handleOpenInvoiceDoc(e, inv.invoice_url)}
                                                                                className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
                                                                                title="View Invoice Document"
                                                                            >
                                                                                <ExternalLink className="w-3 h-3" />
                                                                                <span>DOC</span>
                                                                            </button>
                                                                        )}
                                                                        {(!isCompleted || remainingInwardBalance > 0) && (
                                                                            <button
                                                                                type="button"
                                                                                disabled={assign.is_hold}
                                                                                onClick={() => handleDeleteInvoice(assign, inv.invoice_no)}
                                                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors ml-0.5"
                                                                                title={`Delete Invoice #${inv.invoice_no}`}
                                                                            >
                                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}

                                                            {/* Total Invoiced Amount Bar */}
                                                            <div className="pt-2 border-t border-purple-200/70 flex justify-between items-center text-[10px] font-[1000] text-purple-950 px-1">
                                                                <span>TOTAL INVOICED:</span>
                                                                <span className="text-emerald-700 text-[11px]">₹{totalInvoicedAmt.toLocaleString('en-IN')}</span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="p-3 bg-white/70 rounded-2xl border border-dashed border-purple-200 text-center">
                                                            <p className="text-[9px] font-bold text-slate-500 mb-1">No invoices recorded yet.</p>
                                                            <p className="text-[8px] text-slate-400">
                                                                {actualRecdQty > 0
                                                                    ? `${actualRecdQty} PCS have been inwarded and are available to invoice.`
                                                                    : "Only inwarded quantities can be invoiced. Add an Actual Batch Receipt above to enable invoicing."}
                                                            </p>
                                                        </div>
                                                    )}

                                                    {/* Add Invoice Button or Notice or Form */}
                                                    {actualRecdQty === 0 ? (
                                                            <div className="mt-1 p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-800 text-[9px] font-bold flex items-center gap-2">
                                                                <span className="text-sm">⚠️</span>
                                                                <span>Please record an <strong>Actual Batch Receipt</strong> above first. Only inwarded pieces can be invoiced.</span>
                                                            </div>
                                                        ) : remainingInwardBalance <= 0 ? (
                                                            <div className="mt-1 py-2.5 px-3 rounded-2xl bg-purple-100/70 border border-purple-300 text-purple-800 text-[10px] font-[1000] uppercase tracking-wider flex items-center justify-center gap-1.5">
                                                                <CheckCircle2 className="w-3.5 h-3.5 text-purple-700" />
                                                                <span>
                                                                    {overallOrderedBalance > 0
                                                                        ? `All ${actualRecdQty} Inwarded PCS Invoiced (${overallOrderedBalance} PCS Pending Next Batch Inward)`
                                                                        : `All ${totalOrdered} PCS Delivered & Fully Invoiced`}
                                                                </span>
                                                            </div>
                                                        ) : !isFormOpen ? (
                                                            <button
                                                                type="button"
                                                                disabled={assign.is_hold}
                                                                onClick={() => {
                                                                    const { date } = getCurrentDateTime();
                                                                    const initialQty = remainingInwardBalance;
                                                                    const initialRate = assign.outsource_rate !== undefined && assign.outsource_rate !== null ? Number(assign.outsource_rate) : 0;
                                                                    const initialAmt = initialQty > 0 && initialRate > 0 ? (Math.round(initialQty * initialRate * 100) / 100).toFixed(2) : '';
                                                                    setInvoiceInputs({
                                                                        no: '',
                                                                        date,
                                                                        rate: initialRate > 0 ? String(initialRate) : '',
                                                                        qty: String(initialQty),
                                                                        amt: initialAmt,
                                                                        file: null,
                                                                        fileName: '',
                                                                        filePreview: ''
                                                                    });
                                                                    setActiveInvoiceAddKey(assign.uniqueKey);
                                                                }}
                                                                className={`mt-1 py-2.5 px-3 rounded-2xl border border-purple-500 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-[1000] uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all ${assign.is_hold ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                            >
                                                                <Plus className="w-4 h-4 text-white" />
                                                                <span>
                                                                    {rawInvoices.length === 0
                                                                        ? `+ RECORD VENDOR INVOICE (MAX: ${remainingInwardBalance.toLocaleString()} INWARDED PCS)`
                                                                        : `+ ADD ANOTHER PARTIAL INVOICE (MAX: ${remainingInwardBalance.toLocaleString()} INWARDED PCS)`}
                                                                </span>
                                                            </button>
                                                        ) : (
                                                            /* Unified Add Invoice Form */
                                                            <div className="mt-2 p-4 bg-white rounded-2xl border-2 border-purple-300 shadow-md animate-in fade-in duration-300">
                                                                <div className="flex items-center justify-between mb-3 pb-2 border-b border-purple-100">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <Plus className="w-4 h-4 text-purple-700" />
                                                                        <span className="text-[10px] font-[1000] text-purple-900 uppercase tracking-wider">
                                                                            {rawInvoices.length === 0 ? 'RECORD VENDOR INVOICE' : 'ADD PARTIAL INVOICE'}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[7px] font-black bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full uppercase">
                                                                            All Fields Mandatory *
                                                                        </span>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setActiveInvoiceAddKey(null)}
                                                                            className="text-[9px] font-bold text-slate-400 hover:text-red-500 uppercase ml-1"
                                                                        >
                                                                            Cancel
                                                                        </button>
                                                                    </div>
                                                                </div>

                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
                                                                    <div>
                                                                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                                                            INVOICE NO. <span className="text-red-500">*</span>
                                                                        </label>
                                                                        <input
                                                                            type="text"
                                                                            value={invoiceInputs.no}
                                                                            onChange={(e) => setInvoiceInputs(prev => ({ ...prev, no: e.target.value }))}
                                                                            placeholder="e.g. INV-2026-001"
                                                                            className="w-full px-2.5 py-2 bg-slate-50 border border-purple-200 rounded-xl text-[10px] font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                                                            INVOICE DATE <span className="text-red-500">*</span>
                                                                        </label>
                                                                        <input
                                                                            type="date"
                                                                            value={invoiceInputs.date}
                                                                            onChange={(e) => setInvoiceInputs(prev => ({ ...prev, date: e.target.value }))}
                                                                            className="w-full px-2.5 py-2 bg-slate-50 border border-purple-200 rounded-xl text-[10px] font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <div className="flex justify-between items-center mb-1">
                                                                            <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">
                                                                                INVOICE QTY <span className="text-red-500">*</span>
                                                                            </label>
                                                                            <span className="text-[7px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                                                                                Max Inward: {remainingInwardBalance} PCS
                                                                            </span>
                                                                        </div>
                                                                        <input
                                                                            type="number"
                                                                            min="1"
                                                                            max={remainingInwardBalance}
                                                                            value={invoiceInputs.qty}
                                                                            onChange={(e) => handleInvoiceQtyChange(e.target.value)}
                                                                            placeholder={`1 to ${remainingInwardBalance}`}
                                                                            className="w-full px-2.5 py-2 bg-slate-50 border border-purple-200 rounded-xl text-[10px] font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <div className="flex justify-between items-center mb-1">
                                                                            <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">
                                                                                PER QTY RATE (₹) <span className="text-red-500">*</span>
                                                                            </label>
                                                                            {assign.outsource_rate > 0 && (
                                                                                <span className="text-[7px] font-bold text-slate-400">
                                                                                    Def: ₹{assign.outsource_rate}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <input
                                                                            type="number"
                                                                            step="0.01"
                                                                            min="0"
                                                                            value={invoiceInputs.rate}
                                                                            onChange={(e) => handleInvoiceRateChange(e.target.value)}
                                                                            placeholder="0.00"
                                                                            className="w-full px-2.5 py-2 bg-slate-50 border border-purple-200 rounded-xl text-[10px] font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                                                                        />
                                                                    </div>
                                                                    <div className="sm:col-span-2">
                                                                        <div className="flex justify-between items-center mb-1">
                                                                            <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">
                                                                                INVOICE AMT (₹) <span className="text-red-500">*</span>
                                                                            </label>
                                                                            <span className="text-[7.5px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                                                                                🔒 Auto-calculated (Qty × Rate)
                                                                            </span>
                                                                        </div>
                                                                        <input
                                                                            type="number"
                                                                            step="0.01"
                                                                            min="0"
                                                                            readOnly
                                                                            value={invoiceInputs.amt}
                                                                            placeholder="0.00 (Auto-calculated)"
                                                                            className="w-full px-2.5 py-2 bg-slate-100 border border-purple-200 rounded-xl text-[10px] font-black text-slate-700 cursor-not-allowed focus:outline-none select-none"
                                                                        />
                                                                    </div>
                                                                </div>

                                                                {/* File upload for invoice */}
                                                                <div className="mb-3">
                                                                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                                                        INVOICE FILE (PDF / IMAGE) <span className="text-red-500">*</span>
                                                                    </label>
                                                                    <input
                                                                        type="file"
                                                                        id={`unified-invoice-file-${assign.uniqueKey}`}
                                                                        accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
                                                                        className="hidden"
                                                                        onChange={(e) => {
                                                                            const file = e.target.files?.[0];
                                                                            if (file) {
                                                                                setInvoiceInputs(prev => ({
                                                                                    ...prev,
                                                                                    file,
                                                                                    fileName: file.name,
                                                                                    filePreview: file.type.startsWith('image/') ? URL.createObjectURL(file) : ''
                                                                                }));
                                                                            }
                                                                        }}
                                                                    />
                                                                    {!invoiceInputs.file ? (
                                                                        <label
                                                                            htmlFor={`unified-invoice-file-${assign.uniqueKey}`}
                                                                            className="border-2 border-dashed border-purple-300 hover:border-purple-500 bg-purple-50/40 rounded-xl p-3 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all"
                                                                        >
                                                                            <Upload className="w-5 h-5 text-purple-600 animate-bounce" />
                                                                            <span className="text-[9px] font-black text-purple-700 uppercase">
                                                                                Choose Invoice Document (PDF, PNG, JPG)
                                                                            </span>
                                                                            <span className="text-[7px] font-bold text-slate-400">
                                                                                Max file size: 10MB · Mandatory
                                                                            </span>
                                                                        </label>
                                                                    ) : (
                                                                        <div className="bg-slate-50 border-2 border-emerald-400 rounded-xl p-2.5 flex items-center justify-between shadow-xs">
                                                                            <div className="flex items-center gap-2 truncate">
                                                                                <FileText className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                                                                <span className="text-[9px] font-black text-slate-700 truncate">{invoiceInputs.fileName}</span>
                                                                            </div>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setInvoiceInputs(prev => ({ ...prev, file: null, fileName: '', filePreview: '' }))}
                                                                                className="text-red-500 hover:text-red-700 p-1 rounded-lg"
                                                                                title="Remove file"
                                                                            >
                                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <button
                                                                    type="button"
                                                                    disabled={isUploadingInvoice}
                                                                    onClick={() => handleAddSubsequentInvoice(assign)}
                                                                    className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-[10px] font-[1000] uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all disabled:opacity-50"
                                                                >
                                                                    {isUploadingInvoice ? (
                                                                        <>⏳ Uploading Document & Saving...</>
                                                                    ) : (
                                                                        <>
                                                                            <Plus className="w-3.5 h-3.5" /> SAVE INVOICE DETAILS
                                                                        </>
                                                                    )}
                                                                </button>
                                                            </div>
                                                        )
                                                    }
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {isCompleted ? (
                                        remainingInwardBalance > 0 ? (
                                            <div className="mt-3 p-4 bg-amber-500/10 border border-amber-300 rounded-2xl flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-amber-200">
                                                    <AlertTriangle className="w-6 h-6 text-white" />
                                                </div>
                                                <div>
                                                    <h4 className="text-[11px] font-[1000] text-amber-900 uppercase tracking-widest mb-0.5">INWARD PENDING INVOICE ({remainingInwardBalance.toLocaleString()} PCS)</h4>
                                                    <p className="text-[9px] font-black text-amber-700 uppercase tracking-tight opacity-90">Remaining {remainingInwardBalance.toLocaleString()} inwarded pieces must be invoiced above.</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="mt-3 p-4 bg-emerald-500/10 border border-emerald-200 rounded-2xl flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-emerald-200">
                                                    <CheckCircle2 className="w-6 h-6 text-white" />
                                                </div>
                                                <div>
                                                    <h4 className="text-[11px] font-[1000] text-emerald-800 uppercase tracking-widest mb-0.5">OUTSOURCE COMPLETE</h4>
                                                    <p className="text-[9px] font-black text-emerald-600 uppercase tracking-tight opacity-90 italic">All {totalOrdered.toLocaleString()} PCS Delivered & Fully Invoiced</p>
                                                </div>
                                            </div>
                                        )
                                    ) : (() => {
                                        const isNextDisabled = assign.is_hold || isUploadingInvoice || (assign.status !== 'Confirmed' && assign.status !== 'In Progress');
                                        const rawInvoices = assign.invoices?.length > 0
                                            ? assign.invoices
                                            : (assign.invoice_no ? [{ invoice_no: assign.invoice_no }] : []);
                                        const isStage5 = (assign.current_stage_idx || 0) === 5;

                                        const buttonText = assign.is_hold
                                            ? '⚠️ JOB ON HOLD'
                                            : isUploadingInvoice
                                                ? '⏳ UPLOADING INVOICE & APPROVING...'
                                                : ((assign.status !== 'Confirmed' && assign.status !== 'In Progress')
                                                    ? '⏳ AWAITING VENDOR CONFIRMATION'
                                                    : isStage5
                                                        ? (rawInvoices.length > 0 ? '✓ MARK: JOB COMPLETED & ARCHIVE' : '+ RECORD INVOICE TO COMPLETE JOB')
                                                        : `→ ${timelineSteps[assign.current_stage_idx || 0]?.btn || 'COMPLETED'}`);
                                        const buttonColorClasses = assign.is_hold
                                            ? 'bg-amber-500/20 text-amber-600 border border-amber-200 cursor-not-allowed shadow-none'
                                            : isUploadingInvoice
                                                ? 'bg-purple-400 text-white cursor-wait shadow-none'
                                                : ((assign.status !== 'Confirmed' && assign.status !== 'In Progress')
                                                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none'
                                                    : isStage5
                                                        ? (rawInvoices.length > 0 ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200' : 'bg-purple-600 text-white hover:bg-purple-700 shadow-purple-200')
                                                        : 'bg-purple-600 text-white hover:bg-purple-700 shadow-purple-100');

                                        return (
                                            <button
                                                disabled={isNextDisabled}
                                                onClick={() => {
                                                    if (isNextDisabled) return;
                                                    if (isStage5 && rawInvoices.length === 0) {
                                                        const actualRecdQty = assign.batch_receipts?.filter(b => b.type === 'actual').reduce((sum, b) => sum + (Number(b.qty) || 0), 0) || 0;
                                                        if (actualRecdQty <= 0) {
                                                            toast.warning("Cannot invoice: No quantity has been inwarded yet. Please record an actual batch receipt first.");
                                                            return;
                                                        }
                                                        const { date } = getCurrentDateTime();
                                                        const totalAlreadyInvoiced = rawInvoices.reduce((sum, inv) => sum + (Number(inv.invoice_qty) || 0), 0);
                                                        const remainingInwardBalance = Math.max(0, actualRecdQty - totalAlreadyInvoiced);
                                                        setInvoiceInputs({
                                                            no: '',
                                                            date,
                                                            amt: '',
                                                            qty: String(remainingInwardBalance || ''),
                                                            file: null,
                                                            fileName: '',
                                                            filePreview: ''
                                                        });
                                                        setActiveInvoiceAddKey(assign.uniqueKey);
                                                        toast.info("Please fill and save the vendor invoice details above.");
                                                        return;
                                                    }
                                                    handleNextStage(assign);
                                                }}
                                                className={`w-full mt-6 py-3 rounded-2xl text-[11px] font-[1000] uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 ${buttonColorClasses}`}
                                            >
                                                {buttonText}
                                            </button>
                                        );
                                    })()}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* History Sidebar/Overlay */}
            {showHistory && (
                <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-[110] animate-in fade-in slide-in-from-right duration-300 flex flex-col">
                    <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                        <div className="flex items-center gap-3">
                            <History className="w-5 h-5 text-purple-600" />
                            <h3 className="text-sm font-[1000] text-slate-800 uppercase tracking-widest">
                                {showHistory.type.toUpperCase()} HISTORY
                            </h3>
                        </div>
                        <button onClick={() => setShowHistory(null)} className="p-2 hover:bg-white rounded-full shadow-sm">
                            <X className="w-5 h-5 text-slate-500" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {showHistory.data?.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-slate-400 italic text-xs uppercase tracking-widest">
                                No history records found
                            </div>
                        ) : (
                            showHistory.data?.slice().reverse().map((entry, hIdx) => (
                                <div key={hIdx} className="relative pl-6 border-l-2 border-purple-100 py-1">
                                    <div className="absolute -left-[9px] top-2 w-4 h-4 rounded-full bg-white border-2 border-purple-500 flex items-center justify-center">
                                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                                    </div>
                                    <div className="mb-1">
                                        <span className="text-[10px] font-[1000] text-slate-800 uppercase tracking-tight">
                                            {entry.stage_label}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-[9px] font-black text-slate-400 uppercase tracking-tight">
                                        <div className="flex items-center gap-1">
                                            <Calendar className="w-2.5 h-2.5" /> {entry.updated_at || entry.date}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <User className="w-2.5 h-2.5" /> {entry.updated_by?.name || 'System User'}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default OutsourceManager;
