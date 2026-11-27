import React from "react";
import { inr } from "../../utils/collectionsFormatters";
import CollectionIcon from "../common/CollectionIcon";

export default function CollectionsKpiStrip({
  totalOutstanding,
  receiptsTotal,
  casesCount,
  followUpsToday,
  todayOnly,
  setTodayOnly,
  promisedCount,
  brokenPromiseCount,
  escalatedCount,
  overdue30Count,
  mode,
  currentOfficer,
  onSwitchFullTeam,
}) {
  return (
    <div>
      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 px-4 sm:px-6 pt-4">
        <div
          className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs"
          style={{ borderTop: "3px solid #B45309" }}
        >
          <div className="text-base sm:text-lg font-black text-slate-800 font-mono">
            {inr(totalOutstanding)}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
            Outstanding Today
          </div>
        </div>

        <div
          className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs"
          style={{ borderTop: "3px solid #059669" }}
        >
          <div className="text-base sm:text-lg font-black text-slate-800 font-mono">
            {inr(receiptsTotal)}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
            Receipts Till Date
          </div>
        </div>

        <div
          className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs"
          style={{ borderTop: "3px solid #4338CA" }}
        >
          <div className="text-xl sm:text-2xl font-black text-slate-800">
            {casesCount}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
            Total Cases
          </div>
        </div>

        <div
          onClick={() => setTodayOnly(!todayOnly)}
          className={`bg-white rounded-xl border p-3 shadow-2xs cursor-pointer transition hover:shadow-xs ${
            todayOnly ? "border-amber-500 ring-2 ring-amber-100" : "border-slate-200"
          }`}
          style={{ borderTop: "3px solid #F59F00" }}
        >
          <div className="text-xl sm:text-2xl font-black text-slate-800">
            {followUpsToday}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
            Follow-ups Due Today {todayOnly && "• Active"}
          </div>
        </div>

        <div
          className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs"
          style={{ borderTop: "3px solid #0D9488" }}
        >
          <div className="flex items-baseline justify-between">
            <div className="text-xl sm:text-2xl font-black text-slate-800">
              {promisedCount}
            </div>
            {brokenPromiseCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 flex items-center gap-0.5">
                <CollectionIcon name="alert" size={10} /> {brokenPromiseCount} Overdue
              </span>
            )}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
            Promised to Pay
          </div>
        </div>

        <div
          className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs"
          style={{ borderTop: "3px solid #DC2626" }}
        >
          <div className="text-xl sm:text-2xl font-black text-slate-800">
            {escalatedCount}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
            Escalated / At Risk
          </div>
        </div>

        <div
          className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs"
          style={{ borderTop: "3px solid #E11D48" }}
        >
          <div className="text-xl sm:text-2xl font-black text-slate-800">
            {overdue30Count}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
            Overdue 30+ Days
          </div>
        </div>
      </div>

      {/* My View Notice */}
      {mode === "my" && (
        <div className="mx-4 sm:mx-6 mt-3 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-2 text-xs text-amber-800 flex items-center justify-between">
          <div>
            Viewing only <span className="font-bold">{currentOfficer}</span>'s portfolio.
          </div>
          <button
            onClick={onSwitchFullTeam}
            className="text-[11px] font-bold underline hover:text-amber-900"
          >
            Switch to Full Team
          </button>
        </div>
      )}
    </div>
  );
}

