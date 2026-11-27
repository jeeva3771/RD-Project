import React from "react";
import { COLLECTION_STAGES } from "../../constants/collectionsConstants";
import { inr, isPromiseOverdue } from "../../utils/collectionsFormatters";
import CollectionIcon from "../common/CollectionIcon";

export default function CollectionsBoardView({
  filtered,
  groupBy,
  setGroupBy,
  entityFilter,
  setEntityFilter,
  todayOnly,
  setTodayOnly,
  clientLeaderboard,
  officerLeaderboard,
  onSelectCase,
}) {
  return (
    <div className="pb-8">
      {/* Sub-Header: Leaderboard Switcher */}
      <div className="px-4 sm:px-6 pt-4 pb-2 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <span>Collections Follow-up Board</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Click any case to email, WhatsApp, log notes, or schedule follow-up.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
          <button
            onClick={() => {
              setGroupBy("client");
              setEntityFilter(null);
            }}
            className={`text-xs font-bold px-3 py-1.5 rounded-md transition ${
              groupBy === "client"
                ? "bg-white text-amber-800 shadow-2xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Client-wise
          </button>
          <button
            onClick={() => {
              setGroupBy("officer");
              setEntityFilter(null);
            }}
            className={`text-xs font-bold px-3 py-1.5 rounded-md transition ${
              groupBy === "officer"
                ? "bg-white text-amber-800 shadow-2xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Officer-wise
          </button>
        </div>
      </div>

      {/* Horizontal Leaderboard Chips */}
      <div className="mx-4 sm:mx-6 mt-1">
        <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-2">
          {groupBy === "client"
            ? "Outstanding By Client (Tap chip to filter board)"
            : "Outstanding By Collection Officer (Tap chip to filter board)"}
        </div>
        <div className="flex gap-2.5 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-slate-300">
          {(groupBy === "client" ? clientLeaderboard : officerLeaderboard).map(
            (row) => {
              const key = groupBy === "client" ? row.client : row.owner;
              const isActive = entityFilter === key;
              return (
                <button
                  key={key}
                  onClick={() => setEntityFilter(isActive ? null : key)}
                  className={`shrink-0 w-40 text-left rounded-xl border p-3 bg-white transition cursor-pointer ${
                    isActive
                      ? "border-amber-500 ring-2 ring-amber-100 shadow-xs"
                      : "border-slate-200 hover:border-slate-300 hover:shadow-2xs"
                  }`}
                >
                  <div className="text-xs font-bold text-slate-800 truncate">{key}</div>
                  <div className="text-base font-black text-amber-700 mt-1 font-mono">
                    {inr(row.total)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {row.count} case{row.count === 1 ? "" : "s"}
                    {row.escalated ? ` • ${row.escalated} escalated` : ""}
                  </div>
                </button>
              );
            }
          )}
          {(groupBy === "client" ? clientLeaderboard : officerLeaderboard).length === 0 && (
            <div className="text-xs text-slate-400 py-3 italic">
              No records found for this filter.
            </div>
          )}
        </div>
      </div>

      {/* Active Filter Pill */}
      {(entityFilter || todayOnly) && (
        <div className="mx-4 sm:mx-6 mt-3 rounded-xl border border-indigo-200 bg-indigo-50/70 px-4 py-2 flex items-center justify-between flex-wrap gap-2 text-xs text-indigo-900">
          <div>
            <span className="font-bold">Filtered:</span>{" "}
            {entityFilter && <span>{entityFilter} </span>}
            {todayOnly && <span>• Due Today </span>}
            <span>({filtered.length} cases)</span>
          </div>
          <button
            onClick={() => {
              setEntityFilter(null);
              setTodayOnly(false);
            }}
            className="flex items-center gap-1 font-bold text-indigo-700 hover:text-indigo-900"
          >
            <CollectionIcon name="x" size={13} /> Clear Filter
          </button>
        </div>
      )}

      {/* Kanban Columns */}
      <div className="flex gap-3.5 px-4 sm:px-6 pt-4 overflow-x-auto pb-6 scrollbar-thin scrollbar-thumb-slate-300 items-start">
        {COLLECTION_STAGES.map((stage) => {
          const stageCases = filtered.filter((c) => c.stage === stage.id);
          const stageTotal = stageCases.reduce((s, c) => s + c.total, 0);

          return (
            <div
              key={stage.id}
              className="w-72 shrink-0 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col max-h-[75vh]"
            >
              {/* Lane Header */}
              <div
                className="px-4 py-3 border-b border-slate-100 rounded-t-2xl"
                style={{ background: stage.color + "12" }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-800">
                    {stage.label}
                  </span>
                  <span
                    className="text-xs font-black shrink-0 px-2 py-0.5 rounded-full text-white"
                    style={{ background: stage.color }}
                  >
                    {stageCases.length}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono font-semibold mt-1">
                  {inr(stageTotal)} outstanding
                </div>
              </div>

              {/* Lane Cards Scrollable */}
              <div className="overflow-y-auto p-2.5 space-y-2 flex-1 scrollbar-thin scrollbar-thumb-slate-300">
                {stageCases.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onSelectCase(c.id)}
                    className="w-full text-left bg-slate-50/70 hover:bg-white hover:shadow-md border border-slate-200/80 rounded-xl p-3 transition duration-150 cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-800 truncate flex items-center gap-1">
                        {c.allPaid && (
                          <CollectionIcon
                            name="check"
                            size={13}
                            className="text-emerald-600 shrink-0"
                          />
                        )}
                        {c.client}
                      </span>
                      {c.oldest > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-bold shrink-0">
                          {c.oldest}d
                        </span>
                      )}
                    </div>

                    <div
                      className="text-base font-black mt-1.5 font-mono"
                      style={{ color: c.allPaid ? "#10B981" : stage.color }}
                    >
                      {c.allPaid ? "Settled" : inr(c.total)}
                    </div>

                    {/* Attribute Badges */}
                    {(c.repeatOffenderTier === "Repeat Offender" ||
                      c.hasUnallocated ||
                      (c.stage === "promised" && c.promisedDate)) && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {c.repeatOffenderTier === "Repeat Offender" && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700 flex items-center gap-0.5">
                            <CollectionIcon name="alert" size={9} /> Repeat
                          </span>
                        )}
                        {c.hasUnallocated && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-700 flex items-center gap-0.5">
                            <CollectionIcon name="link" size={9} /> Unmatched
                          </span>
                        )}
                        {c.stage === "promised" && c.promisedDate && (
                          isPromiseOverdue(c.promisedDateIso) ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700 flex items-center gap-0.5">
                              <CollectionIcon name="alert" size={9} /> Broken: {c.promisedDate}
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-teal-100 text-teal-800 flex items-center gap-0.5">
                              <CollectionIcon name="calendar" size={9} /> Promised: {c.promisedDate}
                            </span>
                          )
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-400">
                      <span className="font-semibold text-slate-600">{c.owner}</span>
                      {c.stage === "promised" && c.promisedAmount ? (
                        <span className="font-bold text-teal-700">
                          Pmt: {inr(c.promisedAmount)}
                        </span>
                      ) : c.nextFollowUp ? (
                        <span className="font-bold text-amber-700">
                          FU: {c.nextFollowUp}
                        </span>
                      ) : null}
                    </div>
                  </button>
                ))}

                {stageCases.length === 0 && (
                  <div className="text-center text-xs text-slate-400 py-8 italic">
                    No cases in this stage
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

