import React from "react";
import { inr } from "../../../utils/helpers";

const SubJobRateEditModal = ({
  editingSubJob,
  setEditingSubJob,
  editRate,
  editSampleRate,
  setEditSampleRate,
  editArtworkCharge,
  setEditArtworkCharge,
  isSavingRate,
  handleSaveRate,
  otherSubJobWithArtwork,
}) => {
  if (!editingSubJob) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 fade">
        <div className="p-4 bg-gradient-to-r from-indigo-50 to-indigo-100/50 border-b border-indigo-100 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-700 block">
              Sub-Job Rate Sync
            </span>
            <h3 className="font-extrabold text-sm text-gray-900">
              {editingSubJob.subJobNo} · {editingSubJob.name}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setEditingSubJob(null)}
            className="w-7 h-7 rounded-full bg-white/80 hover:bg-white text-gray-400 hover:text-gray-700 flex items-center justify-center transition cursor-pointer shadow-2xs"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-amber-900 leading-relaxed">
            <span className="font-bold">
              Ordered Quantity: {editingSubJob.qty} pcs.
            </span>
            <p className="text-[11px] text-amber-800 mt-0.5">
              Unit Rate is calculated from BOM costing and cannot be changed here. Sample Rate defaults to Unit Rate + ₹200 and can be adjusted below.
            </p>
          </div>

          <div>
            <label className="block text-gray-700 font-bold mb-1 flex items-center justify-between">
              <span>Unit Rate (₹ / pc for {editingSubJob.qty} pcs)</span>
              <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                Calculated · Non-Editable
              </span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-400 font-bold text-sm">
                ₹
              </span>
              <input
                type="text"
                value={Number(editingSubJob.unitRate || editRate || 0).toFixed(2)}
                readOnly
                disabled
                tabIndex="-1"
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-xl font-bold text-gray-700 bg-gray-100 cursor-not-allowed text-sm select-none"
              />
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              Unit rate is derived from BOM costing and cannot be changed here.
            </p>
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-1 flex items-center justify-between">
              <span>Sample Rate (₹ / pc)</span>
              <span className="text-[10px] text-indigo-600 font-bold">
                Default: Unit Rate + ₹200
              </span>
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-2 text-gray-400 font-bold text-xs">
                ₹
              </span>
              <input
                type="number"
                step="0.01"
                value={editSampleRate}
                onChange={(ev) => setEditSampleRate(ev.target.value)}
                placeholder={
                  editingSubJob.unitRate > 0
                    ? Number(editingSubJob.unitRate + 200).toFixed(2)
                    : "e.g. 1050.00"
                }
                className="w-full pl-7 pr-2 py-1.5 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm font-semibold"
                autoFocus
              />
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              Sample price for single piece physical proof before mass production.
            </p>
          </div>

          <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-indigo-950 text-xs flex items-center justify-between">
            <span className="font-semibold flex items-center gap-1.5">
              <span>🎨</span> 1-Time Setup & Artwork Fee:
            </span>
            <span className="font-bold text-indigo-800 bg-white px-2 py-0.5 rounded border border-indigo-200 text-[11px]">
              Enquiry-Wide (Billed at End of List)
            </span>
          </div>

          {Number(editingSubJob.unitRate || editRate) > 0 && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between font-medium">
              <span className="text-gray-600">
                Sub-Job Line Total ({editingSubJob.qty} pcs):
              </span>
              <span className="font-extrabold text-sm text-indigo-950">
                {inr(
                  (
                    editingSubJob.qty * Number(editingSubJob.unitRate || editRate)
                  ).toFixed(2)
                )}
              </span>
            </div>
          )}
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
          <button
            type="button"
            disabled={isSavingRate}
            onClick={() => setEditingSubJob(null)}
            className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSavingRate || !editRate}
            onClick={handleSaveRate}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
          >
            {isSavingRate ? "Syncing..." : "Save & Sync to Enquiry"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubJobRateEditModal;

