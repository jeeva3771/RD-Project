import React from 'react';
import { X, Play } from 'lucide-react';
import { toast } from 'react-toastify';

const StartRecutSelectModal = ({
    show,
    onClose,
    title = 'Select Recut Option to Start',
    subtitle = 'Select from the ready/received material queue',
    actionLabel = 'RECUT',
    readyRecutOptions = [],
    quantities = {},
    groupId,
    setQuantities,
    setSelectedRecutOption,
    setSampleUps,
    setRecutUpsVal,
    triggerImmediateSync
}) => {
    if (!show) return null;

    const optionKey = quantities[groupId]?.selected_reassemble_option ? 'selected_reassemble_option' : 'selected_recut_option';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[2rem] w-full max-w-lg overflow-hidden shadow-2xl border border-purple-100 animate-in zoom-in-95 duration-300">
                <div className="bg-purple-600 px-8 py-6 text-white relative">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all text-white"
                    >
                        <X className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-3">
                        <span className="text-xl">⚡</span>
                        <div>
                            <h3 className="text-[14px] font-black uppercase tracking-wider">{title}</h3>
                            <p className="text-[10px] opacity-80 uppercase italic tracking-wider mt-0.5">{subtitle}</p>
                        </div>
                    </div>
                </div>

                <div className="p-6 max-h-[30rem] overflow-y-auto space-y-4">
                    {readyRecutOptions.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 text-xs font-bold uppercase italic">
                            No ready/received {actionLabel.toLowerCase()} options available.
                        </div>
                    ) : (
                        readyRecutOptions.map((opt, idx) => {
                            // Find the real index of this option in the full selected options array
                            const allOptions = quantities[groupId]?.[optionKey] || [];
                            let readyIdx = 0;
                            let realIndex = -1;
                            for (let i = 0; i < allOptions.length; i++) {
                                const o = allOptions[i];
                                if ((o.type === 'New Sheet' || o.type === 'new sheet') && !o.is_inwarded) continue;
                                const c = (o.cycles || []).reduce((acc, cy) => acc + (cy.good_qty || 0) + (cy.bad_qty || 0), 0);
                                if (c < o.qty) {
                                    if (readyIdx === idx) { realIndex = i; break; }
                                    readyIdx++;
                                }
                            }

                            const completed = (opt.cycles || []).reduce((acc, cy) => acc + (cy.good_qty || 0) + (cy.bad_qty || 0), 0);
                            const remaining = opt.qty - completed;
                            return (
                                <div
                                    key={idx}
                                    className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between hover:border-purple-300 hover:bg-purple-50/20 transition-all"
                                >
                                    <div className="flex flex-col text-left">
                                        <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                                            {opt.type.toUpperCase()}
                                        </span>
                                        <span className="text-[10px] text-slate-500 font-semibold mt-1">
                                            Total Qty: {opt.qty} pcs · Remaining: {remaining} pcs
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            const updatedOpt = {
                                                ...opt,
                                                isRecutmethodstarted: true,
                                                isReassemblemethodstarted: true,
                                                _listIndex: realIndex
                                            };
                                            setSelectedRecutOption(updatedOpt);
                                            // Prefill the sidebar's ups input with remaining qty
                                            setSampleUps(prev => ({ ...prev, [groupId]: remaining.toString() }));
                                            setRecutUpsVal(remaining);

                                            const currentGroup = quantities[groupId] || {};
                                            const currentOptions = Array.isArray(currentGroup[optionKey])
                                                ? [...currentGroup[optionKey]]
                                                : [];
                                            if (realIndex !== -1) {
                                                currentOptions[realIndex] = updatedOpt;
                                            }
                                            const nextQuantitiesObj = {
                                                ...currentGroup,
                                                [optionKey]: currentOptions,
                                                quantities_updated_at: new Date().toISOString()
                                            };
                                            setQuantities(prev => ({
                                                ...prev,
                                                [groupId]: nextQuantitiesObj
                                            }));

                                            if (triggerImmediateSync) {
                                                triggerImmediateSync(groupId, {
                                                    quantities: nextQuantitiesObj
                                                });
                                            }

                                            onClose();
                                            toast.success(`Selected ${opt.type.toUpperCase()} ${actionLabel.toLowerCase()}. Enter UPS in left panel.`);
                                        }}
                                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-md shadow-purple-500/10 flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <Play className="w-3 h-3 fill-current" />
                                        <span>SELECT & START</span>
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

export default StartRecutSelectModal;

