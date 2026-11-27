import React from "react";
import { ORIGINS, COORDS } from "../../../utils/constants";
import {
  ORIGIN_ICON,
  contactsOf,
  validEmail,
  allReady,
  r10,
  formatEnquiryNo,
  ENQUIRY_CONFIG,
} from "../../../utils/helpers";
import ContactEditor from "../ContactEditor";
import BillingParty from "../BillingParty";

const EnquiryIntakeSection = ({
  s,
  set,
  e,
  setE,
  client,
  ids,
  canAssign,
  coordinatorsList,
  initials,
  heat,
  est,
}) => {
  const ct = contactsOf(client, s).find((x) => x.id === s.contactId);
  const refLooksWrong =
    e.refNo && (validEmail(e.refNo) || /^\+?\d[\d\s-]{8,}$/.test(e.refNo.trim()));
  const canLog = !!e.origin && !!ct && !refLooksWrong;
  const hs = heat ? Math.max(0, Math.min(100, heat.sc)) : 0;
  const ups = heat ? heat.r.filter(([t]) => t === "up") : [];
  const downs = heat ? heat.r.filter(([t]) => t === "down") : [];
  const notes = heat ? heat.r.filter(([t]) => !t) : [];

  return (
    <div className="fade space-y-4">
      {/* Card 1: Who asked? */}
      <section className="lcard panel p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
        <div className="lhead flex items-start gap-3 mb-3">
          <span className="lnum inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-800 text-xs font-bold">
            1
          </span>
          <div>
            <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
              Who asked?{" "}
              <span className="side client text-xs font-normal text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                Client side
              </span>
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              The person at {client ? client.name : "the client"} who sent the enquiry. Quotes, proformas and confirmations go to them.
            </p>
          </div>
        </div>
        <ContactEditor
          s={s}
          set={set}
          client={client}
          selId={s.contactId}
          onSelect={(v) =>
            set({ contactId: v, touched: { ...s.touched, contactId: "picked" } })
          }
        />
      </section>

      {/* Card 2: Billing & payment */}
      <section className="lcard panel p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
        <div className="lhead flex items-start gap-3 mb-3">
          <span className="lnum inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-800 text-xs font-bold">
            2
          </span>
          <div>
            <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
              Billing &amp; payment{" "}
              <span className="side client text-xs font-normal text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                Who pays
              </span>
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Leave as is when {client ? client.name : "client"} pays. Switch if the invoice goes to an agency or another company.
            </p>
          </div>
        </div>
        <BillingParty s={s} set={set} client={client} />
      </section>

      {/* Card 3: How did it come in? */}
      <section className="lcard panel p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
        <div className="lhead flex items-start gap-3 mb-3">
          <span className="lnum inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-800 text-xs font-bold">
            3
          </span>
          <div>
            <h3 className="font-bold text-base text-gray-900">How did it come in?</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {client && client.origin
                ? `${client.name.split(" ")[0]} usually reaches us by ${client.origin}.`
                : "Pick the channel."}
            </p>
          </div>
        </div>
        <div className="otiles flex gap-2 flex-wrap mb-4">
          {ORIGINS.map((o) => (
            <button
              key={o}
              className={`relative p-3 border rounded-xl text-[11px] font-bold flex flex-col items-start gap-2 w-[92px] transition ${
                e.origin === o
                  ? "bg-indigo-50 border-indigo-600 text-indigo-800 shadow-sm"
                  : "bg-white text-gray-800 border-gray-200 hover:border-gray-300 shadow-2xs"
              }`}
              onClick={() => setE({ origin: o })}
            >
              <span className="text-base">{ORIGIN_ICON[o]}</span>
              <span>{o}</span>
              {client && client.origin === o && (
                <em
                  className={`absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded not-italic ${
                    e.origin === o
                      ? "bg-indigo-600 text-white"
                      : "bg-[#fff1d6] text-[#b37a1c]"
                  }`}
                >
                  usual
                </em>
              )}
            </button>
          ))}
        </div>

        <label className="refl block text-xs font-semibold text-gray-700">
          <span>
            Client’s reference no. <i className="font-normal text-gray-400">optional</i>
          </span>
          <input
            className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white font-normal focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
            placeholder="Their RFQ, PO or email subject line"
            value={e.refNo || ""}
            onChange={(ev) => setE({ refNo: ev.target.value }, "refNo")}
          />
          {refLooksWrong && (
            <small className="text-red-500 text-xs mt-1 block">
              This looks like{" "}
              {validEmail(e.refNo) ? "an email address" : "a phone number"}. Contact
              details belong under “Who asked?”.
            </small>
          )}
        </label>
      </section>

      {/* Card A: Assign to (Admin & CS Manager Only) */}
      {canAssign && (
        <section className="lcard adminonly panel p-4 bg-amber-50/50 border border-amber-200 rounded-xl">
          <div className="lhead flex items-start gap-3 mb-3">
            <span className="lnum inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-200 text-amber-900 text-xs font-bold">
              A
            </span>
            <div>
              <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
                Assign to{" "}
                <span className="side rd text-xs font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                  Admin / Manager view
                </span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Visible to Admins and CS Managers. CS executives log enquiries under their own name automatically.
              </p>
            </div>
          </div>
          <div className="ctiles grid grid-cols-1 md:grid-cols-3 gap-3">
            {(coordinatorsList.length > 0
              ? coordinatorsList
              : COORDS.map((name) => ({
                  name,
                  role: "Client Servicing",
                  open_enquiries: 0,
                }))
            ).map((c) => {
              const cName = c.name;
              const cRole = c.role || "Client Servicing";
              const openCount = c.open_enquiries || 0;
              const isLightest =
                coordinatorsList.length > 1 &&
                coordinatorsList.every((x) => (x.open_enquiries || 0) >= openCount);
              const isOwner =
                client && (client.owner === cName || client.owner_name === cName);
              const isSel = s.coordinator === cName;

              return (
                <button
                  key={c.id || c._id || cName}
                  type="button"
                  className={`ctile p-3 rounded-lg border text-left transition cursor-pointer ${
                    isSel
                      ? "bg-white border-amber-600 shadow-md ring-2 ring-amber-500/20"
                      : "bg-white border-gray-200 hover:border-amber-400"
                  }`}
                  onClick={() =>
                    set({
                      coordinator: cName,
                      touched: { ...s.touched, coordinator: "picked" },
                    })
                  }
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="cav w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center shrink-0">
                      {initials(cName)}
                    </span>
                    <div className="truncate">
                      <span className="cn text-xs font-bold text-gray-900 block truncate">
                        {cName}
                      </span>
                      <span className="text-[10px] text-gray-400 block font-normal">
                        {cRole}
                      </span>
                    </div>
                  </div>
                  <span className="cm text-[11px] text-gray-500 block">
                    {openCount} open enquiries
                  </span>
                  <div className="ctags flex gap-1 mt-1.5 flex-wrap">
                    {isOwner && (
                      <em className="own text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-medium not-italic">
                        Handles this client
                      </em>
                    )}
                    {isLightest && (
                      <em className="light text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-medium not-italic">
                        Lightest load
                      </em>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Heat Score Meter (0-100) */}
      {heat && (
        <section
          className={`lcard heatcard panel p-4 rounded-xl border ${
            heat.label === "hot"
              ? "bg-red-50/60 border-red-200"
              : heat.label === "warm"
              ? "bg-amber-50/60 border-amber-200"
              : "bg-slate-50 border-slate-200"
          }`}
        >
          <div className="hrow flex items-center gap-4 mb-3">
            <div className="hbig text-center">
              <b className="text-3xl font-extrabold text-gray-900">{hs}</b>
              <span className="text-xs text-gray-400">/100</span>
            </div>
            <div className="hmid flex-1">
              <div className="htitle flex items-center justify-between mb-1">
                <span
                  className={`heat text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                    heat.label === "hot"
                      ? "bg-red-600 text-white"
                      : heat.label === "warm"
                      ? "bg-amber-500 text-white"
                      : "bg-slate-600 text-white"
                  }`}
                >
                  {heat.label === "hot"
                    ? "Hot"
                    : heat.label === "warm"
                    ? "Warm"
                    : "Cold"}{" "}
                  enquiry
                </span>
                <span className="hint text-xs text-gray-400">
                  Sets priority in Design &amp; Costing queues
                </span>
              </div>
              <div className="meter relative w-full h-3 bg-gray-200 rounded-full overflow-hidden my-1">
                <div
                  className={`h-full transition-all duration-300 ${
                    heat.label === "hot"
                      ? "bg-red-500"
                      : heat.label === "warm"
                      ? "bg-amber-500"
                      : "bg-slate-500"
                  }`}
                  style={{ width: `${hs}%` }}
                />
              </div>
              <div className="mscale flex justify-between text-[10px] text-gray-400">
                <span>Cold 0</span>
                <span>Warm 50</span>
                <span>Hot 70</span>
              </div>
            </div>
          </div>

          <div className="hcols grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t text-xs">
            <div>
              <h4 className="font-bold text-emerald-700 mb-1">Pushing it up</h4>
              {ups.length ? (
                ups.map(([, x]) => (
                  <p key={x} className="up text-emerald-800 font-medium">
                    + {x}
                  </p>
                ))
              ) : (
                <p className="hint text-gray-400">Nothing yet</p>
              )}
            </div>
            <div>
              <h4 className="font-bold text-red-700 mb-1">Holding it back</h4>
              {downs.length ? (
                downs.map(([, x]) => (
                  <p key={x} className="down text-red-800 font-medium">
                    − {x}
                  </p>
                ))
              ) : (
                <p className="hint text-gray-400">Nothing</p>
              )}
            </div>
            {notes.length > 0 && (
              <div>
                <h4 className="font-bold text-gray-700 mb-1">Worth knowing</h4>
                {notes.map(([, x]) => (
                  <p key={x} className="text-gray-600">
                    {x}
                  </p>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <p className="hint text-xs text-gray-500 italic text-center">
        Delivery mode, courier and payment terms aren’t asked here. Terms come from the client master; delivery is picked when the order is confirmed.
      </p>

      {/* Bottom Log Bar */}
      <div className="logbar flex items-center justify-between p-4 bg-white border rounded-xl shadow-lg mt-4">
        <div className="lsum">
          <b className="text-base text-gray-900 block">
            {ids?.enq || (s?.seq ? formatEnquiryNo(s.seq) : ENQUIRY_CONFIG.DEFAULT_ENQUIRY_NO)}
          </b>
          <span className="text-xs text-gray-500">
            Client: {ct ? ct.name : "—"} · via {e.origin || "—"}
            {canAssign ? ` · assigned to ${s.coordinator || "—"}` : ""}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            className="btn ghost px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"
            onClick={() => set({ step: s.step - 1 })}
          >
            ← Back
          </button>
          <button
            className="btn gold px-5 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg disabled:opacity-50 transition cursor-pointer"
            disabled={!canLog}
            onClick={() => {
              const now = new Date().toISOString();
              if (allReady(s)) {
                const rate = est || 1000;
                set({
                  enqSent: true,
                  loggedAt: now,
                  costReq: now,
                  quoteRate: r10(rate),
                  jobRate: r10(rate),
                });
              } else {
                set({
                  enqSent: true,
                  loggedAt: now,
                  costReq: null,
                });
              }
            }}
          >
            Log enquiry
          </button>
        </div>
      </div>
      {!canLog && (
        <p className="hint text-xs text-red-500 text-right">
          {!ct
            ? "Pick who asked."
            : !e.origin
            ? "Pick how it came in."
            : "Fix the client reference."}
        </p>
      )}
    </div>
  );
};

export default EnquiryIntakeSection;

