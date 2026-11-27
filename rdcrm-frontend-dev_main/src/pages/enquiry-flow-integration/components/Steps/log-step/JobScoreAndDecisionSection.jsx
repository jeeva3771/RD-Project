import React from "react";
import { allReady } from "../../../utils/helpers";

const JobScoreAndDecisionSection = ({
  s,
  set,
  e,
  client,
  productsList,
  currentUser,
  quoted,
  setShowPrint,
  goOrder,
  isLocked = false,
}) => {
  const isAllReadyOrNoDesigner =
    !e.designer ||
    s.designApproved ||
    allReady(s) ||
    (productsList.length > 0 && productsList.every((p) => p.kind === "ready"));

  return (
    <div className="space-y-4">
      {/* Print Button */}
      {!isAllReadyOrNoDesigner && (
        <div>
          <button
            onClick={() => setShowPrint(true)}
            className="px-4 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 transition shadow-sm cursor-pointer"
          >
            Print enquiry log
          </button>
        </div>
      )}

      {/* Job Score Panel */}
      <div className="panel p-4 bg-white border border-gray-200 rounded-xl shadow-sm flex items-start gap-4">
        {/* Circle */}
        <div className="relative w-16 h-16 rounded-full border-4 border-gray-100 flex items-center justify-center shrink-0">
          <svg className="absolute inset-0 w-full h-full -rotate-90">
            <circle
              cx="28"
              cy="28"
              r="28"
              fill="none"
              stroke="#6366f1"
              strokeWidth="4"
              strokeDasharray="175"
              strokeDashoffset="165"
              className="translate-x-1 translate-y-1"
            />
          </svg>
          <div className="text-center leading-none">
            <div className="font-black text-lg text-gray-900">30</div>
            <div className="text-[8px] text-gray-400 font-bold">/ 1000</div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-sm text-gray-900">Job score · D</h4>
              <span className="text-amber-400 text-xs tracking-widest">
                ★★<span className="text-gray-200">☆☆☆</span>
              </span>
            </div>
            <button className="text-xs font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer">
              Details
            </button>
          </div>
          <p className="text-[10px] text-gray-500 mb-4">
            Builds as {s.coordinator || currentUser?.name || "Admin"} completes tasks on time and collects payments. Up to 1050 still possible.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <div className="flex justify-between text-[10px] font-bold text-gray-500 mb-1.5">
                <span>Completion</span>
                <span>30/250</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 w-[12%] rounded-full" />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] font-bold text-gray-500 mb-1.5">
                <span>On time</span>
                <span>0/250</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gray-300 w-0" />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] font-bold text-gray-500 mb-1.5">
                <span>Collections</span>
                <span>0/400</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gray-300 w-0" />
              </div>
            </div>
          </div>
          <div className="mt-4 sm:w-1/3 sm:pr-2">
            <div className="flex justify-between text-[10px] font-bold text-gray-500 mb-1.5">
              <span>Client experience</span>
              <span>0/100</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-gray-300 w-0" />
            </div>
          </div>
        </div>
      </div>

      {!isLocked && (
        <div className="pt-2">
          <button
            className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 transition shadow-sm cursor-pointer"
            onClick={() => set({ step: s.step - 1 })}
          >
            ← Back to brief
          </button>
        </div>
      )}
    </div>
  );
};

export default JobScoreAndDecisionSection;
