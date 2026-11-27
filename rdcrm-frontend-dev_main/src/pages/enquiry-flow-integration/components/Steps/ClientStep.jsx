import React, { useState, useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import { toast } from "react-toastify";
import { fetchAllCustomers } from "../../../../reducer/customerReducer";
import { axiosInstance } from "../../../../utils/url/config";
import { liveSummary, advStatus, inr, lakh, mapCustomerToClientProfile } from "../../utils/helpers";
import { useLoader } from "../../../../context/LoaderContext";

const GST_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const validMobile = (p) => /^[6-9]\d{9}$/.test((p || '').trim());
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((e || '').trim());

const getPageNumbers = (current, total) => {
  const safeTotal = Math.max(1, total || 1);
  if (safeTotal <= 5) {
    return Array.from({ length: safeTotal }, (_, i) => i + 1);
  }
  const pages = [];
  if (current <= 3) {
    pages.push(1, 2, 3, 4, "...", safeTotal);
  } else if (current >= safeTotal - 2) {
    pages.push(1, "...", safeTotal - 3, safeTotal - 2, safeTotal - 1, safeTotal);
  } else {
    pages.push(1, "...", current - 1, current, current + 1, "...", safeTotal);
  }
  return pages;
};



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
                <span className={`pill px-2.5 py-1 rounded-full text-[11px] font-bold ${a.tone === 'good' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
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
              className={`px-3 py-1.5 rounded-lg border font-semibold transition ${safePage === 1
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
                className={`w-7 h-7 rounded-lg text-xs font-bold transition ${safePage === pg
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
              className={`px-3 py-1.5 rounded-lg border font-semibold transition ${safePage === totalPages
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
  const [name, setName] = useState(initialName ? initialName.replace(/\b\w/g, (m) => m.toUpperCase()) : '');
  const [billing, setBilling] = useState('');
  const [remind, setRemind] = useState(['sample']);
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const gstOk = GST_RE.test(gst);

  const toggleRemind = (val) => {
    if (remind.includes(val)) {
      setRemind(remind.filter((x) => x !== val));
    } else {
      setRemind([...remind, val]);
    }
  };

  const hasPhone = Boolean(phone.trim());
  const hasEmail = Boolean(email.trim());
  const isPhoneValid = !hasPhone || validMobile(phone);
  const isEmailValid = !hasEmail || validEmail(email);

  const isGstValid = mode !== 'have' || (gst.length === 15 && gstOk);
  const isLaterOk = mode !== 'later' || remind.length > 0;
  const ok = Boolean(name.trim().length > 0 && isGstValid && isLaterOk && isPhoneValid && isEmailValid);

  const handleSave = async () => {
    const finalLegal = name.trim();
    if (!finalLegal) {
      toast.error("Please enter client / company name");
      return;
    }

    const finalAddr = billing.trim();
    const contactName = contact.trim();
    const cleanPhone = phone.replace(/\D/g, "");
    const cleanEmail = email.trim();

    setSaving(true);
    try {
      const payload = {
        name: finalLegal,
        short_name: finalLegal.slice(0, 2).toUpperCase(),
        color_hue: 'ind',
        terms_text: '100% advance',
        advance_percentage: 100,
        gst_status: mode,
        gstin: mode === 'have' ? gst : '',
        gst_remind_stages: mode === 'later' ? remind : [],
        address: finalAddr ? [
          {
            label: "Billing Address",
            address_1: finalAddr,
            city: "",
            state: "",
            postal_code: "",
            gst_no: mode === 'have' ? gst : '',
            is_billing: true,
            is_shipping: true,
          }
        ] : [],
        contacts: contactName ? [
          {
            name: contactName,
            role: "Primary",
            mobile_no: cleanPhone || "",
            email: cleanEmail || "",
            is_primary: true,
          }
        ] : [],
        contact_person: contactName || "",
        mobile_no: cleanPhone ? (Number(cleanPhone) || null) : null,
        email: cleanEmail || "",
      };

      const res = await axiosInstance.post('/customer', payload);
      if (res.data?.data?._id || res.data?.data?.id) {
        const saved = res.data.data;
        const localClient = {
          id: saved._id || saved.id,
          _id: saved._id,
          isNew: true,
          name: saved.name || finalLegal,
          short: saved.short_name || finalLegal.slice(0, 2).toUpperCase(),
          hue: saved.color_hue || 'ind',
          billing: finalAddr,
          gstin: mode === 'have' ? gst : '',
          unregistered: mode === 'none',
          gstPending: mode === 'later' ? remind : null,
          terms: '100% advance',
          owner: saved.owner_name || "",
          overdue: 0,
          jobs: 0,
          won: 0,
          enqs: 0,
          contacts: contactName ? [{ id: 'ct1', name: contactName, role: 'Primary', phone: cleanPhone, email: cleanEmail, last: true }] : [],
          shipTos: finalAddr ? [{ id: 'sh1', label: 'Billing address', address: finalAddr, last: true }] : []
        };
        if (dispatch) dispatch(fetchAllCustomers({}));
        toast.success(`Client “${finalLegal}” saved to Customer Master!`);
        onSave(localClient);
      } else {
        toast.error("Failed to create client in Customer Master");
      }
    } catch (err) {
      console.error("Backend customer creation error:", err);
      toast.error(err.response?.data?.message || "Failed to create client in Customer Master");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="panel fade space-y-4" style={{ marginTop: 12 }}>
      <div>
        <div className="lbl" style={{ marginTop: 0 }}>Client / Company Name *</div>
        <input
          autoFocus
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Acme Corporation or Suraksha Life"
        />
      </div>

      <div>
        <div className="lbl">GSTIN</div>
        <div className="seg" role="group" aria-label="GSTIN">
          <button type="button" className={mode === 'have' ? 'sel' : ''} onClick={() => setMode('have')}>I have it</button>
          <button type="button" className={mode === 'later' ? 'sel' : ''} onClick={() => setMode('later')}>Remind me later</button>
          <button type="button" className={mode === 'none' ? 'sel' : ''} onClick={() => setMode('none')}>Not registered</button>
        </div>

        {mode === 'have' && (
          <div style={{ marginTop: 10 }}>
            <input
              className="field"
              maxLength={15}
              placeholder="15-character GSTIN, e.g. 27AAHCH1234K1Z5"
              value={gst}
              onChange={(e) => setGst(e.target.value.toUpperCase().replace(/\s/g, ''))}
            />
            {gst.length === 15 && !gstOk && (
              <div className="hint" style={{ color: 'var(--coral-ink)', marginTop: 6 }}>
                That doesn’t look like a valid GSTIN format. Check the characters.
              </div>
            )}
          </div>
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
              The proforma invoice can’t be generated until the GSTIN is added or marked not registered.
            </div>
          </div>
        )}

        {mode === 'none' && (
          <div className="hint" style={{ marginTop: 8 }}>
            For individuals, walk-ins and unregistered businesses. Invoices will show no client GSTIN.
          </div>
        )}
      </div>

      <div>
        <div className="lbl">Billing address (Optional)</div>
        <input
          className="field"
          value={billing}
          onChange={(e) => setBilling(e.target.value)}
          placeholder="Street, area, city, PIN (optional)"
        />
      </div>

      <div style={{ paddingTop: 10, borderTop: '1px dashed #e2e8f0' }}>
        <div className="lbl" style={{ marginBottom: 6 }}>Contact Person (Optional — can be added later)</div>
        <div className="cfields ceditor" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '10px 14px' }}>
          <label>
            <span className="lblx">Contact person</span>
            <input className="field" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Full name (optional)" />
          </label>
          <label>
            <span className="lblx">Mobile / WhatsApp</span>
            <div className="pre">
              <em>+91</em>
              <input className="field" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile (optional)" />
            </div>
            {hasPhone && !isPhoneValid && <small style={{ color: 'red', fontSize: '10px' }}>Needs 10 digits</small>}
          </label>
          <label>
            <span className="lblx">Email</span>
            <input className="field" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com (optional)" />
            {hasEmail && !isEmailValid && <small style={{ color: 'red', fontSize: '10px' }}>Invalid email format</small>}
          </label>
        </div>
      </div>

      <div className="actions" style={{ marginTop: 16 }}>
        <button className="btn" disabled={!ok || saving} onClick={handleSave}>{saving ? "Saving..." : "Save client"}</button>
        <button className="btn ghost" onClick={onCancel}>Back to search</button>
        {!ok && (
          <span className="hint">
            {!name.trim() ? "Client name is required." : (mode === 'have' && !gstOk ? "Valid 15-char GSTIN required." : "Check details above.")}
          </span>
        )}
      </div>
    </div>
  );
};

const ClientStep = ({ s, set, next, onResume, client: propClient }) => {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [liveClientStats, setLiveClientStats] = useState(null);
  const [fetchedClients, setFetchedClients] = useState([]);
  const [totalClients, setTotalClients] = useState(0);
  const [totalClientPages, setTotalClientPages] = useState(1);
  const [loadingClients, setLoadingClients] = useState(false);
  const [clientPage, setClientPage] = useState(1);
  const [clientPageSize, setClientPageSize] = useState(4);
  const [selectedClientObj, setSelectedClientObj] = useState(null);
  const lastFetchedCustQueryRef = useRef("");
  const standaloneStatsFetchedRef = useRef(null);
  const { showLoader, hideLoader } = useLoader();

  // Debounce search query to avoid hammering server on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQ(q);
      setClientPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  // Server-side fetch from /customer only when searching/browsing clients (skip when client already selected)
  useEffect(() => {
    if (s.clientId || s.newClient) return;
    const trimmedQ = (debouncedQ || "").trim();
    const queryKey = `${clientPage}|${clientPageSize}|${trimmedQ}`;
    if (lastFetchedCustQueryRef.current === queryKey) return;
    lastFetchedCustQueryRef.current = queryKey;

    let cancel = false;
    setLoadingClients(true);
    const isSearching = Boolean(trimmedQ);
    if (!isSearching) setFetchedClients([]); // Keep existing list while typing search
    if (!isSearching && showLoader) showLoader();
    axiosInstance
      .get("/customer", {
        params: {
          page: clientPage,
          limit: clientPageSize,
          search: trimmedQ || undefined,
          mode: "summary",
        },
      })
      .then((res) => {
        if (cancel) return;
        if (res.data?.data && Array.isArray(res.data.data)) {
          const mapped = res.data.data.map((c) => mapCustomerToClientProfile(c));
          setFetchedClients(mapped);
          setTotalClients(res.data.total ?? mapped.length);
          setTotalClientPages(res.data.totalPages ?? Math.ceil((res.data.total || mapped.length) / clientPageSize));
        }
      })
      .catch((err) => {
        if (!cancel) console.log("Server customer fetch error:", err);
      })
      .finally(() => {
        if (!cancel) {
          setLoadingClients(false);
          if (!isSearching && hideLoader) hideLoader();
        }
      });

    return () => {
      cancel = true;
      if (!isSearching && hideLoader) hideLoader();
    };
  }, [s.clientId, s.newClient, clientPage, clientPageSize, debouncedQ, showLoader, hideLoader]);

  // Ensure selected client is always preserved (prioritize parent propClient, fallback to fetchedClients cache)
  useEffect(() => {
    if (s.clientId && !s.newClient) {
      if (propClient && String(propClient.id) === String(s.clientId)) {
        setSelectedClientObj(propClient);
        return;
      }
      const existing = fetchedClients.find((c) => String(c.id) === String(s.clientId));
      if (existing) {
        setSelectedClientObj(existing);
      } else if (propClient === undefined && (!selectedClientObj || String(selectedClientObj.id) !== String(s.clientId))) {
        // Only fetch /customer in standalone mode when propClient is not provided by parent
        axiosInstance
          .get(`/customer/${s.clientId}`)
          .then((res) => {
            if (res.data?.data) {
              setSelectedClientObj(mapCustomerToClientProfile(res.data.data));
            }
          })
          .catch((err) => console.log("Error loading selected client details:", err));
      }
    } else {
      setSelectedClientObj(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.clientId, s.newClient, propClient, fetchedClients]);

  // Parent EnquiryFlow manages live stats whenever propClient is provided.
  // In standalone mode (propClient === undefined), fetch once and avoid duplicates.
  useEffect(() => {
    if (propClient !== undefined) {
      // Parent provides live stats inside propClient
      return;
    }
    if (s.clientId && !s.newClient) {
      const clientIdStr = String(s.clientId);
      if (standaloneStatsFetchedRef.current === clientIdStr) return;
      standaloneStatsFetchedRef.current = clientIdStr;
      axiosInstance
        .get(`/enquiry-flow-integration/client-stats/${s.clientId}`)
        .then((res) => {
          if (res.data?.success) {
            setLiveClientStats(res.data);
          }
        })
        .catch((err) => console.log("Live stats fallback:", err));
    } else {
      standaloneStatsFetchedRef.current = null;
      setLiveClientStats(null);
    }
  }, [s.clientId, s.newClient, propClient]);

  const rawClient = (s.clientId ? (selectedClientObj || propClient || fetchedClients.find((c) => String(c.id) === String(s.clientId))) : null) || s.newClient;

  const client = rawClient
    ? {
      ...rawClient,
      jobs: liveClientStats?.stats?.in_process_jobs !== undefined ? liveClientStats.stats.in_process_jobs : (rawClient.jobs || 0),
      open: liveClientStats?.stats?.in_process_jobs !== undefined ? liveClientStats.stats.in_process_jobs : (rawClient.open || 0),
      won: liveClientStats?.stats?.completed_jobs !== undefined ? liveClientStats.stats.completed_jobs : (rawClient.won || 0),
      overdue: liveClientStats?.stats?.realtime_outstanding !== undefined ? liveClientStats.stats.realtime_outstanding : (rawClient.overdue || 0),
      live: liveClientStats?.live_jobs?.length > 0 ? liveClientStats.live_jobs : (rawClient.live || []),
      pastOrders: liveClientStats?.past_orders?.length > 0 ? liveClientStats.past_orders : (rawClient.pastOrders || []),
    }
    : null;

  const startClientIndex = (clientPage - 1) * clientPageSize;
  const safeTotalClientPages = Math.max(1, totalClientPages || 1);
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
              <span className="font-semibold text-gray-900">{client.gstin || (client.unregistered ? "Not registered" : (client.gst_status === "later" ? "GST Pending" : "—"))}</span>
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
          {loadingClients && (
            <div className="p-3 text-center text-xs text-indigo-600 font-medium bg-indigo-50/50 rounded-xl border border-indigo-100 flex items-center justify-center gap-2">
              <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full" />
              <span>Loading clients...</span>
            </div>
          )}
          {!loadingClients && fetchedClients.length === 0 && (
            <div className="p-4 text-center text-xs text-gray-500 bg-gray-50/60 rounded-xl border border-gray-200">
              {q ? `No client found matching “${q}”. Add them below:` : "No clients found in database. Add a client below:"}
            </div>
          )}
          {!loadingClients && fetchedClients.map((c) => {
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
                  const ct = c.contacts?.find((x) => x.last) || c.contacts?.[0] || null;
                  const sh = c.shipTos?.find((x) => x.last) || c.shipTos?.[0] || null;
                  set({
                    clientId: c.id,
                    newClient: null,
                    contactId: ct ? (ct.id || "ct1") : null,
                    shipToId: sh ? (sh.id || "sh1") : null,
                    coordinator: null,
                    e: {
                      ...(s.e || {}),
                      contactPerson: ct?.name || (c.contact_person && c.contact_person !== "Primary Contact" ? c.contact_person : ""),
                      contactPhone: ct?.phone || (c.mobile_no ? String(c.mobile_no) : ""),
                      contactEmail: ct?.email || c.email || "",
                    }
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
                      {c.jobs || 0} {c.jobs === 1 ? 'job' : 'jobs'} · {c.enqs > 0 ? (c.won > 0 ? `${c.winRate !== undefined ? c.winRate : Math.round(((c.won || 0) / c.enqs) * 100)}% enquiries won` : `${c.enqs} ${c.enqs === 1 ? 'enquiry' : 'enquiries'}`) : "No enquiries yet"}
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

          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 py-2.5 px-3 bg-white border border-gray-200 rounded-xl shadow-2xs text-xs">
            <div className="flex items-center gap-2 text-gray-500">
              <span>Show</span>
              <select
                value={clientPageSize}
                onChange={(e) => {
                  setClientPageSize(Number(e.target.value));
                  setClientPage(1);
                }}
                className="border border-gray-300 rounded-lg text-xs py-1 px-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                {[4, 8, 12, 20].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <span>clients</span>
            </div>

            <span className="text-gray-500 font-medium text-center">
              Showing <b className="text-gray-900">{totalClients === 0 ? 0 : startClientIndex + 1}</b> to <b className="text-gray-900">{Math.min(startClientIndex + clientPageSize, totalClients)}</b> of <b className="text-gray-900">{totalClients}</b> clients
            </span>

            <div className="flex items-center gap-1.5 justify-end">
              <button
                type="button"
                disabled={clientPage <= 1 || loadingClients}
                onClick={() => setClientPage((p) => Math.max(p - 1, 1))}
                className={`px-3 py-1.5 rounded-lg border font-semibold transition ${clientPage <= 1 || loadingClients
                    ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 cursor-pointer shadow-2xs"
                  }`}
              >
                Previous
              </button>
              {getPageNumbers(clientPage, safeTotalClientPages).map((pg, idx) =>
                pg === "..." ? (
                  <span key={`el-cl-${idx}`} className="px-1 text-gray-400 font-bold">…</span>
                ) : (
                  <button
                    key={pg}
                    type="button"
                    disabled={loadingClients}
                    onClick={() => setClientPage(pg)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition ${clientPage === pg
                        ? "bg-indigo-600 text-white shadow-2xs"
                        : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 cursor-pointer"
                      }`}
                  >
                    {pg}
                  </button>
                )
              )}
              <button
                type="button"
                disabled={clientPage >= safeTotalClientPages || loadingClients}
                onClick={() => setClientPage((p) => Math.min(p + 1, safeTotalClientPages))}
                className={`px-3 py-1.5 rounded-lg border font-semibold transition ${clientPage >= safeTotalClientPages || loadingClients
                    ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 cursor-pointer shadow-2xs"
                  }`}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {adding && (
        <NewClient
          initialName={q}
          onCancel={() => setAdding(false)}
          onSave={(nc) => {
            const hasCt = Array.isArray(nc.contacts) && nc.contacts.length > 0;
            const ct = hasCt ? nc.contacts[0] : null;
            const hasSh = Array.isArray(nc.shipTos) && nc.shipTos.length > 0;
            const sh = hasSh ? nc.shipTos[0] : null;
            set({
              newClient: nc,
              clientId: nc.id,
              contactId: ct ? (ct.id || "ct1") : null,
              shipToId: sh ? (sh.id || "sh1") : null,
              e: {
                ...(s.e || {}),
                contactPerson: ct ? ct.name : "",
                contactPhone: ct ? ct.phone : "",
                contactEmail: ct ? ct.email : "",
              }
            });
            setAdding(false);
          }}
        />
      )}
    </div>
  );
};

export default ClientStep;
