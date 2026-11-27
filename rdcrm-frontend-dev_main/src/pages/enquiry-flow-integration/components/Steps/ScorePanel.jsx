import React, { useState } from "react";

const ScorePanel = ({ s, client, f }) => {
  const [open, setOpen] = useState(false);

  // Compute points based on current job lifecycle status
  let completionPts = 60;
  if (s.enqSent) completionPts += 30;
  if (s.quoted) completionPts += 30;
  if (s.approved) completionPts += 40;
  if (s.pi?.sent) completionPts += 30;
  if (s.released) completionPts += 30;
  if (s.dispatched) completionPts += 30;
  completionPts = Math.min(250, completionPts);

  let onTimePts = 120;
  if (s.dtpSampleApproved || s.dtpProdApproved) onTimePts += 40;
  if (s.packedAt) onTimePts += 40;
  if (s.deliveredAt) onTimePts += 50;
  onTimePts = Math.min(250, onTimePts);

  let collectionsPts = 0;
  if (s.rcpt) collectionsPts += 150;
  if (s.balRcpt) collectionsPts += 250;
  collectionsPts = Math.min(400, collectionsPts);

  let cxPts = 60;
  if (s.review?.stars >= 4) cxPts += 40;
  cxPts = Math.min(100, cxPts);

  const total = completionPts + onTimePts + collectionsPts + cxPts;
  const grade = total >= 900 ? "A+" : total >= 800 ? "A" : total >= 650 ? "B" : total >= 500 ? "C" : "D";
  const stars = Math.max(1, Math.min(5, Math.round(total / 200)));

  return (
    <div className="w-full bg-white border border-indigo-100 rounded-2xl p-5 shadow-2xs transition-all">
      <div
        className="flex items-center gap-6 cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        {/* Ring Chart */}
        <div className="w-16 h-16 rounded-full border-4 border-gray-100 flex items-center justify-center relative shrink-0">
          <svg className="absolute inset-0 w-full h-full -rotate-90">
            <circle
              cx="28"
              cy="28"
              r="28"
              fill="none"
              stroke="#6366f1"
              strokeWidth="4"
              strokeDasharray="175"
              strokeDashoffset={175 - (175 * total) / 1000}
              className="translate-x-1 translate-y-1 transition-all duration-700"
            />
          </svg>
          <div className="text-center">
            <div className="text-lg font-black text-gray-900 leading-none">{total}</div>
            <div className="text-[7px] font-bold text-gray-400 leading-none mt-1">/ 1000</div>
          </div>
        </div>

        {/* Breakdown bars */}
        <div className="flex-1">
          <div className="flex justify-between items-start mb-1">
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-[13px] text-gray-900">Job score · {grade}</h4>
              <span className="text-amber-400 text-[10px] tracking-widest">
                {"★".repeat(stars)}{"☆".repeat(5 - stars)}
              </span>
            </div>
            <span className="text-[10px] font-bold text-indigo-700 hover:underline">
              {open ? "Hide details ▲" : "Details ▼"}
            </span>
          </div>
          <p className="text-[10px] text-gray-500 mb-3">
            Builds as tasks are completed on time and payments are collected. Up to 1050 still possible.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <div className="flex justify-between text-[9px] font-bold text-gray-500 mb-1">
                <span>Completion</span>
                <span>{completionPts}/250</span>
              </div>
              <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full"
                  style={{ width: `${(completionPts / 250) * 100}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[9px] font-bold text-gray-500 mb-1">
                <span>On time</span>
                <span>{onTimePts}/250</span>
              </div>
              <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full"
                  style={{ width: `${(onTimePts / 250) * 100}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[9px] font-bold text-gray-500 mb-1">
                <span>Collections</span>
                <span>{collectionsPts}/400</span>
              </div>
              <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{ width: `${(collectionsPts / 400) * 100}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[9px] font-bold text-gray-500 mb-1">
                <span>Experience</span>
                <span>{cxPts}/100</span>
              </div>
              <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${(cxPts / 100) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {open && (
        <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-600 space-y-2">
          <div className="flex justify-between py-1">
            <span>Enquiry and quote completion</span>
            <span className="font-bold text-emerald-700">✓ Full points</span>
          </div>
          <div className="flex justify-between py-1">
            <span>Sample production & delivery speed</span>
            <span className="font-bold text-emerald-700">✓ On time</span>
          </div>
          <div className="flex justify-between py-1">
            <span>Payment collection timeline</span>
            <span className="font-bold text-gray-800">
              {collectionsPts > 0 ? "✓ Advance collected" : "Pending advance"}
            </span>
          </div>
          <div className="flex justify-between py-1">
            <span>Customer satisfaction feedback</span>
            <span className="font-bold text-gray-800">
              {s.review ? `✓ ${s.review.stars}★ review logged` : "Awaiting review"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScorePanel;
