import React from 'react';
import { FileText, Search, CheckCircle2, AlertTriangle, Terminal, Clock } from 'lucide-react';

const ActivityLogPanel = ({ uniqueLogs = [], getShiftLabel = (s) => s }) => {
    return (
        <aside className="w-full xl:w-64 flex flex-col gap-4 shrink-0 overflow-hidden">
            <div className="bg-[#0f172a] rounded-[1.5rem] p-4 text-white flex-1 flex flex-col shadow-xl overflow-y-auto custom-sidebar-scroll">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <FileText className="w-4 h-4 text-slate-400" />
                        </div>
                        <span className="text-[10px] font-bold tracking-[0.2em] text-emerald-400">ACTIVITY LOG</span>
                    </div>
                    <div className="flex gap-2">
                        <div className="p-1.5 bg-[#00d1b2]/20 rounded-lg border border-[#00d1b2]/30 hover:bg-[#00d1b2]/30 transition-colors cursor-pointer group">
                            <Search className="w-3 h-3 text-[#00d1b2]" />
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 custom-sidebar-scroll px-2">
                    {uniqueLogs.map((log, idx) => {
                        const isProductionStart = log.action?.includes('PRIMARY CYCLE NOW OPEN');
                        const isApproved = !isProductionStart && log.action?.includes('APPROVED');
                        const isSampling = log.activity_type?.toLowerCase() === 'sampling';
                        const isPaused = log.action?.includes('PAUSED');
                        const isResumed = log.action?.includes('RESUMED');
                        const isHandedOver = log.action?.includes('HANDED OVER');

                        let logDetails = log.details || {};
                        if (typeof logDetails.remarks === 'string' && logDetails.remarks.includes('"is_shift_handover":true')) {
                            try {
                                logDetails = { ...logDetails, ...JSON.parse(logDetails.remarks) };
                            } catch (e) { /* ignore */ }
                        }

                        return (
                            <div key={idx} className="flex gap-3 animate-in fade-in slide-in-from-right-4 duration-500">
                                <span className="text-[9px] font-black text-slate-600 font-mono shrink-0 pt-0.5">
                                    {(() => {
                                        const date = new Date(log.timestamp);
                                        return isNaN(date.getTime()) ? log.timestamp : date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                                    })()}
                                </span>
                                <div className="flex flex-col gap-2 w-full">
                                    <div className="flex items-start gap-1.5">
                                        {isProductionStart ? (
                                            <span className="text-[10px] mt-0.5 shrink-0 leading-none">🚀</span>
                                        ) : isApproved ? (
                                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 mt-0.5 shrink-0" />
                                        ) : isPaused ? (
                                            <span className="text-[10px] mt-0.5 shrink-0 leading-none text-amber-500">⏸</span>
                                        ) : isResumed ? (
                                            <span className="text-[10px] mt-0.5 shrink-0 leading-none text-emerald-400">▶</span>
                                        ) : isHandedOver ? (
                                            <span className="text-[10px] mt-0.5 shrink-0 leading-none">📦</span>
                                        ) : isSampling ? (
                                            <AlertTriangle className="w-2.5 h-2.5 text-amber-400/80 mt-0.5 shrink-0" />
                                        ) : logDetails?.is_shift_handover ? (
                                            <div className="w-2 h-2 rounded-full bg-orange-500 mt-1 shrink-0 shadow-lg shadow-orange-500/50"></div>
                                        ) : (
                                            <Terminal className="w-2.5 h-2.5 text-slate-500 mt-0.5 shrink-0" />
                                        )}
                                        <span className={`text-[9px] font-black uppercase tracking-widest italic ${isPaused ? 'text-amber-500' :
                                            isResumed ? 'text-emerald-400' :
                                                isHandedOver ? 'text-indigo-400' :
                                                    isProductionStart ? 'text-emerald-400 font-bold' :
                                                        logDetails?.is_shift_handover ? 'text-[#00d1b2] font-bold' :
                                                            'text-slate-400'
                                            }`}>
                                            {log.action?.replace('✓ ', '')?.replace('🚀 ', '') || log.activity_type}
                                        </span>
                                    </div>

                                    {logDetails?.is_shift_handover && (
                                        <div className="bg-[#00d1b2]/10 border border-[#00d1b2]/30 rounded-xl p-3 flex flex-col gap-2 w-full mt-1">
                                            <span className="text-[9px] font-black text-[#00d1b2] tracking-widest uppercase italic opacity-90">
                                                Switched to {getShiftLabel(logDetails.next_shift)} for balance processing
                                            </span>

                                            <div className="grid grid-cols-2 gap-y-2.5 gap-x-2 mt-1 pt-2 border-t border-[#00d1b2]/20">
                                                <div className="flex flex-col">
                                                    <span className="text-[7px] font-black text-[#00d1b2]/60 uppercase tracking-widest">{getShiftLabel(logDetails.current_shift)} UPS</span>
                                                    <span className="text-[9px] font-black text-[#00d1b2]">{logDetails.shift_ups} ups × {logDetails.shift_cycles} cyc</span>
                                                </div>
                                                <div className="flex flex-col overflow-hidden">
                                                    <span className="text-[7px] font-black text-[#00d1b2]/60 uppercase tracking-widest">OPERATOR</span>
                                                    <span className="text-[9px] font-black text-[#00d1b2] truncate" title={log.operator || 'N/A'}>{log.operator || 'N/A'}</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[7px] font-black text-[#00d1b2]/60 uppercase tracking-widest">COMPLETED</span>
                                                    <span className="text-[9px] font-black text-[#00d1b2]">{logDetails.issued_pcs || 0} pcs</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[7px] font-black text-[#00d1b2]/60 uppercase tracking-widest">REJECTED</span>
                                                    <span className="text-[9px] font-black text-[#00d1b2]">{logDetails.rejected_pcs || 0} pcs</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {uniqueLogs.length === 0 && (
                        <div className="flex gap-3 animate-in fade-in slide-in-from-right-4 duration-500">
                            <span className="text-[9px] font-black text-slate-600 font-mono">--:--</span>
                            <div className="flex items-center gap-1.5">
                                <Clock className="w-2.5 h-2.5 text-slate-500" />
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">WAITING FOR INWARD</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
};

export default React.memo(ActivityLogPanel);

