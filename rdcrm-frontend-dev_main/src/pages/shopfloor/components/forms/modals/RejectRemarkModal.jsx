import React from 'react';
import { AlertCircle, X } from 'lucide-react';

const RejectRemarkModal = ({
    show,
    rejectRemark,
    setRejectRemark,
    onClose,
    onConfirm
}) => {
    if (!show) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl border border-rose-100 animate-in zoom-in-95 duration-300">
                <div className="bg-rose-500 px-8 py-6 text-white relative">
                    <div className="flex items-center gap-3 mb-1">
                        <AlertCircle className="w-5 h-5" />
                        <h3 className="text-lg font-black uppercase tracking-widest">Reject Sample</h3>
                    </div>
                    <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest italic">Provide a reason for rejection</p>
                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="p-8">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-2 italic">REJECTION REMARK</label>
                    <textarea
                        value={rejectRemark}
                        onChange={(e) => setRejectRemark(e.target.value)}
                        placeholder="e.g. Dimensions not matching, Burrs observed, etc."
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold text-slate-700 outline-none focus:border-rose-500/30 transition-all min-h-[120px] resize-none placeholder:text-slate-300"
                        autoFocus
                    />

                    <div className="grid grid-cols-2 gap-4 mt-8">
                        <button
                            onClick={onClose}
                            className="py-4 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all"
                        >
                            CANCEL
                        </button>
                        <button
                            onClick={onConfirm}
                            className="py-4 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-rose-200 transition-all active:scale-95"
                        >
                            CONFIRM REJECT
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RejectRemarkModal;

