import React, { useState } from "react";
import { RD_STATE, STATES, stateOf, GST_RE, BILL_REASONS, billOn, payerName, quoteTo, quoteRecipient, posOf } from "../../utils/helpers";

const BillingParty = ({ s, set, client, compact }) => {
  const b = {
    on: false,
    name: '',
    gstin: '',
    address: '',
    reason: 'Event agency',
    contact: { name: '', phone: '', email: '' },
    payerSame: true,
    payer: '',
    pos: '',
    designApprover: 'both',
    quoteTo: 'billing_party',
    ...(s.billTo || {})
  };

  const up = (p, syncNow = false) => set({ billTo: { ...b, ...p }, ...(syncNow ? { syncNow: true } : {}) });
  const [open, setOpen] = useState(!compact);
  const st = stateOf(b.gstin);
  const gstOk = !b.gstin || GST_RE.test(b.gstin);
  const pos = posOf({ billTo: b }, client);

  if (compact && !open) {
    return (
      <div className="billsum p-3 bg-gray-50 border rounded-lg flex items-center justify-between my-2">
        <div>
          <div className="font-semibold text-sm">{billOn(s) ? `Bill to ${b.name}` : `Bill to ${client.name}`}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {billOn(s)
              ? `${b.gstin ? `GSTIN ${b.gstin} · ` : ''}${pos.name} · ${pos.code === RD_STATE ? 'CGST + SGST' : 'IGST'} · payment from ${payerName(s, client)} · quotes to ${quoteTo(s) === 'both' ? 'both' : quoteRecipient(s, client)}`
              : `Same as the client · ${pos.name} · ${pos.code === RD_STATE ? 'CGST + SGST' : 'IGST'}`}
          </div>
        </div>
        <button className="text-indigo-600 text-xs font-semibold hover:underline" onClick={() => setOpen(true)}>
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="billbox my-3">
      <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50/50 p-1 mb-2">
        <button
          className={`px-4 py-1.5 text-[11px] font-bold rounded-lg transition ${!b.on ? "bg-white text-gray-800 shadow-xs border border-gray-200/60" : "text-gray-500 hover:text-gray-700"}`}
          onClick={() => up({ on: false }, true)}
        >
          Bill {client?.name ? client.name.split(' ').slice(0, 2).join(' ') : 'Client'}
        </button>
        <button
          className={`px-4 py-1.5 text-[11px] font-bold rounded-lg transition ${b.on ? "bg-white text-gray-800 shadow-xs border border-gray-200/60" : "text-gray-500 hover:text-gray-700"}`}
          onClick={() => up({ on: true }, true)}
        >
          Bill a different party
        </button>
      </div>

      {!b.on && (
        <div className="text-[11px] text-gray-400 mt-1">
          Invoices go to {client?.name}{stateOf(client?.gstin) ? ` · ${stateOf(client.gstin).name} GST` : ''}.
        </div>
      )}

      {b.on && (
        <div className="fade space-y-4 mt-3">
          <div className="text-[11px] text-gray-400">
            The job, spec and approvals stay with {client?.name}. Proformas, invoices and receipts go to the party below.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="col-span-full block space-y-1">
              <span className="font-bold text-[11px] text-gray-700 block">Billing party (legal name)</span>
              <input
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-xs bg-white focus:border-indigo-500 outline-none transition shadow-2xs"
                value={b.name}
                placeholder="e.g. Team Rustic Events LLP"
                onChange={(ev) => up({ name: ev.target.value })}
              />
            </label>

            <label className="block space-y-1">
              <span className="font-bold text-[11px] text-gray-700 block">Their GSTIN</span>
              <input
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-xs bg-white uppercase focus:border-indigo-500 outline-none transition shadow-2xs"
                maxLength={15}
                value={b.gstin}
                placeholder="15 characters"
                onChange={(ev) => up({ gstin: ev.target.value.toUpperCase().replace(/\s/g, ''), pos: '' })}
              />
              {b.gstin && (gstOk ? (st ? <small className="text-emerald-600 text-[10px] block font-semibold mt-1">{st.name} ({st.code}) GST</small> : null) : <small className="text-red-500 text-[10px] block font-semibold mt-1">Check the GSTIN</small>)}
            </label>

            <label className="col-span-full block space-y-1">
              <span className="font-bold text-[11px] text-gray-700 block">Billing address</span>
              <input
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-xs bg-white focus:border-indigo-500 outline-none transition shadow-2xs"
                value={b.address}
                placeholder="As on their GST certificate"
                onChange={(ev) => up({ address: ev.target.value })}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="block space-y-1">
              <span className="font-bold text-[11px] text-gray-700 block">Contact person</span>
              <input className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-xs bg-white focus:border-indigo-500 outline-none shadow-2xs transition" value={b.contact.name} onChange={(ev) => up({ contact: { ...b.contact, name: ev.target.value } })} />
            </label>
            <label className="block space-y-1">
              <span className="font-bold text-[11px] text-gray-700 block">Mobile</span>
              <div className="flex items-center border border-gray-200 rounded-xl bg-white overflow-hidden focus-within:border-indigo-500 shadow-2xs transition">
                <span className="px-3 bg-white text-gray-500 text-xs py-2 border-r border-gray-200 font-semibold">+91</span>
                <input className="w-full px-3 py-2 text-xs outline-none" inputMode="tel" value={b.contact.phone} onChange={(ev) => up({ contact: { ...b.contact, phone: ev.target.value } })} />
              </div>
            </label>
            <label className="block space-y-1">
              <span className="font-bold text-[11px] text-gray-700 block">Email</span>
              <input className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-xs bg-white focus:border-indigo-500 outline-none shadow-2xs transition" inputMode="email" value={b.contact.email} onChange={(ev) => up({ contact: { ...b.contact, email: ev.target.value } })} />
            </label>
          </div>

          <div>
            <div className="font-bold text-[11px] text-gray-700 mb-2">Why a different party?</div>
            <div className="flex gap-2 flex-wrap">
              {BILL_REASONS.map((r) => (
                <button
                  key={r}
                  className={`px-4 py-1.5 text-[11px] rounded-full border transition cursor-pointer font-bold ${b.reason === r ? "bg-[#635BFF] text-white border-[#635BFF] shadow-xs" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"}`}
                  onClick={() => up({ reason: r })}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="font-bold text-[11px] text-gray-700 mb-2">Payment will come from</div>
            <div className="inline-flex border border-gray-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              <button
                className={`px-4 py-2 text-[11px] transition font-bold ${b.payerSame !== false ? "text-[#635BFF] bg-indigo-50" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50 cursor-pointer"}`}
                onClick={() => up({ payerSame: true })}
              >
                The billing party
              </button>
              <div className="w-px bg-gray-200" />
              <button
                className={`px-4 py-2 text-[11px] transition font-bold ${b.payerSame === false ? "text-[#635BFF] bg-indigo-50" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50 cursor-pointer"}`}
                onClick={() => up({ payerSame: false })}
              >
                Someone else
              </button>
            </div>
            {b.payerSame === false && (
              <input
                className="w-full max-w-sm block mt-2 border border-gray-200 rounded-xl px-3.5 py-2 text-xs bg-white focus:border-indigo-500 outline-none shadow-2xs transition"
                value={b.payer}
                placeholder="Name of the person or company paying"
                onChange={(ev) => up({ payer: ev.target.value })}
              />
            )}
          </div>

          <div>
            <div className="font-bold text-[11px] text-gray-700 mb-2">Design options for approval go to</div>
            <div className="inline-flex border border-gray-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              {["client", "billing_party", "both"].map((opt, i) => (
                <React.Fragment key={opt}>
                  {i > 0 && <div className="w-px bg-gray-200" />}
                  <button
                    className={`px-4 py-2 text-[11px] transition font-bold ${b.designApprover === opt ? "text-[#635BFF] bg-indigo-50" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50 cursor-pointer"}`}
                    onClick={() => up({ designApprover: opt })}
                  >
                    {opt === "client" ? (client?.name ? client.name.split(' ').slice(0, 2).join(' ') : 'Client') : opt === "billing_party" ? "Billing party" : "Both"}
                  </button>
                </React.Fragment>
              ))}
            </div>
            <div className="text-[10px] text-gray-400 mt-1.5">
              The final approved design is shared with both by default; you can change that when you send it.
            </div>
          </div>

          <div>
            <div className="font-bold text-[11px] text-gray-700 mb-2">Quotations go to</div>
            <div className="inline-flex border border-gray-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              {["billing_party", "client", "both"].map((opt, i) => (
                <React.Fragment key={opt}>
                  {i > 0 && <div className="w-px bg-gray-200" />}
                  <button
                    className={`px-4 py-2 text-[11px] transition font-bold ${b.quoteTo === opt ? "text-[#635BFF] bg-indigo-50" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50 cursor-pointer"}`}
                    onClick={() => up({ quoteTo: opt })}
                  >
                    {opt === "client" ? (client?.name ? client.name.split(' ').slice(0, 2).join(' ') : 'Client') : opt === "billing_party" ? "Billing party" : "Both"}
                  </button>
                </React.Fragment>
              ))}
            </div>
            <div className="text-[10px] text-gray-400 mt-1.5 leading-snug">
              Quotes are addressed to the {b.quoteTo === "client" ? "client" : "billing party"}, mentioning {client?.name || 'the client'} as the client.<br/>
              {(!b.contact.phone && !b.contact.email) && (
                <span className="text-amber-600 font-semibold block mt-0.5">Add the billing party&apos;s contact above so the quote has someone to go to.</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <span className="font-bold text-[11px] text-gray-700">Place of supply</span>
            <div className="flex items-center gap-2">
              <select
                className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs bg-white font-medium shadow-2xs outline-none focus:border-indigo-500 cursor-pointer"
                value={b.pos || pos.code}
                onChange={(ev) => up({ pos: ev.target.value })}
              >
                {Object.entries(STATES).map(([c, n]) => (
                  <option key={c} value={c}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="text-[10px] text-gray-400 leading-snug mt-1">
            Usually the billing party&apos;s GST state, or the delivery state for goods delivered there. RD is registered in Maharashtra (27).
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingParty;
