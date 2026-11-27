import React from 'react';
import { Settings2, X, CheckCircle2 } from 'lucide-react';

const SetupRunModal = ({
    show,
    onClose,
    onStartProduction,
    job = {},
    mg = {},
    firstMaterial,
    currentShift,
    getShiftLabel = (s) => s,
    isSheetTarget = false,
    primaryUps = '',
    targetQty = 0,
    inHouseSheets = 0,
    inHouseTargetQty = 0,
    operators = [],
    selectedOperator,
    setSelectedOperator,
    isUv = false,
    hasHeadsSelection = true,
    selectedHeads,
    setSelectedHeads,
    timePerSheet = 32
}) => {
    if (!show) return null;

    const requiresHeads = !isUv && hasHeadsSelection;
    const canStart = selectedOperator && (!requiresHeads || selectedHeads);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
                {/* Header */}
                <div className="bg-[#0f172a] p-6 text-white">
                    <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/10 rounded-xl">
                                <Settings2 className="w-6 h-6 text-[#00d1b2]" />
                            </div>
                            <span className="text-2xl font-black uppercase tracking-tighter">SETUP RUN</span>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all cursor-pointer">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-[#00d1b2] opacity-80">
                        <span>{getShiftLabel(currentShift)}</span>
                        <span className="opacity-30">·</span>
                        <span>{isSheetTarget ? '1 SHEET' : `${primaryUps} UPS`}/CYCLE</span>
                        <span className="opacity-30">·</span>
                        <span>JOB {job.job_no}</span>
                    </div>
                </div>

                <div className="p-8 flex flex-col gap-8 max-h-[80vh] overflow-y-auto">
                    {/* Summary Card */}
                    <div className="bg-slate-50 rounded-[1.5rem] p-5 border border-slate-100 grid grid-cols-3 gap-y-4 gap-x-8">
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">JOB NO</span>
                            <span className="text-xs font-black text-slate-900">{job.job_no}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">MATERIAL</span>
                            <span className="text-xs font-black text-slate-900">{mg?.group_name || 'N/A'}</span>
                        </div>
                        {isSheetTarget && (
                            <>
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">SHEET</span>
                                    <span className="text-xs font-black text-slate-900">{firstMaterial?.material_input?.one_up_width || 0}"x{firstMaterial?.material_input?.one_up_length || 0}"</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">UPS/SHEET</span>
                                    <span className="text-xs font-black text-slate-900">{firstMaterial?.material_input?.ups || mg?.ups || 0} pcs</span>
                                </div>
                            </>
                        )}
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">TOTAL OUTPUT</span>
                            <span className="text-xs font-black text-slate-900">{isSheetTarget ? `${targetQty} sheets` : `${targetQty} pcs`}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{isSheetTarget ? 'SHEETS REQD' : 'PCS REQD'}</span>
                            <span className="text-xs font-black text-slate-900">{isSheetTarget ? inHouseSheets : inHouseTargetQty}</span>
                        </div>
                    </div>

                    {/* Step 1: Operator */}
                    <div className="flex flex-col gap-3">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                            STEP 1 — WHO IS OPERATING?
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                            {operators.map(op => (
                                <button
                                    key={op}
                                    onClick={() => setSelectedOperator(op)}
                                    className={`py-4 px-6 rounded-2xl text-sm font-black transition-all border-2 text-left flex items-center justify-between cursor-pointer ${selectedOperator === op ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-md' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'}`}
                                >
                                    {op}
                                    {selectedOperator === op && <CheckCircle2 className="w-4 h-4" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Step 2: Number of Heads */}
                    {requiresHeads && (
                        <div className="flex flex-col gap-3">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                STEP 2 — NUMBER OF HEADS
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    { id: 1, label: '1 Head', sub: 'Standard', time: Math.floor(timePerSheet * inHouseSheets), icon: 1 },
                                    { id: 2, label: '2 Heads', sub: '50% faster', time: Math.floor((timePerSheet / 2) * inHouseSheets), icon: 2 }
                                ].map(h => (
                                    <button
                                        key={h.id}
                                        onClick={() => setSelectedHeads(h.id)}
                                        className={`p-6 rounded-[2rem] flex flex-col items-center gap-3 transition-all border-2 cursor-pointer ${selectedHeads === h.id ? 'bg-emerald-50 border-emerald-500 shadow-lg' : 'bg-white border-slate-100 hover:border-slate-200'}`}
                                    >
                                        <div className="flex gap-1">
                                            {Array.from({ length: h.id }).map((_, i) => (
                                                <div key={i} className="w-8 h-8">🔴</div>
                                            ))}
                                        </div>
                                        <div className="text-center">
                                            <div className={`text-lg font-black ${selectedHeads === h.id ? 'text-emerald-700' : 'text-slate-900'}`}>{h.label}</div>
                                            <div className="text-[10px] font-black text-slate-400 uppercase">{h.sub}</div>
                                        </div>
                                        <div className="w-full bg-[#0f172a] rounded-xl p-3 flex flex-col items-center">
                                            <span className="text-[8px] font-black text-[#00d1b2] uppercase tracking-widest mb-1">PLAN TIME</span>
                                            <span className="text-xl font-black text-white">{Math.floor(h.time / 60)}h {Math.floor(h.time % 60)}m</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-8 pt-4 border-t border-slate-100 flex gap-4">
                    <button
                        onClick={onClose}
                        className="flex-1 py-5 rounded-[1.5rem] border-2 border-slate-100 text-[14px] font-black text-slate-400 uppercase tracking-widest hover:bg-slate-50 transition-all cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        disabled={!canStart}
                        onClick={onStartProduction}
                        className={`flex-1 py-5 rounded-[1.5rem] text-[14px] font-black uppercase tracking-widest transition-all shadow-xl cursor-pointer ${!canStart ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' : 'bg-[#0f172a] text-white hover:bg-slate-800 shadow-slate-900/20'}`}
                    >
                        {!selectedOperator ? (requiresHeads ? 'SELECT BOTH FIRST' : 'SELECT OPERATOR FIRST') : (requiresHeads && !selectedHeads ? 'SELECT HEADS FIRST' : 'START PRODUCTION')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SetupRunModal;

