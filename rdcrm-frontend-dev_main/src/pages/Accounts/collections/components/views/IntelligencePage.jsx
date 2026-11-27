import React from "react";
import { inr } from "../../utils/collectionsFormatters";
import { computeRepeatOffenderIntel } from "../../utils/collectionsAllocation";
import CollectionIcon from "../common/CollectionIcon";
import ARBridgeCard from "./ARBridgeCard";

export default function IntelligencePage({
  cases,
  receipts,
  unallocatedReceipts,
  onPickCase,
  loading = false,
  onRefresh,
}) {
  const outstandingToday = cases.reduce((s, c) => s + c.total, 0);
  const repeatOffenders = cases
    .map((c) => ({ c, intel: computeRepeatOffenderIntel(c.escalationCount, c.invoices) }))
    .filter((x) => x.intel.tier !== "Normal")
    .sort((a, b) => b.intel.score - a.intel.score);

  const pendingUnallocated = unallocatedReceipts
    .map((u) => ({
      ...u,
      remaining: u.amount - u.allocations.reduce((s, a) => s + a.amount, 0),
    }))
    .filter((u) => u.remaining > 0.01);
  const unallocatedTotal = pendingUnallocated.reduce((s, u) => s + u.remaining, 0);

  return (
    <div className="w-full px-4 sm:px-6 py-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-800">
            Intelligence & Insights
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Actionable debtor intelligence — chronic delinquency, cash velocity, and unallocated payments.
          </p>
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition disabled:opacity-50"
            title="Refresh live intelligence data from server"
          >
            <CollectionIcon name="refresh" size={13} className={loading ? "animate-spin text-indigo-600" : "text-slate-600"} />
            <span>{loading ? "Fetching..." : "Refresh"}</span>
          </button>
        )}
      </div>

      {/* KPI 4-Card Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs"
          style={{ borderTop: "3px solid #6366F1" }}
        >
          <div className="text-2xl font-black text-slate-800">
            {cases.length}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">
            Active Client Accounts
          </div>
        </div>
        <div
          className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs"
          style={{ borderTop: "3px solid #DC2626" }}
        >
          <div className="text-2xl font-black text-slate-800">
            {repeatOffenders.filter((x) => x.intel.tier === "Repeat Offender").length}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">
            Repeat Offenders
          </div>
        </div>
        <div
          className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs"
          style={{ borderTop: "3px solid #4F46E5" }}
        >
          <div className="text-lg font-black text-slate-800 font-mono">
            {inr(unallocatedTotal)}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">
            Unmatched Payments
          </div>
        </div>
        <div
          className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs"
          style={{ borderTop: "3px solid #B45309" }}
        >
          <div className="text-lg font-black text-slate-800 font-mono">
            {inr(outstandingToday)}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">
            Net Outstanding Today
          </div>
        </div>
      </div>

      {/* AR Bridge Card */}
      <ARBridgeCard receipts={receipts} outstandingToday={outstandingToday} />

      {/* Repeat Offenders Watchlist */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 flex items-center gap-3 bg-rose-50/70 border-b border-rose-100">
          <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center">
            <CollectionIcon name="alert" size={16} />
          </div>
          <div>
            <div className="font-bold text-slate-800 text-sm">
              Repeat Offenders Watchlist
            </div>
            <div className="text-[11px] text-slate-400">
              Scored on escalation frequency, overdue count, and chronic delinquency
            </div>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {repeatOffenders.map(({ c, intel }) => (
            <button
              key={c.id}
              onClick={() => onPickCase(c.id)}
              className="w-full text-left px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition flex-wrap"
            >
              <div>
                <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <span>{c.client}</span>
                  <span
                    className={
                      "text-[10px] font-bold px-2 py-0.5 rounded-full border " +
                      (intel.tier === "Repeat Offender"
                        ? "bg-rose-100 text-rose-700 border-rose-200"
                        : "bg-amber-100 text-amber-700 border-amber-200")
                    }
                  >
                    {intel.tier}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Escalated {intel.escalationCount}× • {intel.overdueCount} overdue now • Avg{" "}
                  {intel.avgDaysOverdue}d late • Score: {intel.score}
                </div>
              </div>
              <div className="text-sm font-black text-slate-800 font-mono">{inr(c.total)}</div>
            </button>
          ))}
          {repeatOffenders.length === 0 && (
            <div className="text-center text-xs text-slate-400 py-8 italic">
              No repeat-offender patterns detected right now.
            </div>
          )}
        </div>
      </div>

      {/* Unmatched Payments Awaiting Reconciliation */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 flex items-center gap-3 bg-indigo-50/70 border-b border-indigo-100">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
            <CollectionIcon name="link" size={16} />
          </div>
          <div>
            <div className="font-bold text-slate-800 text-sm">
              Unmatched Payments Awaiting Reconciliation
            </div>
            <div className="text-[11px] text-slate-400">
              Receipts received with no invoice reference — verify before following up
            </div>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {pendingUnallocated.map((u) => {
            const c = cases.find((x) => x.client === u.client);
            return (
              <button
                key={u.id}
                onClick={() => c && onPickCase(c.id)}
                className="w-full text-left px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition flex-wrap"
              >
                <div>
                  <div className="text-sm font-bold text-slate-800">{u.client}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {u.date} • {u.mode}
                    {u.refNo ? " • Ref: " + u.refNo : ""} • Confirmed by {u.confirmedBy}
                  </div>
                </div>
                <div className="text-sm font-black text-indigo-700 font-mono">
                  {inr(u.remaining)}
                </div>
              </button>
            );
          })}
          {pendingUnallocated.length === 0 && (
            <div className="text-center text-xs text-slate-400 py-8 italic">
              No unmatched payments pending reconciliation.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

