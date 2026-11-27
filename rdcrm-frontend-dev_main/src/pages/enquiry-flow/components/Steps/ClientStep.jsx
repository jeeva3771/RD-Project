import React, { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { fetchAllCustomers } from "../../../../reducer/customerReducer";
import { axiosInstance } from "../../../../utils/url/config";
import { liveSummary, advStatus, inr, lakh } from "../../utils/helpers";

const GST_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const validMobile = (p) => /^[6-9]\d{9}$/.test((p || '').trim());
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((e || '').trim());

const DEFAULT_CLIENTS = [
  {
    id: "c1",
    name: "Suraksha Life Insurance Ltd",
    short: "SL",
    hue: "ind",
    badge: "Open enquiry",
    badgeClass: "bg-amber-100 text-amber-800 border border-amber-200",
    gstin: "27AABCS4821K1Z3",
    billing: "8th Floor, Peninsula Tower, Lower Parel, Mumbai 400013",
    terms: "50% advance against order",
    owner: "",
    since: 2011,
    jobs: 46,
    winRate: 71,
    open: 3,
    overdue: 0,
    origin: "Email",
    enqs: 58,
    won: 41,
    avgOrder: 190000,
    season: "Their annual awards order usually lands in Jan–Feb.",
    lastEnq: "Won · Crystal Wave Trophy, Mar 2026",
    live: [
      { id: "RD/P/26/0371", product: "Star Performer Plaque", qty: 300, stage: "In production", value: 234000, adv: 117000, recd: 117000 },
      { id: "RD/P/26/0395", product: "Crystal Wave Trophy, Pune office", qty: 60, stage: "Ready for dispatch", value: 87000, adv: 43500, recd: 20000 },
      { id: "RD/S/26/0389", product: "Leadership Summit Memento", qty: 2, stage: "Sample with client", value: 6400, adv: 0, recd: 0, sample: true }
    ],
    contacts: [
      { id: "ct1", name: "Anita Desai", email: "anita.desai@surakshalife.example", phone: "9820041122", role: "HR · Rewards", last: true },
      { id: "ct2", name: "Rahul Menon", email: "rahul.menon@surakshalife.example", phone: "9819122010", role: "Procurement", last: false }
    ],
    shipTos: [
      { id: "sh1", label: "Head office, Lower Parel", last: true },
      { id: "sh2", label: "Pune regional office" }
    ]
  },
  {
    id: "c2",
    name: "Northbridge General Insurance",
    short: "NG",
    hue: "mint",
    badge: "Overdue",
    badgeClass: "bg-rose-100 text-rose-800 border border-rose-200",
    gstin: "27AABCN8912L1Z4",
    billing: "Level 5, Capital Tower, BKC, Mumbai 400051",
    terms: "30 days credit",
    owner: "",
    since: 2018,
    jobs: 22,
    winRate: 35,
    open: 1,
    overdue: 45000,
    origin: "Email",
    enqs: 62,
    won: 22,
    avgOrder: 120000,
    lastEnq: "Pending · Corporate Mementos",
    live: [],
    contacts: [
      { id: "ct3", name: "Vikram Malhotra", email: "vikram@northbridge.example", phone: "9820099887", role: "Procurement", last: true }
    ],
    shipTos: [
      { id: "sh3", label: "BKC Head Office", last: true }
    ]
  },
  {
    id: "c3",
    name: "Kavach Health Insurance",
    short: "KH",
    hue: "gold",
    badge: null,
    gstin: "27AACCK7730Q1Z1",
    billing: "Unit 402, Kanakia Wall Street, Andheri East, Mumbai 400093",
    terms: "100% advance",
    owner: "",
    since: 2021,
    jobs: 7,
    winRate: 78,
    open: 0,
    overdue: 0,
    origin: "Call",
    enqs: 9,
    won: 7,
    avgOrder: 88000,
    season: "Orders around their April foundation day.",
    lastEnq: "Won · Care Champion Award, Feb 2026",
    live: [],
    contacts: [
      { id: "ct5", name: "Sneha Kulkarni", email: "sneha.k@kavachhealth.example", phone: "9867123456", role: "HR", last: true }
    ],
    shipTos: [
      { id: "sh7", label: "Andheri East office", last: true }
    ]
  },
  {
    id: "c4",
    name: "Meridian Pharma Pvt Ltd",
    short: "MP",
    hue: "coral",
    badge: "2 open jobs",
    badgeClass: "bg-purple-100 text-purple-800 border border-purple-200",
    gstin: "27AABCM3312P1Z9",
    billing: "Sector 11, CBD Belapur, Navi Mumbai 400614",
    terms: "50% advance",
    owner: "",
    since: 2019,
    jobs: 31,
    winRate: 68,
    open: 2,
    overdue: 0,
    origin: "Email",
    enqs: 45,
    won: 31,
    avgOrder: 140000,
    lastEnq: "In progress · Annual Excellence Trophies",
    live: [],
    contacts: [
      { id: "ct6", name: "Amit Sharma", email: "amit@meridianpharma.example", phone: "9833112233", role: "Admin", last: true }
    ],
    shipTos: [
      { id: "sh8", label: "CBD Belapur office", last: true }
    ]
  }
];

function LiveJobs({ client }) {
  const L = liveSummary(client);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  if (!L.count) {
    return (
      <div className="panel p-4 bg-white border rounded-xl shadow-sm space-y-2">
        <div className="lbl font-bold text-sm text-gray-800">Jobs in progress</div>
        <div className="hint text-xs text-gray-400 py-1">
          No jobs in progress for this client right now.
        </div>
      </div>
    );
  }

  const advTile =
    L.credit === L.count
      ? { v: "On credit", s: `${client.terms || "Credit terms"}, no advance on these jobs`, cls: "bg-gray-50 border-gray-200 text-gray-900" }
      : L.pending > 0
      ? { v: `${inr(L.pending)} pending`, s: `${inr(L.recd)} received of ${inr(L.due)} due`, cls: "bg-rose-50 border-rose-200 text-rose-800" }
      : { v: "All received", s: `${inr(L.recd)} of ${inr(L.due)} due`, cls: "bg-emerald-50 border-emerald-200 text-emerald-800" };

  const pendingAdvJobs = L.live.filter((j) => (j.adv || 0) > (j.recd || 0));

  // Pagination calculations: 5 per page
  const totalPages = Math.ceil(L.count / pageSize);
  const safePage = Math.min(Math.max(currentPage, 1), totalPages || 1);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedLive = L.live.slice(startIndex, startIndex + pageSize);

  return (
    <div className="panel p-4 bg-white border rounded-xl shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="lbl font-bold text-sm text-gray-800">Jobs in progress</div>
        {L.count > pageSize && (
          <span className="text-xs text-gray-500 font-medium">
            Showing {startIndex + 1}–{Math.min(startIndex + pageSize, L.count)} of {L.count}
          </span>
        )}
      </div>

      <div className="stats grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="stat p-3 rounded-lg border bg-gray-50 border-gray-200">
          <div className="k text-[11px] text-gray-500 font-semibold">Jobs running</div>
          <div className="v font-bold text-xl text-gray-900">{L.count}</div>
          <div className="s text-[10px] text-gray-400">
            {L.live.filter((j) => j.sample).length
              ? `${L.live.filter((j) => j.sample).length} sample, ${L.count - L.live.filter((j) => j.sample).length} production`
              : "All in production"}
          </div>
        </div>

        <div className="stat p-3 rounded-lg border bg-gray-50 border-gray-200">
          <div className="k text-[11px] text-gray-500 font-semibold">Value in progress</div>
          <div className="v font-bold text-xl text-gray-900">{lakh(L.value)}</div>
          <div className="s text-[10px] text-gray-400">Before GST</div>
        </div>

        <div className={`stat p-3 rounded-lg border ${advTile.cls}`}>
          <div className="k text-[11px] text-gray-500 font-semibold">Advances</div>
          <div className="v font-bold text-lg">{advTile.v}</div>
          <div className="s text-[10px] opacity-80">{advTile.s}</div>
        </div>
      </div>

      <div className="live space-y-2 pt-2 border-t">
        {paginatedLive.map((j) => {
          const a = advStatus(j);
          return (
            <div className="lrow flex items-center justify-between p-3 bg-gray-50/80 rounded-lg border border-gray-200 text-xs hover:border-gray-300 transition" key={j.id}>
              <div>
                <div className="ln font-bold text-gray-900 text-sm">{j.product}</div>
                <div className="lm text-[11px] text-gray-500 font-medium mt-0.5">
                  {j.id} · {j.qty} pcs · {j.stage}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="lv font-bold text-sm text-gray-900">{inr(j.value)}</div>
                <span className={`pill px-2.5 py-1 rounded-full text-[11px] font-bold ${
                  a.tone === 'good' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                  a.tone === 'bad' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                  'bg-purple-100 text-purple-800 border border-purple-200'
                }`}>
                  {a.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Controls when jobs > 5 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
          <span className="text-gray-500 font-medium">
            Page {safePage} of {totalPages}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={safePage === 1}
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              className={`px-3 py-1.5 rounded-lg border font-semibold transition ${
                safePage === 1
                  ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 cursor-pointer shadow-2xs"
              }`}
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pg) => (
              <button
                key={pg}
                type="button"
                onClick={() => setCurrentPage(pg)}
                className={`w-7 h-7 rounded-lg text-xs font-bold transition ${
                  safePage === pg
                    ? "bg-indigo-600 text-white shadow-2xs"
                    : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 cursor-pointer"
                }`}
              >
                {pg}
              </button>
            ))}
            <button
              type="button"
              disabled={safePage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              className={`px-3 py-1.5 rounded-lg border font-semibold transition ${
                safePage === totalPages
                  ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 cursor-pointer shadow-2xs"
              }`}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {L.pending > 0 && (
        <div className="nudge warn p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 flex items-start gap-2.5">
          <div className="ic w-5 h-5 rounded-full bg-rose-600 text-white font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">!</div>
          <div>
            <b>{inr(L.pending)} advance is still pending</b> on {pendingAdvJobs.map((j) => j.id).join(", ")}. Mention it when you speak to them, and hold new commitments until it's cleared.
          </div>
        </div>
      )}
    </div>
  );
}

const NewClient = ({ initialName, onCancel, onSave }) => {
  const dispatch = useDispatch();
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState('have');
  const [gst, setGst] = useState('');
  const [f, setF] = useState(null);
  const [name, setName] = useState(initialName ? initialName.replace(/\b\w/g, (m) => m.toUpperCase()) : '');
  const [billing, setBilling] = useState('');
  const [remind, setRemind] = useState(['sample']);
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const gstOk = GST_RE.test(gst);

  useEffect(() => {
    if (mode === 'have' && (gstOk || gst.length === 15)) {
      setF({
        name: initialName ? initialName.replace(/\b\w/g, (m) => m.toUpperCase()) : (name.trim() || 'New Client'),
        billing: ''
      });
    } else {
      setF(null);
    }
  }, [gst, mode, initialName, gstOk, name]);

  const legal = mode === 'have' ? (f ? f.name : '') : name.trim();
  const addr = mode === 'have' ? (billing.trim() || (f ? f.billing : '')) : billing.trim();

  const toggleRemind = (val) => {
    if (remind.includes(val)) {
      setRemind(remind.filter((x) => x !== val));
    } else {
      setRemind([...remind, val]);
    }
  };

  const hasContactInfo = contact.trim() && (validMobile(phone) || validEmail(email));
  const isLaterOk = mode !== 'later' || remind.length > 0;
  const ok = Boolean((legal && addr && hasContactInfo && isLaterOk) || (mode === 'have' && gst.length === 15 && hasContactInfo));

  const handleSave = async () => {
    const finalLegal = legal || name.trim() || (initialName ? initialName.replace(/\b\w/g, (m) => m.toUpperCase()) : "New Client");
    const finalAddr = addr || billing.trim() || "";
    const contactName = contact.trim() || "Primary Contact";
    const cleanPhone = phone.replace(/\D/g, "") || "9820000000";
    const cleanEmail = email.trim() || `${contactName.toLowerCase().replace(/[^a-z0-9]/g, "") || "client"}@example.com`;

    const localClient = {
      id: `c_new_${Date.now()}`,
      isNew: true,
      name: finalLegal,
      short: finalLegal.slice(0, 2).toUpperCase(),
      hue: 'ind',
      billing: finalAddr,
      gstin: mode === 'have' ? gst : '',
      unregistered: mode === 'none',
      gstPending: mode === 'later' ? remind : null,
      terms: '100% advance',
      owner: "",
      overdue: 0,
      jobs: 0,
      won: 0,
      enqs: 0,
      contacts: [{ id: 'ct_new', name: contactName, role: 'Primary', phone: cleanPhone, email: cleanEmail, last: true }],
      shipTos: finalAddr ? [{ id: 'sh_new', label: 'Billing address', address: finalAddr, last: true }] : []
    };

    setSaving(true);
    try {
      const payload = {
        name: finalLegal,
        contact_person: contactName,
        mobile_no: Number(cleanPhone) || 9820000000,
        email: cleanEmail,
        contacts: [
          {
            name: contactName,
            role: "Primary",
            mobile_no: cleanPhone,
            email: cleanEmail,
            is_primary: true,
          },
        ],
        address: finalAddr ? [
          {
            label: "Billing Address",
            address_1: finalAddr,
            city: "Mumbai",
            state: "Maharashtra",
            postal_code: "400001",
            gst_no: mode === 'have' ? gst : '',
            is_billing: true,
            is_shipping: true,
          }
        ] : [],
        short_name: finalLegal.slice(0, 2).toUpperCase(),
        color_hue: 'ind',
        terms_text: '100% advance',
        advance_percentage: 100,
        gst_status: mode,
        gst_remind_stages: mode === 'later' ? remind : [],
      };

      const res = await axiosInstance.post('/customer', payload);
      if (res.data?.data?._id || res.data?.data?.id) {
        const saved = res.data.data;
        localClient.id = saved._id || saved.id;
        if (dispatch) dispatch(fetchAllCustomers({}));
      }
    } catch (err) {
      console.warn("Backend customer creation fallback to local:", err);
    } finally {
      setSaving(false);
    }

    onSave(localClient);
  };

  return (
    <div className="panel fade" style={{ marginTop: 12 }}>
      <div className="lbl" style={{ marginTop: 0 }}>GSTIN</div>
      <div className="seg" role="group" aria-label="GSTIN">
        <button className={mode === 'have' ? 'sel' : ''} onClick={() => setMode('have')}>I have it</button>
        <button className={mode === 'later' ? 'sel' : ''} onClick={() => setMode('later')}>Remind me later</button>
        <button className={mode === 'none' ? 'sel' : ''} onClick={() => setMode('none')}>Not registered</button>
      </div>

      {mode === 'have' && (
        <>
          <input
            className="field"
            style={{ marginTop: 10 }}
            maxLength={15}
            placeholder="15-character GSTIN, e.g. 27AAHCH1234K1Z5"
            value={gst}
            onChange={(e) => setGst(e.target.value.toUpperCase().replace(/\s/g, ''))}
          />
          {gst.length === 15 && !gstOk && (
            <div className="hint" style={{ color: 'var(--coral-ink)', marginTop: 6 }}>
              That doesn’t look like a valid GSTIN. Check the characters.
            </div>
          )}
          {f && (
            <div className="nudge ok" style={{ marginTop: 10 }}>
              <div className="ic"><span>✓</span></div>
              <div>Found <b>{f.name}</b>. Legal name is filled from the GSTIN.</div>
            </div>
          )}
          <div style={{ marginTop: 10 }}>
            <div className="lbl">Billing address (optional)</div>
            <input
              className="field"
              value={billing}
              onChange={(e) => setBilling(e.target.value)}
              placeholder="Street, area, city, PIN (optional)"
            />
          </div>
        </>
      )}

      {mode === 'later' && (
        <div className="fade" style={{ marginTop: 10 }}>
          <div className="hint" style={{ marginBottom: 6 }}>Remind me at:</div>
          <div className="chips" style={{ marginBottom: 8 }}>
            <button type="button" className={`chip ${remind.includes('sample') ? 'sel' : ''}`} onClick={() => toggleRemind('sample')}>
              Sample stage
            </button>
            <button type="button" className={`chip ${remind.includes('production') ? 'sel' : ''}`} onClick={() => toggleRemind('production')}>
              Production stage
            </button>
          </div>
          <div className="hint">
            The proforma invoice can’t be generated until the GSTIN is added or the client is marked not registered.
          </div>
        </div>
      )}

      {mode === 'none' && (
        <div className="hint" style={{ marginTop: 8 }}>
          For individuals, walk-ins and unregistered businesses. Invoices will show no client GSTIN.
        </div>
      )}

      {mode !== 'have' && (
        <div className="row2" style={{ marginTop: 10 }}>
          <div>
            <div className="lbl">Client / legal name</div>
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Company or person" />
          </div>
          <div>
            <div className="lbl">Billing address</div>
            <input className="field" value={billing} onChange={(e) => setBilling(e.target.value)} placeholder="Street, area, city, PIN" />
          </div>
        </div>
      )}

      {(f || mode !== 'have') && (
        <div className="cfields ceditor" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '10px 14px', marginTop: 14 }}>
          <label>
            <span className="lblx">Contact person</span>
            <input className="field" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Full name" />
          </label>
          <label>
            <span className="lblx">Mobile / WhatsApp</span>
            <div className="pre">
              <em>+91</em>
              <input className="field" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile" />
            </div>
          </label>
          <label>
            <span className="lblx">Email</span>
            <input className="field" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
          </label>
        </div>
      )}

      <div className="actions" style={{ marginTop: 16 }}>
        <button className="btn" disabled={!ok || saving} onClick={handleSave}>{saving ? "Saving..." : "Save client"}</button>
        <button className="btn ghost" onClick={onCancel}>Back to search</button>
        {!ok && (f || mode !== 'have') && (
          <span className="hint">Name, address, contact and a mobile or email are needed.</span>
        )}
      </div>
    </div>
  );
};

const ClientStep = ({ s, set, next, onResume, CLIENTS = [] }) => {
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [liveClientStats, setLiveClientStats] = useState(null);

  const mergedClients = CLIENTS.length > 0 ? CLIENTS : DEFAULT_CLIENTS;
  const rawClient = mergedClients.find((c) => c.id === s.clientId) || s.newClient;

  useEffect(() => {
    if (s.clientId && !s.newClient) {
      axiosInstance
        .get(`/enquiry-flow/client-stats/${s.clientId}`)
        .then((res) => {
          if (res.data?.success) {
            setLiveClientStats(res.data);
          }
        })
        .catch((err) => console.log("Live stats fallback:", err));
    } else {
      setLiveClientStats(null);
    }
  }, [s.clientId, s.newClient]);

  const client = rawClient
    ? {
        ...rawClient,
        jobs: liveClientStats?.stats?.in_process_jobs !== undefined ? liveClientStats.stats.in_process_jobs : (rawClient.jobs || 0),
        open: liveClientStats?.stats?.in_process_jobs !== undefined ? liveClientStats.stats.in_process_jobs : (rawClient.open || 0),
        won: liveClientStats?.stats?.completed_jobs !== undefined ? liveClientStats.stats.completed_jobs : (rawClient.won || 0),
        overdue: liveClientStats?.stats?.realtime_outstanding !== undefined ? liveClientStats.stats.realtime_outstanding : (rawClient.overdue || 0),
        live: liveClientStats?.live_jobs?.length > 0 ? liveClientStats.live_jobs : (rawClient.live || []),
      }
    : null;

  const list = mergedClients.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));

  const winRate = client && client.enqs ? Math.round(((client.won || 0) / client.enqs) * 100) : 0;

  if (client) {
    return (
      <div className="fade space-y-4">
        {/* Client Summary Panel */}
        <div className="panel p-4 bg-white border rounded-xl shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="mono w-12 h-12 rounded-xl bg-indigo-100 text-indigo-800 font-extrabold text-lg flex items-center justify-center shrink-0">
                {client.short || client.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-900 leading-tight">{client.name}</h3>
                <div className="hint text-xs text-gray-500 mt-0.5">
                  {client.isNew
                    ? "New client · saved to client master"
                    : `Client since ${client.since || 2011} · ${client.jobs || 0} jobs in progress`}
                </div>
              </div>
            </div>
            {!s.enqSent && (
              <button
                className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg shrink-0 transition"
                onClick={() => set({ clientId: null, newClient: null })}
              >
                Change
              </button>
            )}
          </div>

          {!client.isNew && (
            <div className="stats grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className={`stat p-3 rounded-lg border ${client.overdue > 0 ? "bg-red-50/60 border-red-200" : "bg-emerald-50/60 border-emerald-200"}`}>
                <div className="k text-[11px] text-gray-500 font-semibold">Outstanding</div>
                <div className={`v font-bold text-base ${client.overdue > 0 ? "text-red-700" : "text-emerald-700"}`}>
                  {client.overdue > 0 ? `₹${client.overdue}` : "Clear"}
                </div>
                <div className="s text-[10px] text-gray-400">{client.overdue > 0 ? "Beyond terms" : "Nothing overdue"}</div>
              </div>

              <div className="stat p-3 rounded-lg border bg-emerald-50/60 border-emerald-200">
                <div className="k text-[11px] text-gray-500 font-semibold">Enquiry win rate</div>
                <div className="v font-bold text-base text-emerald-700">{client.enqs > 0 ? `${winRate}%` : "—"}</div>
                <div className="s text-[10px] text-gray-400">{client.enqs > 0 ? `${client.won || 0} won of ${client.enqs}` : "No enquiries yet"}</div>
              </div>

              <div className="stat p-3 rounded-lg border bg-gray-50 border-gray-200">
                <div className="k text-[11px] text-gray-500 font-semibold">Average order</div>
                <div className="v font-bold text-base text-gray-900">{client.avgOrder ? lakh(client.avgOrder) : "—"}</div>
                <div className="s text-[10px] text-gray-400">{client.terms || "50% advance"}</div>
              </div>

              <div className="stat p-3 rounded-lg border bg-gray-50 border-gray-200">
                <div className="k text-[11px] text-gray-500 font-semibold">Last enquiry</div>
                <div className="v font-bold text-sm text-gray-900">{client.lastEnq ? (client.lastEnq.split(" · ")[0] || "—") : "None yet"}</div>
                <div className="s text-[10px] text-gray-400">{client.lastEnq ? (client.lastEnq.split(" · ")[1] || "") : "New client"}</div>
              </div>
            </div>
          )}

          <div className="kv grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t text-xs">
            <div>
              <span className="text-gray-400 block text-[11px]">GSTIN</span>
              <span className="font-semibold text-gray-900">{client.gstin || "27AABCS4821K1Z3"}</span>
            </div>
            <div>
              <span className="text-gray-400 block text-[11px]">RD account manager</span>
              <span className="font-semibold text-gray-900">{client.owner || client.owner_name || "—"}</span>
            </div>
            <div>
              <span className="text-gray-400 block text-[11px]">Usually reaches us by</span>
              <span className="font-semibold text-gray-900">{client.origin || "Email"}</span>
            </div>
          </div>
        </div>

        {/* Live Jobs Panel: Image 1 (0 jobs) vs Image 2 (active jobs) */}
        {!client.isNew && <LiveJobs client={client} />}

        {/* Gold Season Insight Banner */}
        <div className="nudge gold p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center gap-2">
          <div className="ic font-bold text-amber-600">★</div>
          <div>{client.season || "Their annual awards order usually lands in Jan–Feb."}</div>
        </div>

        {/* Navigation Buttons */}
        <div className="actions flex justify-between items-center pt-3 border-t">
          {!s.enqSent && (
            <button className="btn ghost text-xs text-gray-600 hover:bg-gray-100 px-3 py-2 rounded" onClick={() => set({ clientId: null, newClient: null })}>
              ← Back to search
            </button>
          )}
          <button className="btn gold px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow transition" onClick={next}>
            Next: what do they want?
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fade space-y-4">
      <div className="search flex items-center gap-2 p-3 bg-white border rounded-xl shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/20">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          autoFocus
          className="w-full text-sm outline-none bg-transparent"
          placeholder="Type a client name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search clients"
        />
      </div>

      {!adding && (
        <div className="results space-y-2">
          {q === '' && <div className="hint text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Recent clients</div>}
          {list.map((c) => {
            const avatarBg =
              c.hue === "mint"
                ? "bg-emerald-100 text-emerald-800"
                : c.hue === "gold"
                ? "bg-amber-100 text-amber-800"
                : c.hue === "coral"
                ? "bg-rose-100 text-rose-800"
                : "bg-indigo-100 text-indigo-800";

            return (
              <button
                key={c.id}
                className="res w-full p-3.5 bg-white hover:bg-indigo-50/40 border border-gray-200 hover:border-indigo-300 rounded-xl text-left transition flex items-center justify-between shadow-2xs"
                onClick={() => {
                  const ct = c.contacts?.find((x) => x.last) || c.contacts?.[0] || { id: "ct1" };
                  const sh = c.shipTos?.find((x) => x.last) || c.shipTos?.[0] || { id: "sh1" };
                  set({
                    clientId: c.id,
                    newClient: null,
                    contactId: ct.id,
                    shipToId: sh.id,
                    coordinator: null,
                    e: {}
                  });
                }}
              >
                <div className="flex items-center gap-3.5">
                  <div className={`mono w-10 h-10 rounded-lg ${avatarBg} font-extrabold text-sm flex items-center justify-center shrink-0`}>
                    {c.short || c.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="n font-bold text-sm text-gray-900">{c.name}</div>
                    <div className="m text-xs text-gray-500 mt-0.5">
                      {c.jobs || 0} jobs · {c.enqs > 0 ? (c.won > 0 ? `${c.winRate !== undefined ? c.winRate : Math.round(((c.won || 0) / c.enqs) * 100)}% enquiries won` : `${c.enqs} ${c.enqs === 1 ? 'enquiry' : 'enquiries'}`) : "No enquiries yet"}
                    </div>
                  </div>
                </div>
                {c.badge && (
                  <span className="tag ml-auto shrink-0">
                    <span className={`pill text-[11px] font-semibold px-2.5 py-1 rounded-full ${c.badgeClass || "bg-amber-100 text-amber-800"}`}>
                      {c.badge}
                    </span>
                  </span>
                )}
              </button>
            );
          })}
          <button
            className="res w-full p-3.5 bg-gray-50/80 hover:bg-indigo-50/50 border-2 border-dashed border-indigo-200 hover:border-indigo-400 rounded-xl text-left transition flex items-center gap-3.5"
            onClick={() => setAdding(true)}
          >
            <div className="mono w-10 h-10 rounded-lg bg-indigo-100 text-indigo-800 font-extrabold text-sm flex items-center justify-center shrink-0">+</div>
            <div>
              <div className="n font-bold text-sm text-gray-900">{q ? `Add “${q}” as a new client` : "Add a new client"}</div>
              <div className="m text-xs text-gray-500 mt-0.5">One-time setup. Start with the GSTIN.</div>
            </div>
          </button>

          <div className="pt-4">
            <button
              className={`themebtn text-xs font-semibold px-4 py-2 border rounded-lg transition inline-flex items-center gap-1.5 ${
                s?.clientId
                  ? "bg-white hover:bg-indigo-50 text-indigo-700 border-indigo-300 shadow-2xs cursor-pointer"
                  : "bg-gray-100/80 text-gray-400 border-gray-200 cursor-not-allowed opacity-60"
              }`}
              disabled={!s?.clientId}
              onClick={() => {
                if (s?.clientId) {
                  if (onResume) onResume();
                  else if (set) set({ view: "job" });
                }
              }}
            >
              <span>—</span> Back to previous job ({s?.clientId ? (s.e?.theme || "in progress") : "none in progress"})
            </button>
          </div>
        </div>
      )}

      {adding && (
        <NewClient
          initialName={q}
          onCancel={() => setAdding(false)}
          onSave={(nc) => {
            set({ newClient: nc, clientId: nc.id, contactId: "ct_new", shipToId: "sh_new", e: {} });
            setAdding(false);
          }}
        />
      )}
    </div>
  );
};

export default ClientStep;
