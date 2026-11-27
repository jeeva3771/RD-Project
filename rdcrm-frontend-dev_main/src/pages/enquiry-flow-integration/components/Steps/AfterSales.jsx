import React, { useState } from "react";
import { dfmt, todayISO } from "../../utils/helpers";

const TICKET_TYPES = [
  "Quality complaint",
  "Breakage / damage",
  "Wrong item or quantity",
  "Late delivery",
  "Billing issue",
  "Client feedback"
];

const AfterSales = ({ s, set, client }) => {
  const [tk, setTk] = useState(null);
  const [rv, setRv] = useState(null);
  const tickets = s.tickets || [];

  const handleResolveTicket = (id, resText) => {
    set({
      tickets: tickets.map((t) =>
        t.id === id
          ? {
              ...t,
              status: "Resolved",
              resolvedAt: new Date().toISOString(),
              resolution: resText
            }
          : t
      )
    });
  };

  const dispatchedDateStr = s.dispatched?.date ? dfmt(s.dispatched.date) : "12 Oct 2026";
  const carrierName = s.dispatched?.carrier || s.deliv?.carrier || "Tempo";

  return (
    <div className="w-full bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-5 text-xs">
      <div className="flex items-start gap-3">
        <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center text-base shrink-0 shadow-2xs">
          🛎️
        </span>
        <div>
          <h4 className="font-extrabold text-base text-gray-900 tracking-tight">After-sales</h4>
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
            Dispatched {dispatchedDateStr} by {carrierName}. Confirm delivery, handle issues and log the client's review. These feed the job score.
          </p>
        </div>
      </div>

      <div className="divide-y divide-gray-100 border-t border-gray-100">
        {/* Row 1: Delivered */}
        <div className="py-4 flex items-center gap-6">
          <div className="w-24 shrink-0 font-bold text-gray-700 text-xs">
            Delivered
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            {!s.deliveredAt ? (
              <>
                <button
                  type="button"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl shadow-2xs transition cursor-pointer"
                  onClick={() => set({ deliveredAt: todayISO() })}
                >
                  Mark delivered today
                </button>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>or date</span>
                  <input
                    type="date"
                    className="px-3 py-1.5 border border-gray-300 rounded-xl text-xs text-gray-700 bg-white outline-none focus:border-indigo-500"
                    onChange={(e) => {
                      if (e.target.value) set({ deliveredAt: e.target.value });
                    }}
                  />
                  <span className="text-[11px] text-gray-400">
                    Promised {s.delivery_details?.delivery_date ? dfmt(s.delivery_details.delivery_date) : "Wed, 28 Oct"}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg font-bold text-xs">
                  ✓ Delivered on {dfmt(s.deliveredAt)}
                </span>
                <button
                  type="button"
                  onClick={() => set({ deliveredAt: null })}
                  className="text-xs text-gray-400 hover:text-gray-600 underline cursor-pointer ml-2"
                >
                  Edit
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Issues */}
        <div className="py-4 flex items-start gap-6">
          <div className="w-24 shrink-0 font-bold text-gray-700 text-xs pt-1.5">
            Issues
          </div>
          <div className="flex-1 space-y-3">
            {!tk && (
              <button
                type="button"
                className="px-3.5 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 text-gray-700 font-bold rounded-xl shadow-2xs transition cursor-pointer"
                onClick={() => setTk({ type: "Quality complaint", desc: "", sev: "Medium" })}
              >
                + Raise a ticket
              </button>
            )}

            {/* New Ticket Form */}
            {tk && (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2.5">
                <div className="flex flex-wrap gap-1.5">
                  {TICKET_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border cursor-pointer ${
                        tk.type === type
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-white text-gray-600 border-gray-200"
                      }`}
                      onClick={() => setTk({ ...tk, type })}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={2}
                  placeholder="What happened? e.g. 2 pieces arrived with cracked acrylic"
                  className="w-full p-2 text-xs border border-gray-300 rounded-lg outline-none bg-white"
                  value={tk.desc}
                  onChange={(e) => setTk({ ...tk, desc: e.target.value })}
                />

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-2xs cursor-pointer"
                    disabled={tk.desc.trim().length < 4}
                    onClick={() => {
                      const newId = `TKT-${Date.now().toString().slice(-4)}`;
                      set({
                        tickets: [
                          ...tickets,
                          {
                            ...tk,
                            id: newId,
                            no: newId,
                            status: "Open",
                            at: new Date().toISOString()
                          }
                        ]
                      });
                      setTk(null);
                    }}
                  >
                    Raise ticket
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 text-gray-500 hover:text-gray-700 font-semibold cursor-pointer"
                    onClick={() => setTk(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Row 3: Review */}
        <div className="py-4 flex items-start gap-6">
          <div className="w-24 shrink-0 font-bold text-gray-700 text-xs pt-1.5">
            Review
          </div>
          <div className="flex-1 space-y-3">
            {!s.review && !rv && (
              <button
                type="button"
                className="px-3.5 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 text-gray-700 font-bold rounded-xl shadow-2xs transition cursor-pointer"
                onClick={() => setRv({ stars: 5, comment: "", via: "WhatsApp" })}
              >
                + Log client review
              </button>
            )}
            {s.review && (
              <div className="flex items-center gap-2">
                <span className="text-amber-500 font-bold text-sm">
                  {"★".repeat(s.review.stars)}{"☆".repeat(5 - s.review.stars)}
                </span>
                <span className="text-gray-700 font-medium">"{s.review.comment}"</span>
                <span className="text-gray-400 text-[11px]">({s.review.via})</span>
              </div>
            )}

            {rv && (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2.5">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-gray-700">Rating:</span>
                  <div className="flex gap-1 text-amber-400 text-base">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        className="cursor-pointer hover:scale-110 transition"
                        onClick={() => setRv({ ...rv, stars: star })}
                      >
                        {star <= rv.stars ? "★" : "☆"}
                      </button>
                    ))}
                  </div>
                  <select
                    className="p-1.5 text-xs border border-gray-300 rounded-lg outline-none ml-2 bg-white"
                    value={rv.via}
                    onChange={(e) => setRv({ ...rv, via: e.target.value })}
                  >
                    <option>WhatsApp</option>
                    <option>Google review</option>
                    <option>Email</option>
                    <option>Call</option>
                  </select>
                </div>

                <input
                  type="text"
                  placeholder="Client comment, e.g. Loved the finish, trophy was a huge hit!"
                  className="w-full p-2 text-xs border border-gray-300 rounded-lg outline-none bg-white"
                  value={rv.comment}
                  onChange={(e) => setRv({ ...rv, comment: e.target.value })}
                />

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    className="px-4 py-1.5 bg-amber-400 hover:bg-amber-500 text-amber-950 font-bold rounded-lg shadow-2xs cursor-pointer"
                    onClick={() => {
                      set({ review: { ...rv, at: new Date().toISOString() } });
                      setRv(null);
                    }}
                  >
                    Save review
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 text-gray-500 hover:text-gray-700 font-semibold cursor-pointer"
                    onClick={() => setRv(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Support / Damage Tickets List Section */}
      {tickets.length > 0 && (
        <div className="space-y-2 pt-3 border-t border-gray-100">
          <div className="font-bold text-gray-800 text-xs">Logged Tickets ({tickets.length})</div>
          {tickets.map((t) => (
            <div
              key={t.id}
              className={`p-3 rounded-xl border bg-gray-50/60 space-y-1.5 ${
                t.status === "Resolved" ? "border-emerald-300" : "border-rose-300"
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-800">
                  {t.no} · {t.type}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    t.status === "Resolved"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-rose-100 text-rose-800"
                  }`}
                >
                  {t.status}
                </span>
              </div>
              <p className="text-gray-600 text-[11px]">{t.desc}</p>
              {t.status !== "Resolved" && (
                <div className="pt-2 flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Resolution note (e.g. replacement sent)"
                    className="flex-1 p-1.5 text-xs border border-gray-300 rounded-lg outline-none bg-white"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && e.target.value.trim()) {
                        handleResolveTicket(t.id, e.target.value.trim());
                      }
                    }}
                  />
                  <button
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs cursor-pointer"
                    onClick={(e) => {
                      const input = e.target.previousElementSibling;
                      if (input && input.value.trim()) {
                        handleResolveTicket(t.id, input.value.trim());
                      }
                    }}
                  >
                    Resolve
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AfterSales;
