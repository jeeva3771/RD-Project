import React from "react";
import { STAGES, jobStage } from "../../utils/helpers";

const StageBar = ({ s, f }) => {
  const cur = jobStage(s, f);
  if (cur === "cancelled") {
    return (
      <div className="stagebar flex flex-wrap gap-1.5 mb-3" role="list" aria-label="Job stage">
        <span
          className="stg on inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold"
          style={{ background: "#E5E7EB", color: "#374151", borderColor: "#6B7280" }}
        >
          <em
            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white not-italic"
            style={{ background: "#6B7280" }}
          >
            ✕
          </em>
          Order cancelled · job abandoned
        </span>
      </div>
    );
  }

  const idx = STAGES.findIndex((x) => x.k === cur);
  const sampleUsed = s?.mode === "sample" || (s?.rounds || []).length > 0;

  return (
    <div className="stagebar flex flex-wrap gap-1.5 mb-3.5" role="list" aria-label="Job stage">
      {STAGES.filter((x) => x.k !== "cancelled").map((x, i) => {
        const skip =
          (x.k === "sample" && (s?.stage === "order" || (s?.step !== undefined && s.step >= 4)) && !sampleUsed) ||
          (x.k === "collections" && cur === "closed" && !(s?.followups || []).length);
        const isOn = i === idx;
        const isDone = i < idx && !skip;

        return (
          <span
            key={x.k}
            role="listitem"
            className={`stg inline-flex items-center gap-1.5 py-1 px-3 rounded-full border text-xs transition-colors ${
              isOn
                ? "on font-bold shadow-2xs"
                : isDone
                ? "done bg-white text-indigo-900 border-indigo-200 font-semibold"
                : skip
                ? "skip opacity-50 bg-white text-gray-400 border-gray-200 text-xs"
                : "bg-white text-gray-500 border-gray-200 font-medium"
            }`}
            style={
              isOn
                ? { background: x.bg, color: x.ink, borderColor: x.c }
                : null
            }
          >
            <em
              className="w-4.5 h-4.5 rounded-full flex items-center justify-center text-[10px] not-italic shrink-0 font-bold"
              style={
                isOn
                  ? { background: x.c, color: "#fff" }
                  : isDone
                  ? { background: "#4B3BF5", color: "#fff" }
                  : { background: "#F3F4F6", color: "#9CA3AF" }
              }
            >
              {isDone ? "✓" : skip ? "–" : i + 1}
            </em>
            <span>{x.icon}</span>
            <span>{x.t}</span>
            {skip && <span className="text-[10px] text-gray-400">(skipped)</span>}
          </span>
        );
      })}
    </div>
  );
};

export default StageBar;
