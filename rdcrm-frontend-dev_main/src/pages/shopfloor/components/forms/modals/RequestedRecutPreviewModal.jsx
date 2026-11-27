import React from 'react';
import { Play, X } from 'lucide-react';
import { toast } from 'react-toastify';

const RequestedRecutPreviewModal = ({
    show,
    onClose,
    isUv = false,
    job = {},
    normalizedRecutOptions = [],
    setSelectedRecutOption,
    actionTitle,
    queueTitle,
    toastMessage
}) => {
    if (!show) return null;

    const defaultActionTitle = actionTitle || (isUv ? 'REQUESTED REPRINT OPTIONS' : 'REQUESTED RECUT OPTIONS');
    const defaultQueueTitle = queueTitle || (isUv ? 'REPRINT QUEUE DETAILS' : 'RECUT QUEUE DETAILS');

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300 flex flex-col max-h-[80vh]">
                {/* Header */}
                <div className="bg-[#0f172a] p-6 text-white shrink-0">
                    <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/10 rounded-xl">
                                <Play className="w-6 h-6 text-[#00d1b2] fill-current" />
                            </div>
                            <span className="text-xl font-black uppercase tracking-tighter">{defaultActionTitle}</span>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/10 rounded-full transition-all text-slate-400 hover:text-white cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-[#00d1b2] opacity-80">
                        <span>JOB {job.job_no}</span>
                        <span className="opacity-30">·</span>
                        <span>{normalizedRecutOptions.length} OPTIONS TOTAL</span>
                    </div>
                </div>

                {/* Body */}
                <div className="p-8 flex flex-col gap-6 overflow-y-auto">
                    <div className="flex flex-col gap-3">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                            {defaultQueueTitle}
                        </h3>
                        <div className="flex flex-col gap-3">
                            {normalizedRecutOptions.map((opt, idx) => {
                                const completed = (opt.cycles || []).reduce((acc, c) => acc + (c.good_qty || 0) + (c.bad_qty || 0), 0);
                                const remaining = opt.qty - completed;
                                const isNewSheet = opt.type === 'New Sheet';
                                const isReady = !isNewSheet || opt.is_inwarded;

                                return (
                                    <div
                                        key={idx}
                                        className="p-5 rounded-2xl border-2 transition-all flex flex-col gap-2 relative bg-white border-slate-100 hover:border-slate-200"
                                    >
                                        {/* Top row */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2.5">
                                                <span className="text-lg">
                                                    {opt.type === 'same sheet' ? '⚡' : opt.type === 'use excess' ? '♻️' : '📄'}
                                                </span>
                                                <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                                                    {opt.type === 'same sheet' ? (isUv ? 'SAME SHEET REPRINT' : 'SAME SHEET RECUT') : opt.type === 'use excess' ? (isUv ? 'EXCESS MATERIAL REPRINT' : 'EXCESS MATERIAL RECUT') : (isUv ? 'NEW SHEET REPRINT' : 'NEW SHEET RECUT')}
                                                </span>
                                            </div>
                                            <span className="text-xs font-black text-slate-600">
                                                {opt.qty} PCS
                                            </span>
                                        </div>

                                        {/* Meta Info */}
                                        {(isNewSheet || opt.reason) && (
                                            <div className="grid grid-cols-2 gap-y-1.5 text-[10px] font-bold text-slate-500 uppercase italic bg-slate-50 p-3 rounded-xl mt-1">
                                                <span>Reason: {opt.reason || 'N/A'}</span>
                                                {isNewSheet && <span>Sheets Requested: {opt.sheet_qty || 1}</span>}
                                                {isNewSheet && opt.urgent && (
                                                    <span className="text-rose-600 font-black col-span-2">🚨 URGENT</span>
                                                )}
                                            </div>
                                        )}

                                        {/* Status info */}
                                        <div className="flex justify-between items-center mt-2 border-t border-slate-100/50 pt-2">
                                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${!isReady
                                                ? 'bg-amber-100 text-amber-700'
                                                : 'bg-emerald-100 text-emerald-700'
                                                }`}>
                                                {!isReady ? '⏳ PENDING INWARD' : '✓ READY'}
                                            </span>
                                            <div className="flex items-center gap-3">
                                                <span className="text-[10px] font-black text-slate-400 uppercase">
                                                    Remaining: {remaining} PCS
                                                </span>
                                                {isReady && remaining > 0 && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedRecutOption({
                                                                ...opt,
                                                                isRecutmethodstarted: true
                                                            });
                                                            onClose();
                                                            toast.success(toastMessage || (isUv ? "Reprint Cycle started successfully!" : "Recut Cycle started successfully!"));
                                                        }}
                                                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-md shadow-emerald-600/10 flex items-center gap-1 cursor-pointer"
                                                    >
                                                        <Play className="w-2.5 h-2.5 fill-current" />
                                                        <span>Start</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {normalizedRecutOptions.length === 0 && (
                                <div className="text-center p-8 border-2 border-dashed border-slate-200 rounded-2xl">
                                    <span className="text-xs font-black text-slate-400 uppercase italic">No active recut options requested</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-8 pt-4 border-t border-slate-100 flex gap-4 shrink-0 bg-white">
                    <button
                        onClick={onClose}
                        className="flex-1 py-5 rounded-[1.5rem] bg-[#0f172a] hover:bg-slate-800 text-white text-[14px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-slate-900/10 cursor-pointer"
                    >
                        Close Preview
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RequestedRecutPreviewModal;

