import React, { useState } from "react";
import { subJobsOf, liveSummary, lakh, inr, contactsOf } from "../utils/helpers";

const JobCard = ({ s, client, ids = {} }) => {
  const [open, setOpen] = useState(true);

  const id = ids.enq || (s?.seq ? `RD${s.seq}` : "RD21072");
  const subJobs = subJobsOf(s, id);

  const secOrder = ['Client', 'Enquiry', 'Product', 'Sub-Jobs', 'Order', 'Delivery'];
  const rows = [];

  // Build rows dynamically based on current wizard state `s` and `client`
  if (client) {
    rows.push({ sec: 'Client', l: 'Client', v: client.name, src: client.isNew ? 'typed' : 'picked' });
    if (client.gstin) {
      rows.push({ sec: 'Client', l: 'GSTIN', v: client.gstin, src: client.isNew ? 'typed' : 'auto' });
    }
    if (client.billing) {
      rows.push({ sec: 'Client', l: 'Billing', v: client.billing, src: 'auto' });
    }
    if (client.terms) {
      rows.push({ sec: 'Client', l: 'Terms', v: client.terms, src: 'auto' });
    }
    rows.push({ sec: 'Client', l: 'Outstanding', v: client.overdue ? `₹${client.overdue} overdue` : 'Clear', src: 'auto' });
    
    const L = liveSummary(client);
    const liveJobsText = L.count === 0 ? 'None' : `${L.count} · ${lakh(L.value)}${L.pending > 0 ? ` · ${inr(L.pending)} adv pending` : ''}`;
    rows.push({ sec: 'Client', l: 'Live jobs', v: liveJobsText, src: 'auto' });

    // Mock User role (same as LogStep)
    const currentUser = { name: "Admin", role: "admin" }; 
    const canAssign = currentUser.role === "admin" || currentUser.role === "cs_manager";
    if (canAssign && s.coordinator && String(s.coordinator).trim() && s.coordinator !== "Priya Nair") {
      rows.push({ sec: "Client", l: "Assigned to", v: s.coordinator, src: "picked" });
    }

    if (s.contactId) {
      const ct = contactsOf(client, s).find((x) => x.id === s.contactId);
      if (ct) {
        rows.push({ sec: 'Client', l: 'Client contact', v: `${ct.name}${ct.role ? ` · ${ct.role}` : ''}`, src: 'picked' });
      }
    }
  }

  const e = s?.e || {};

  // Enquiry section
  const openEnq = client?.openEnqNo || (client?.open > 0 ? 'ENQ/26/0398' : null);
  if (openEnq && !client?.isNew) {
    rows.push({ sec: 'Enquiry', l: 'Linked to', v: openEnq, src: 'auto' });
  }

  // Product section
  if (e.theme || s?.theme) {
    rows.push({ sec: 'Product', l: 'Product', v: e.theme || s.theme, src: 'typed' });
  }
  if (e.type) {
    rows.push({ sec: 'Product', l: 'Type', v: e.type, src: 'picked' });
  }
  if (e.size) {
    rows.push({ sec: 'Product', l: 'Size', v: `${e.size} in`, src: 'picked' });
  }
  // Materials: Show for all trophies
  if (e.trophyGroups && Array.isArray(e.trophyGroups) && e.trophyGroups.length > 1) {
    e.trophyGroups.forEach((group, gIdx) => {
      const gTheme = group.theme || `Trophy ${gIdx + 1}`;
      const gMat = (group.mats && group.mats.length > 1)
        ? `Fusion: ${group.mats.join(' + ')}`
        : (group.mat || (group.mats && group.mats[0]) || (gIdx === 0 ? e.mat : 'MDF'));
      rows.push({
        sec: 'Product',
        l: `Trophy ${gIdx + 1} Mat`,
        v: `${gTheme} · ${gMat}`,
        src: 'picked',
      });
    });
  } else if (e.mat) {
    rows.push({ sec: 'Product', l: 'Material', v: e.mat, src: 'picked' });
  }

  if (e.qty || s?.qty) {
    rows.push({ sec: 'Product', l: 'Item 1 qty', v: `${e.qty || s.qty} pcs`, src: 'picked' });
  }

  // Build All items list if trophyGroups exists
  if (e.trophyGroups && Array.isArray(e.trophyGroups)) {
    const allItems = [];
    let idxCounter = 1;
    e.trophyGroups.forEach((group, gIdx) => {
      const gTheme = group.theme || e.theme || "Crystal Wave Trophy";
      const gKind = group.kind || "custom";
      const gMat = (group.mats && group.mats.length > 1)
        ? `Fusion: ${group.mats.join(' + ')}`
        : (group.mat || (group.mats && group.mats[0]) || (gIdx === 0 ? e.mat : 'MDF'));
      const matPart = gMat ? ` · ${gMat}` : '';
      group.items.forEach((item) => {
        const sizeStr = item.size ? `${item.size} in, ` : '';
        const rateStr = item.budget ? ` @ ₹${item.budget.toLocaleString()}/pc` : '';
        allItems.push(`${idxCounter}. ${gTheme} (${sizeStr}${gKind}${matPart}, ${item.qty || 50} pcs${rateStr})`);
        idxCounter++;
      });
    });
    if (allItems.length > 0) {
      rows.push({ sec: 'Product', l: 'All items', v: allItems.join(' · '), src: 'auto' });
    }
  }

  rows.push({ sec: 'Product', l: 'BOM', v: 'BOM v3 · frozen', src: 'auto' });
  if (client?.lastRate || e.budget) {
    rows.push({ sec: 'Product', l: 'Rate', v: `₹${(client?.lastRate || 1450).toLocaleString()}/pc (last quote)`, src: 'auto' });
  }

  // Add Sub-Jobs to Ticket rows
  if (subJobs.length > 0) {
    subJobs.forEach((sj) => {
      const apprTag = sj.approvedDesign ? ` (Approved: Option ${sj.approvedDesign.choice || sj.approvedDesign})` : '';
      const matTag = sj.mat ? ` · ${sj.mat}` : '';
      rows.push({
        sec: 'Sub-Jobs',
        l: sj.subJobNo,
        v: `${sj.theme} ${sj.size}"${matTag} (${sj.qty} pcs)${apprTag}`,
        src: 'auto',
      });
    });
  } else if (s?.qty || e.qty) {
    rows.push({ sec: 'Enquiry', l: 'Qty', v: `${s.qty || e.qty} pcs`, src: 'picked' });
  }

  if (e.origin) {
    rows.push({ sec: 'Enquiry', l: 'Channel', v: e.origin, src: 'picked' });
  }
  if (e.designer) {
    rows.push({ sec: 'Enquiry', l: 'Design brief', v: `${e.options || 2} options per sub-job`, src: 'picked' });
  }
  if (s?.mode) {
    rows.push({ sec: 'Order', l: 'Fulfillment', v: s.mode === 'production' ? 'Straight to Production' : 'Sample first', src: 'picked' });
  }
  if (s?.leadDate) {
    rows.push({ sec: 'Delivery', l: 'Target date', v: s.leadDate, src: 'picked' });
  }

  // Count field sources
  const counts = {
    auto: rows.filter(r => r.src === 'auto').length,
    picked: rows.filter(r => r.src === 'picked').length,
    typed: rows.filter(r => r.src === 'typed').length
  };
  const total = counts.auto + counts.picked + counts.typed || 1;

  // Compute status stamp
  let stamp = null;
  if (s?.released) stamp = ['Released', 'to hub'];
  else if (s?.approved) stamp = ['Approved', 'by client'];
  else if (s?.sent) stamp = ['Sent', 'to shop floor'];
  else if (s?.mode === 'production') stamp = ['Order', 'Production'];
  else if (s?.mode === 'sample') stamp = ['Order', 'Sample'];
  else if (s?.enqSent) stamp = ['Logged', 'with Design'];
  else if (client) stamp = ['Drafting', 'in progress'];

  // Current stage label
  let stageLabel = "📝 Enquiry · 1 of 8";
  if (s?.released) stageLabel = "🏭 Production · 5 of 8";
  else if (s?.approved) stageLabel = "📦 Order · 4 of 8";
  else if (s?.sent && s?.mode === 'sample') stageLabel = "🧪 Sample · 2 of 8";
  else if (s?.enqSent) stageLabel = "📋 Won / Logged · 3 of 8";

  return (
    <div className="tixwrap">
      <div className={`tix ${open ? '' : 'collapsed'}`}>
        {stamp && (
          <div className="stamp" key={stamp.join()}>
            {stamp[0]}
            <small>{stamp[1]}</small>
          </div>
        )}
        <div className="tixhead" style={{ background: "var(--indigo)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
            <span className="k" style={{ fontSize: "12px", opacity: 0.85 }}>Job card</span>
            <span
              style={{
                background: "rgba(255, 255, 255, 0.2)",
                color: "#fff",
                padding: "2px 10px",
                borderRadius: "999px",
                fontSize: "11px",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: "4px"
              }}
            >
              {stageLabel}
            </span>
          </div>
          <div className="id" style={{ fontSize: "26px", fontWeight: 800, letterSpacing: "-0.02em" }}>{id}</div>
          <div className="st" style={{ marginTop: "4px" }}>
            <span style={{ fontSize: "13px", opacity: 0.9 }}>{client ? client.name : 'No client yet'}</span>
            {e.origin && <span className="pill p-gold">{e.origin}</span>}
          </div>
        </div>

        <div className="perf">
          <i />
        </div>

        <div className="tixbody">
          {rows.length === 0 ? (
            <div className="tempty">
              Pick a client and this job card starts filling itself. It follows the job from enquiry to production.
            </div>
          ) : (
            secOrder.map((sec) => {
              const secRows = rows.filter((x) => x.sec === sec);
              if (!secRows.length) return null;
              return (
                <div key={sec}>
                  <div className="tsec">{sec}</div>
                  {secRows.map((x, idx) => (
                    <div className="trow" key={idx} style={{ alignItems: "flex-start" }}>
                      <i className={`d d-${x.src}`} title={x.src} style={{ marginTop: "6px" }} />
                      <span className="l" style={{ paddingTop: "2px" }}>{x.l}</span>
                      <span className="v" style={{ paddingTop: "2px" }}>{x.v}</span>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>

        <button 
          className="linkbtn" 
          style={{ padding: '8px 20px', width: '100%', textAlign: 'center', borderTop: '1px solid var(--line)' }} 
          onClick={() => setOpen(!open)}
        >
          {open ? 'Hide details ▲' : `Show details (${rows.length}) ▼`}
        </button>

        <div className="tixfoot">
          <div className="score">
            <div className="big">{counts.auto + counts.picked}</div>
            <div className="cap">
              auto-filled or carried over<br />
              {counts.picked} picked · {counts.typed} typed
            </div>
          </div>

          <div className="bar" aria-hidden="true">
            <i style={{ width: `${(counts.auto / total) * 100}%`, background: 'var(--gold)' }} />
            <i style={{ width: `${(counts.picked / total) * 100}%`, background: 'var(--indigo)' }} />
            <i style={{ width: `${(counts.typed / total) * 100}%`, background: 'var(--coral)' }} />
          </div>

          <div className="legend">
            <span><i style={{ background: 'var(--gold)' }} />Auto / carried</span>
            <span><i style={{ background: 'var(--indigo)' }} />Picked</span>
            <span><i style={{ background: 'var(--coral)' }} />Typed</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobCard;
