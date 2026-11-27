import React from "react";
import { DeliveryChargeRequestsTab } from "./components/CTPack";

export default function DeliveryChargeRequestsPage() {
  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
      {/* Standalone Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 flex-wrap gap-2">
        <div>
          <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">
            Logistics &amp; Dispatch
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2 mt-0.5">
            <span>🚚</span>
            <span>Delivery Charge Requests</span>
          </h1>
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Freight rate estimation &amp; courier coordination desk
        </div>
      </div>

      {/* Main Tab Component */}
      <DeliveryChargeRequestsTab />
    </div>
  );
}
