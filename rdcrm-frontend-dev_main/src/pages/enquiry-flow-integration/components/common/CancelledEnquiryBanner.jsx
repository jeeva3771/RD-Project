import React from "react";
import { dfmt } from "../../utils/helpers";

const CancelledEnquiryBanner = ({ s = {}, onBackToBoard }) => {
  const reason = s.lostReason || s.lost || s.rawJob?.lost_reason || "Client declined quotation / abandoned";
  const lostAt = s.lostAt || s.rawJob?.lost_at || s.rawJob?.updatedAt;
  const lostBy = s.lostBy || s.rawJob?.lost_by?.name || "Client Servicing / Admin";

  return (
    <div className="mb-6 p-4 md:p-5 rounded-2xl bg-gradient-to-r from-rose-50 via-red-50 to-rose-50 border-2 border-rose-300 shadow-sm fade">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center text-lg font-black shrink-0 shadow-xs">
            ✕
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-extrabold text-base text-rose-950 tracking-tight">
                Enquiry Abandoned / Cancelled (Lost Job)
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-200 text-rose-900 border border-rose-300">
                🔒 Permanently Locked
              </span>
            </div>
            <p className="text-xs text-rose-900/90 font-medium mt-1 leading-relaxed">
              <b>Reason:</b> {reason}
              {lostAt && (
                <span className="text-rose-700 ml-2">
                  · Marked on <b>{dfmt(lostAt)}</b> by <b>{lostBy}</b>
                </span>
              )}
            </p>
            <p className="text-[11px] text-rose-700 mt-1 font-normal">
              All modifications are blocked: Design uploads, rework requests, costing updates, and order progressions cannot be performed on a cancelled enquiry.
            </p>
          </div>
        </div>

        {onBackToBoard && (
          <button
            type="button"
            onClick={onBackToBoard}
            className="px-4 py-2 bg-white hover:bg-rose-100 text-rose-900 border border-rose-300 font-extrabold text-xs rounded-xl shadow-2xs transition cursor-pointer shrink-0 self-start sm:self-center"
          >
            ← View Cancelled Orders
          </button>
        )}
      </div>
    </div>
  );
};

export default CancelledEnquiryBanner;

