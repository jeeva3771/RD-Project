import React from 'react';
import { X } from 'lucide-react';

const RecutOptionModal = ({
    show,
    onClose,
    actionLabel = 'RECUT',
    isSheetTarget = false,
    isSheetInput = false,
    recutOptionQty = 0,
    setRecutOptionQty,
    handleConfirmSameSheet,
    recutOptionExcessQty = 0,
    setRecutOptionExcessQty,
    handleConfirmExcessMaterial,
    recutOptionNewSheetRecutQty = 0,
    setRecutOptionNewSheetRecutQty,
    recutOptionSheetSize = '',
    setRecutOptionSheetSize,
    recutOptionSheetQty = 1,
    setRecutOptionSheetQty,
    recutOptionUrgent = false,
    setRecutOptionUrgent,
    recutOptionReason = 'Cut failed / sheet damaged',
    setRecutOptionReason,
    handleConfirmNewSheet,
    isActionLoading = false
}) => {
    if (!show) return null;

    return (
        <div className="bg-white rounded-[1.25rem] border border-purple-200 shadow-sm overflow-hidden mb-4 animate-in slide-in-from-top-4 duration-300 relative">
            <button
                onClick={onClose}
                className="absolute top-3 right-3 p-1.5 bg-slate-200/50 hover:bg-slate-200 rounded-full transition-all text-slate-600 hover:text-slate-900 z-10 cursor-pointer"
            >
                <X className="w-3.5 h-3.5" />
            </button>

            {/* Three Horizontal Columns */}
            <div className="p-5 pt-8 grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50">
                {/* Column 1: SAME SHEET / SAME PCS */}
                <div className="bg-white rounded-[1.25rem] p-4 border border-purple-100 hover:border-purple-300 transition-all flex flex-col justify-between shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 px-2 py-1 bg-purple-50 rounded-bl-xl text-purple-600 font-bold text-[8px] uppercase tracking-wider">
                        Option 1
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5 mb-2">
                            <span className="text-base">⚡</span>
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">{isSheetTarget ? 'SAME SHEET' : 'SAME PCS'}</h4>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium mb-3 leading-tight">
                            {isSheetTarget
                                ? 'Material substrate still usable (sheet not damaged, only the cut failed). Run completion cycle immediately. No EMR needed.'
                                : 'Material substrate still usable (piece not damaged, only the print/cut failed). Run completion cycle immediately. No EMR needed.'}
                        </p>

                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 mb-3">
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">QTY TO {actionLabel}</label>
                            <input
                                type="number"
                                value={recutOptionQty}
                                onChange={(e) => setRecutOptionQty(Math.max(1, parseInt(e.target.value) || 0))}
                                className="w-full bg-white border border-slate-200 focus:border-purple-500 rounded-lg px-3 py-1.5 text-base font-bold text-slate-700 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <button
                        onClick={() => handleConfirmSameSheet(recutOptionQty)}
                        className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-black uppercase text-[9px] tracking-widest rounded-lg transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                        <span>✓ CONFIRM & {actionLabel} DIRECT</span>
                    </button>
                </div>

                {/* Column 2: EXCESS MATERIAL */}
                <div className="bg-white rounded-[1.25rem] p-4 border border-emerald-100 hover:border-emerald-300 transition-all flex flex-col justify-between shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 px-2 py-1 bg-emerald-50 rounded-bl-xl text-emerald-600 font-bold text-[8px] uppercase tracking-wider">
                        Option 2
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5 mb-2">
                            <span className="text-base">♻️</span>
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">USE EXCESS</h4>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium mb-3 leading-tight">
                            {isSheetTarget
                                ? `Use spare sheet material available on the shopfloor. Start ${actionLabel.toLowerCase()} cycle immediately. No EMR needed.`
                                : `Use spare piece material available on the shopfloor. Start ${actionLabel.toLowerCase()} cycle immediately. No EMR needed.`}
                        </p>

                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 mb-3">
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">QTY FROM EXCESS</label>
                            <input
                                type="number"
                                value={recutOptionExcessQty}
                                onChange={(e) => setRecutOptionExcessQty(Math.max(1, parseInt(e.target.value) || 0))}
                                className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-lg px-3 py-1.5 text-base font-bold text-slate-700 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <button
                        onClick={() => handleConfirmExcessMaterial(recutOptionExcessQty)}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[9px] tracking-widest rounded-lg transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                        <span>✓ START EXCESS {actionLabel}</span>
                    </button>
                </div>

                {/* Column 3: NEW SHEET / NEW PCS (EMR) */}
                <div className="bg-white rounded-[1.25rem] p-4 border border-rose-100 hover:border-rose-300 transition-all flex flex-col justify-between shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 px-2 py-1 bg-rose-50 rounded-bl-xl text-rose-600 font-bold text-[8px] uppercase tracking-wider">
                        Option 3
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5 mb-2">
                            <span className="text-base">📦</span>
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">{isSheetInput ? 'NEW SHEET (EMR)' : 'NEW PCS (EMR)'}</h4>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium mb-2.5 leading-tight">
                            {isSheetInput
                                ? 'Sheet is damaged, warped, or unusable. Raise EMR request to Stores for a fresh sheet. Wait for arrival to complete.'
                                : 'Piece is damaged, warped, or unusable. Raise EMR request to Stores for fresh pieces. Wait for arrival to complete.'}
                        </p>

                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-col gap-2 mb-3">
                            <div className={isSheetInput ? 'flex gap-2' : ''}>
                                <div className={isSheetInput ? 'w-1/2' : 'w-full'}>
                                    <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest block mb-1">QTY FROM EXCESS</label>
                                    <input
                                        type="number"
                                        value={recutOptionNewSheetRecutQty}
                                        onChange={(e) => {
                                            const val = Math.max(1, parseInt(e.target.value) || 0);
                                            setRecutOptionNewSheetRecutQty(val);
                                            if (!isSheetInput) {
                                                setRecutOptionSheetQty(val);
                                            }
                                        }}
                                        className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 outline-none transition-all"
                                    />
                                </div>
                                {isSheetInput && (
                                    <div className="w-1/2">
                                        <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">SHEET SIZE REQD</label>
                                        <input
                                            type="text"
                                            value={recutOptionSheetSize}
                                            onChange={(e) => setRecutOptionSheetSize(e.target.value)}
                                            className="w-full bg-white border border-slate-200 focus:border-rose-500 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 outline-none transition-all"
                                            placeholder="e.g. 24x36"
                                        />
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                                <div>
                                    <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">{isSheetInput ? 'QTY OF SHEETS' : 'QTY OF PCS'}</label>
                                    <input
                                        type="number"
                                        value={recutOptionSheetQty}
                                        onChange={(e) => {
                                            const val = Math.max(1, parseInt(e.target.value) || 0);
                                            setRecutOptionSheetQty(val);
                                            if (!isSheetInput) {
                                                setRecutOptionNewSheetRecutQty(val);
                                            }
                                        }}
                                        className="w-full bg-white border border-slate-200 focus:border-rose-500 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">URGENCY</label>
                                    <button
                                        type="button"
                                        onClick={() => setRecutOptionUrgent(!recutOptionUrgent)}
                                        className={`w-full py-1 px-2.5 rounded-lg border text-[8px] font-black uppercase tracking-widest transition-all cursor-pointer ${recutOptionUrgent ? 'bg-rose-500 border-rose-500 text-white' : 'bg-white border-slate-200 text-slate-400'}`}
                                    >
                                        {recutOptionUrgent ? '🚨 URGENT' : 'NORMAL'}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">REASON FOR EMR</label>
                                <input
                                    type="text"
                                    value={recutOptionReason}
                                    onChange={(e) => setRecutOptionReason(e.target.value)}
                                    className="w-full bg-white border border-slate-200 focus:border-rose-500 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 outline-none transition-all"
                                    placeholder="e.g. Warped / burned"
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleConfirmNewSheet}
                        disabled={isActionLoading}
                        className={`w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black uppercase text-[9px] tracking-widest rounded-lg transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer ${isActionLoading ? 'opacity-55 cursor-not-allowed' : ''}`}
                    >
                        <span>{isActionLoading ? 'SUBMITTING...' : '🚨 SUBMIT EMR REQUEST'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RecutOptionModal;

