import React, { useState, useMemo } from "react";
import { TODAY } from "../../constants/collectionsConstants";
import { inr, formatDate } from "../../utils/collectionsFormatters";
import CollectionIcon from "../common/CollectionIcon";

export default function ARBridgeCard({ receipts, outstandingToday }) {
  const defaultFrom = useMemo(() => {
    const d = new Date(TODAY);
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  }, []);
  const [fromDate, setFromDate] = useState(defaultFrom);
  const fromObj = new Date(fromDate);

  const receiptsInRange = receipts.filter((r) => {
    if (!r) return false;
    const rDate = r.dateObj instanceof Date ? r.dateObj : new Date(r.dateObj || r.date);
    if (isNaN(rDate.getTime())) return false;
    return rDate >= fromObj && rDate <= TODAY;
  });
  const collected = receiptsInRange.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const opening = outstandingToday + collected;

  const weeks = [];
  let cursor = new Date(fromObj);
  while (cursor <= TODAY) {
    const weekEnd = new Date(cursor);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const amt = receiptsInRange
      .filter((r) => {
        const rDate = r.dateObj instanceof Date ? r.dateObj : new Date(r.dateObj || r.date);
        return rDate >= cursor && rDate <= (weekEnd < TODAY ? weekEnd : TODAY);
      })
      .reduce((s, r) => s + (Number(r.amount) || 0), 0);
    weeks.push({ label: formatDate(cursor), amount: amt });
    cursor = new Date(weekEnd);
    cursor.setDate(cursor.getDate() + 1);
  }
  const maxWeek = Math.max(1, ...weeks.map((w) => w.amount));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
            <CollectionIcon name="bar" size={16} />
          </div>
          <div>
            <div className="font-bold text-slate-800 text-sm">
              Outstanding vs. Receipts Bridge
            </div>
            <div className="text-[11px] text-slate-400">
              Movement from selected start date through today
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
            From
          </span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
            className="border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-indigo-400 text-xs"
          />
          <span className="text-slate-400 font-bold">→ Today</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Opening Outstanding ({formatDate(fromObj)})
          </div>
          <div className="text-lg font-black text-slate-800 mt-1 font-mono">{inr(opening)}</div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
            − Receipts Collected in Period
          </div>
          <div className="text-lg font-black text-emerald-800 mt-1 font-mono">{inr(collected)}</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
            = Outstanding Today
          </div>
          <div className="text-lg font-black text-amber-800 mt-1 font-mono">
            {inr(outstandingToday)}
          </div>
        </div>
      </div>

      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
        Receipts Collected By Week
      </div>
      <div className="space-y-2">
        {weeks.map((w, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="text-[11px] text-slate-500 w-16 shrink-0 font-medium">
              {w.label}
            </span>
            <div className="flex-1 h-3.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: (w.amount / maxWeek) * 100 + "%" }}
              />
            </div>
            <span className="text-[11px] text-slate-700 w-24 text-right shrink-0 font-mono font-bold">
              {inr(w.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

