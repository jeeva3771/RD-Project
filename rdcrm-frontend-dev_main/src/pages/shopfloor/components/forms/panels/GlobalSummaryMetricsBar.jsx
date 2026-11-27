import React from 'react';

const GlobalSummaryMetricsBar = ({
    targetQty = 0,
    outsourcedSheets = 0,
    isSheetTarget = false,
    upsVal = 1,
    totalGoodHandedOver = 0,
    badLabel = 'RECUTS',
    cumulativeBad = 0,
    badQty = 0,
    goodQty = 0,
    totalLabel = 'TOTAL CUTTED PIECES'
}) => {
    const totalBad = cumulativeBad + badQty;
    const totalProcessed = totalGoodHandedOver + cumulativeBad + goodQty + badQty;
    const pendingQty = Math.max(0, targetQty - totalGoodHandedOver - cumulativeBad - goodQty - badQty);

    return (
        <div className="shrink-0 pt-2 border-t border-slate-100 bg-white/50 backdrop-blur-sm -mx-1 px-1">
            <div className="bg-[#0f172a] rounded-[1.5rem] px-2 sm:px-4 py-3 flex items-center justify-between border border-slate-800 shadow-xl text-white">
                <div className="flex-1 flex flex-col items-center border-r border-slate-800 last:border-0">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 italic">TARGET</span>
                    <span className="text-base sm:text-xl font-black text-white tracking-tighter leading-none">
                        {targetQty}
                    </span>
                    {outsourcedSheets > 0 && (
                        <span className="text-[7px] font-bold text-slate-500 italic leading-none mt-0.5">
                            -{isSheetTarget ? outsourcedSheets : outsourcedSheets * upsVal} outsourced
                        </span>
                    )}
                </div>
                <div className="flex-1 flex flex-col items-center border-r border-slate-800 last:border-0">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 italic">GOOD ISSUED</span>
                    <span className="text-base sm:text-xl font-black text-emerald-400 tracking-tighter leading-none">
                        {totalGoodHandedOver}
                    </span>
                </div>
                <div className="flex-1 flex flex-col items-center border-r border-slate-800 last:border-0">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 italic">{badLabel}</span>
                    <span className="text-base sm:text-xl font-black text-amber-500 tracking-tighter leading-none">
                        {totalBad}
                    </span>
                </div>
                <div className="flex-1 flex flex-col items-center border-r border-slate-800 last:border-0">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 italic">{totalLabel}</span>
                    <span className="text-base sm:text-xl font-black text-indigo-400 tracking-tighter leading-none">
                        {totalProcessed}
                    </span>
                </div>
                <div className="flex-1 flex flex-col items-center border-r border-slate-800 last:border-0">
                    <span className="text-[8px] font-black text-rose-400/50 uppercase tracking-widest mb-1 italic">PENDING</span>
                    <span className="text-base sm:text-xl font-black text-rose-500 tracking-tighter leading-none">
                        {pendingQty}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default React.memo(GlobalSummaryMetricsBar);

