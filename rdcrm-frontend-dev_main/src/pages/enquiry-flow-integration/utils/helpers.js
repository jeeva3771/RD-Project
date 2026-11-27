// Utility helpers for Enquiry Flow & Production Job Lifecycle (Integration)
import { ENQUIRY_CONFIG, formatEnquiryNo, getCurrentYearCode, parseEnquiryNo, deriveDocNo } from "./constants";

export { ENQUIRY_CONFIG, formatEnquiryNo, getCurrentYearCode, parseEnquiryNo, deriveDocNo };

export const RD_STATE = '27';
export const STATES = { '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat', '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa', '32': 'Kerala', '33': 'Tamil Nadu', '36': 'Telangana', '37': 'Andhra Pradesh' };
export const stateOf = (gstin) => { const c = String(gstin || '').slice(0, 2); return STATES[c] ? { code: c, name: STATES[c] } : null; };
export const GST_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const BILL_REASONS = ['Event agency', 'Parent / group company', 'Dealer or partner', 'Individual pays', 'Other'];

export const digits = (x) => String(x || '').replace(/\D/g, '');
export const validMobile = (x) => /^\d{10}$/.test(digits(x));
export const validEmail = (x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(x || '').trim());

/**
 * Safely format an address value into a human-readable string.
 * Handles strings, arrays of address objects, and individual address objects.
 * Prevents React child rendering errors when address objects are passed to JSX.
 *
 * @param {string|Object|Array} addr
 * @returns {string}
 */
export const formatAddress = (addr) => {
  if (!addr) return "";
  if (typeof addr === "string") return addr.trim();
  if (Array.isArray(addr)) {
    if (addr.length === 0) return "";
    for (const item of addr) {
      const formatted = formatAddress(item);
      if (formatted) return formatted;
    }
    return "";
  }
  if (typeof addr === "object") {
    if (typeof addr.address === "string" && addr.address.trim()) {
      return addr.address.trim();
    }
    if (typeof addr.full_address === "string" && addr.full_address.trim()) {
      return addr.full_address.trim();
    }
    const parts = [
      addr.address_1,
      addr.address_2,
      addr.city,
      addr.state,
      addr.postal_code || addr.pincode || addr.pin,
    ]
      .filter((p) => p !== undefined && p !== null && String(p).trim() !== "")
      .map((p) => String(p).trim());
    if (parts.length > 0) {
      return parts.join(", ");
    }
    if (typeof addr.label === "string" && addr.label.trim()) {
      return addr.label.trim();
    }
    return "";
  }
  return String(addr);
};

export const contactsOf = (client, s) => {
  if (!client) return [];
  const clientContacts = (client.contacts || []).map((c) => ({
    ...c,
    ...((s?.cEdits || {})[c.id] || {}),
  }));

  const extraContacts = (s?.cExtra || []).filter(
    (x) => x.clientId === (client.id || client._id)
  );

  const billToContact =
    s?.billTo && s.billTo.on && s.billTo.contact && s.billTo.contact.name
      ? [
          {
            id: 'billto',
            name: s.billTo.contact.name,
            role: `${s.billTo.name || 'Billing party'} · billing`,
            phone: s.billTo.contact.phone,
            email: s.billTo.contact.email,
            billing: true,
          },
        ]
      : [];

  const combined = [...clientContacts, ...extraContacts, ...billToContact];

  // Deduplicate by name (case-insensitive) to prevent multiple identical contact pills
  const seen = new Set();
  const deduped = [];
  for (const item of combined) {
    const key = (item.name || "").trim().toLowerCase();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
};

export const dfmt = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const fmt = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

export const todayISO = () => new Date().toISOString().slice(0, 10);
export const r10 = (x) => Math.round((x || 0) / 10) * 10;

export const inr = (val) => {
  if (val === null || val === undefined || isNaN(val)) return '₹0';
  return '₹' + Number(val).toLocaleString('en-IN');
};

export const lakh = (val) => {
  if (!val) return '₹0';
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(0)}k`;
  return `₹${val}`;
};

export const advStatus = (j) => {
  if (!j) return { label: "No advance needed", tone: "info" };
  if (j.sample || j.credit || j.adv === 0) {
    return { label: "No advance needed", tone: "info" };
  }
  const recd = j.recd || 0;
  const adv = j.adv || 0;
  if (recd >= adv) {
    return { label: "Advance received", tone: "good" };
  }
  const pending = adv - recd;
  if (recd > 0) {
    return { label: `Partial · ${inr(pending)} pending`, tone: "bad" };
  }
  return { label: `${inr(pending)} advance pending`, tone: "bad" };
};

export const liveSummary = (c) => {
  if (!c) return { live: [], count: 0, value: 0, due: 0, recd: 0, pending: 0, credit: 0 };
  const live = c.live || [];
  const value = live.reduce((a, j) => a + (j.value || 0), 0);
  const due = live.reduce((a, j) => a + (j.credit || j.sample ? 0 : j.adv || 0), 0);
  const recd = live.reduce((a, j) => a + (j.credit || j.sample ? 0 : j.recd || 0), 0);
  const credit = live.filter((j) => j.credit).length;
  return { live, count: live.length, value, due, recd, pending: due - recd, credit };
};

export const heatOf = (client, e = {}, est = null) => {
  if (!client) return null;
  let sc = 50;
  const r = [];
  if (client.jobs > 5) {
    sc += 15;
    r.push(['up', 'Repeat client']);
  } else if (client.isNew) {
    r.push(['', 'New client']);
  }
  if (client.enqs) {
    const w = Math.round((client.won / client.enqs) * 100);
    if (w >= 60) {
      sc += 10;
      r.push(['up', `${w}% enquiry win rate`]);
    } else if (w < 40) {
      sc -= 10;
      r.push(['down', `${w}% enquiry win rate`]);
    }
  }
  {
    const L = liveSummary(client);
    if (L.pending > 0) {
      sc -= 5;
      r.push(['down', `${lakh(L.pending)} advance pending`]);
    }
  }
  if (client.overdue > 0) {
    sc -= 15;
    r.push(['down', `${lakh(client.overdue)} overdue`]);
  }
  if (e.quoteOnly) {
    sc -= 20;
    r.push(['down', 'Quote-only request']);
  }
  if (e.target && est) {
    if (est > e.target * 1.15) {
      sc -= 10;
      r.push(['down', 'Target rate below spec']);
    } else {
      sc += 10;
      r.push(['up', 'Target rate fits spec']);
    }
  }
  if (e.eventIn === 3) {
    r.push(['', 'Immediate requirement']);
  }
  if (e.eventIn && e.eventIn <= 21) {
    sc += 10;
    r.push(['up', 'Event within 3 weeks']);
  }
  if (e.origin === 'Referral') {
    sc += 5;
    r.push(['up', 'Referral']);
  }
  if (e.fromPast) {
    sc += 10;
    r.push(['up', 'Reorder of a past product']);
  }
  const label = sc >= 70 ? 'hot' : sc >= 50 ? 'warm' : 'cold';
  return { sc, label, r };
};

export const sampleTax = (s) => {
  const amt = (s?.sampleRate || 0) * (s?.sampleQty || 0);
  const pct = s?.sampleGst || 0;
  if (!amt || !pct || s?.sampleGstIncl === null || s?.sampleGstIncl === undefined) return { ready: false, amt };
  const base = s.sampleGstIncl ? amt / (1 + pct / 100) : amt;
  const gst = (base * pct) / 100;
  return { ready: true, amt, pct, base, gst, total: base + gst, perBase: base / (s.sampleQty || 1) };
};

export const gstTag = (s) =>
  s?.sampleGstIncl === null || s?.sampleGstIncl === undefined || !s?.sampleGst
    ? ''
    : ` ${s.sampleGstIncl ? 'incl.' : '+'} ${s.sampleGst}% GST`;

export const matLabel = (e) => {
  if (!e) return 'Acrylic';
  const mats = e.mats || [e.mat || 'Acrylic'];
  if (mats.length === 1) return mats[0];
  if (mats.length === 2) return `${mats[0]} + ${mats[1]}`;
  return `${mats[0]} + ${mats[1]} + ${mats[2]}`;
};

export const computeGroupLetter = (index) => String.fromCharCode(65 + index); // 0 -> A, 1 -> B, 2 -> C

export const allItems = (s) => {
  if (!s || !s.e) return [];
  const seqStr = s?.seq ? formatEnquiryNo(s.seq) : ENQUIRY_CONFIG.DEFAULT_ENQUIRY_NO;
  if (Array.isArray(s.e.trophyGroups) && s.e.trophyGroups.length > 0) {
    const list = [];
    s.e.trophyGroups.forEach((group, gIdx) => {
      const groupChar = computeGroupLetter(gIdx);
      const gTheme = group.theme || s.e.theme || `Custom Trophy ${groupChar}`;
      const gType = group.type || s.e.type || 'Plaque';
      const gMat = group.mats && group.mats.length > 0
        ? group.mats.join(' + ')
        : (group.mat || s.e.mat || 'Crystal + MDF');
      const gKind = group.kind || s.e.askMode || 'custom';
      (group.items || []).forEach((item, iIdx) => {
        list.push({
          id: item.id || `sub_${groupChar}_${iIdx + 1}`,
          subJobNo: `${seqStr}-${groupChar}${iIdx + 1}`,
          groupChar,
          sizeIdx: iIdx + 1,
          theme: gTheme,
          type: gType,
          mat: gMat,
          material: gMat,
          kind: gKind,
          size: item.size || s.e.size || 8,
          qty: item.qty || s.qty || 100,
          budget: item.budget || s.e.budget || 850,
          ...item
        });
      });
    });
    if (list.length > 0) return list;
  }
  return [{ id: 'primary', kind: s.e.askMode || 'custom', ...s.e }, ...(s.e.more || [])];
};

export const allReady = (s) => {
  if (!s || !s.e) return false;
  if (s.e.askMode === 'ready' || s.e.kind === 'ready') return true;
  const items = allItems(s);
  if (items.length > 0 && items.every((it) => it.kind === 'ready')) return true;
  return false;
};

export const isMulti = (s) => {
  if (!s || !s.e) return false;
  return !!(s.e.more && s.e.more.length > 0);
};

export const primaryItem = (s) => (s && s.e ? s.e : {});

export const itemName = (item) => {
  if (!item) return 'Product';
  return item.theme || item.product || item.type || 'Custom Trophy';
};

export const computeSubJobCode = (parentJobNo = ENQUIRY_CONFIG.DEFAULT_ENQUIRY_NO, groupIndex = 0, sizeIndex = 1) => {
  const groupChar = computeGroupLetter(groupIndex);
  return `${parentJobNo}-${groupChar}${sizeIndex}`;
};

export const subJobsOf = (s, parentJobNo = ENQUIRY_CONFIG.DEFAULT_ENQUIRY_NO) => {
  if (!s || !s.e) return [];
  const safeParent = parentJobNo
    ? (String(parentJobNo).startsWith("RD") ? parentJobNo : `RD${parentJobNo}`)
    : (s?.seq ? formatEnquiryNo(s.seq) : ENQUIRY_CONFIG.DEFAULT_ENQUIRY_NO);
  const result = [];

  // 1. Direct from trophyGroups if available
  if (Array.isArray(s.e.trophyGroups) && s.e.trophyGroups.length > 0) {
    let groupIdx = 0;
    s.e.trophyGroups.forEach((group) => {
      const groupChar = computeGroupLetter(groupIdx);
      const groupTheme = group.theme || s.e.theme || 'Custom Trophy';
      const groupType = group.type || s.e.type || 'Plaque';
      const groupMat = group.mats && group.mats.length > 1
        ? `Fusion: ${group.mats.join(' + ')}`
        : (group.mat || (group.mats && group.mats[0]) || s.e.mat || 'Crystal + MDF');
      const groupKind = group.kind || s.e.askMode || 'custom';

      (group.items || []).forEach((item, idx) => {
        const sizeIdx = idx + 1;
        const subJobNo = `${safeParent}-${groupChar}${sizeIdx}`;
        const matchedDb = (Array.isArray(s.sub_jobs) ? s.sub_jobs : []).find(
          (sj) => sj.sub_job_no === subJobNo || sj.sub_job_no?.endsWith(`-${groupChar}${sizeIdx}`)
        );
        const isMulti = Boolean(group.items && group.items.length > 1);
        const isDropped = Boolean(
          item.is_dropped !== undefined
            ? item.is_dropped
            : (matchedDb?.is_dropped !== undefined ? matchedDb.is_dropped : (!isMulti && group.is_dropped))
        );
        const isOnHold = Boolean(
          item.is_on_hold !== undefined
            ? item.is_on_hold
            : (matchedDb?.is_on_hold !== undefined ? matchedDb.is_on_hold : (!isMulti && group.is_on_hold))
        );

        const matchedCostingLine = (s.costing?.lines || []).find(
          (l) => l.subJobNo === subJobNo || l.id === item.id || l.name === groupTheme
        );
        const simRateVal = s.simulatedRates?.[item.id]?.sample || s.simulatedRates?.[subJobNo]?.sample;

        const effSampleRate =
          (matchedCostingLine?.sampleRate !== undefined && Number(matchedCostingLine.sampleRate) > 0)
            ? Number(matchedCostingLine.sampleRate)
            : (simRateVal !== undefined && Number(simRateVal) > 0)
            ? Number(simRateVal)
            : (item.sampleRate !== undefined && Number(item.sampleRate) > 0)
            ? Number(item.sampleRate)
            : (item.sample_rate !== undefined && Number(item.sample_rate) > 0)
            ? Number(item.sample_rate)
            : (matchedDb?.sample_rate !== undefined && Number(matchedDb.sample_rate) > 0)
            ? Number(matchedDb.sample_rate)
            : (item.unit_rate ? item.unit_rate + 200 : 0) ||
              (matchedDb?.unit_rate ? matchedDb.unit_rate + 200 : 0) ||
              (item.rate ? item.rate + 200 : 0) ||
              0;
        const simUnitRateVal =
          s.simulatedRates?.[subJobNo]?.rate ||
          s.simulatedRates?.[`${groupIdx}-${idx}`]?.rate ||
          s.simulatedRates?.[item.id]?.rate;

        const effUnitRate =
          (matchedCostingLine?.rate !== undefined && Number(matchedCostingLine.rate) > 0)
            ? Number(matchedCostingLine.rate)
            : (simUnitRateVal !== undefined && Number(simUnitRateVal) > 0)
            ? Number(simUnitRateVal)
            : (item.unit_rate !== undefined && Number(item.unit_rate) > 0)
            ? Number(item.unit_rate)
            : (item.unitRate !== undefined && Number(item.unitRate) > 0)
            ? Number(item.unitRate)
            : (item.rate !== undefined && Number(item.rate) > 0)
            ? Number(item.rate)
            : (matchedDb?.unit_rate !== undefined && Number(matchedDb.unit_rate) > 0)
            ? Number(matchedDb.unit_rate)
            : (matchedDb?.target_rate !== undefined && Number(matchedDb.target_rate) > 0)
            ? Number(matchedDb.target_rate)
            : (item.budget !== undefined && Number(item.budget) > 0)
            ? Number(item.budget)
            : 0;

        result.push({
          id: item.id || `sub_${groupIdx}_${sizeIdx}`,
          subJobNo,
          groupChar,
          sizeIdx,
          theme: groupTheme,
          type: groupType,
          size: item.size || s.e.size || 8,
          qty: item.qty || s.qty || 100,
          sampleRate: effSampleRate,
          sample_rate: effSampleRate,
          unitRate: effUnitRate,
          unit_rate: effUnitRate,
          rate: effUnitRate,
          sampleQty: item.sampleQty || s.sampleQty || 1,
          mat: groupMat,
          material: groupMat,
          kind: groupKind,
          itemRef: item,
          is_on_hold: isOnHold,
          hold_reason: item.hold_reason || matchedDb?.hold_reason || group.hold_reason || "",
          is_dropped: isDropped,
          drop_reason: item.drop_reason || matchedDb?.drop_reason || group.drop_reason || "",
          designOptions: item.designOptions || [
            { optionNo: 1, name: 'Option 1', refImg: null },
            { optionNo: 2, name: 'Option 2', refImg: null }
          ],
          approvedDesign: s.subJobApprovals?.[subJobNo] || null
        });
      });
      groupIdx++;
    });
    if (result.length > 0) return result;
  }

  // 2. Fallback to allItems grouping
  const items = allItems(s);

  // Group items by trophy theme/type
  const groupMap = {};
  items.forEach((it) => {
    const key = it.theme || it.product || it.type || 'Custom Trophy';
    if (!groupMap[key]) groupMap[key] = [];
    groupMap[key].push(it);
  });

  let groupIdx = 0;
  Object.entries(groupMap).forEach(([themeName, groupItems]) => {
    const groupChar = computeGroupLetter(groupIdx);
    groupItems.forEach((item, idx) => {
      const sizeIdx = idx + 1;
      const subJobNo = `${safeParent}-${groupChar}${sizeIdx}`;
      const matchedDb = (Array.isArray(s.sub_jobs) ? s.sub_jobs : []).find(
        (sj) => sj.sub_job_no === subJobNo || sj.sub_job_no?.endsWith(`-${groupChar}${sizeIdx}`)
      );
      const isDropped = Boolean(
        item.is_dropped !== undefined
          ? item.is_dropped
          : (matchedDb?.is_dropped !== undefined ? matchedDb.is_dropped : false)
      );
      const isOnHold = Boolean(
        item.is_on_hold !== undefined
          ? item.is_on_hold
          : (matchedDb?.is_on_hold !== undefined ? matchedDb.is_on_hold : false)
      );

      const matchedCostingLine = (s.costing?.lines || []).find(
        (l) => l.subJobNo === subJobNo || l.id === item.id || l.name === themeName
      );
      const simRateVal = s.simulatedRates?.[item.id]?.sample || s.simulatedRates?.[subJobNo]?.sample;

      const effSampleRate =
        (matchedCostingLine?.sampleRate !== undefined && Number(matchedCostingLine.sampleRate) > 0)
          ? Number(matchedCostingLine.sampleRate)
          : (simRateVal !== undefined && Number(simRateVal) > 0)
          ? Number(simRateVal)
          : (item.sampleRate !== undefined && Number(item.sampleRate) > 0)
          ? Number(item.sampleRate)
          : (item.sample_rate !== undefined && Number(item.sample_rate) > 0)
          ? Number(item.sample_rate)
          : (matchedDb?.sample_rate !== undefined && Number(matchedDb.sample_rate) > 0)
          ? Number(matchedDb.sample_rate)
          : (item.unit_rate ? item.unit_rate + 200 : 0) ||
            (matchedDb?.unit_rate ? matchedDb.unit_rate + 200 : 0) ||
            (item.rate ? item.rate + 200 : 0) ||
            0;
      const simUnitRateVal =
        s.simulatedRates?.[subJobNo]?.rate ||
        s.simulatedRates?.[`${groupIdx}-${idx}`]?.rate ||
        s.simulatedRates?.[item.id]?.rate;

      const effUnitRate =
        (matchedCostingLine?.rate !== undefined && Number(matchedCostingLine.rate) > 0)
          ? Number(matchedCostingLine.rate)
          : (simUnitRateVal !== undefined && Number(simUnitRateVal) > 0)
          ? Number(simUnitRateVal)
          : (item.unit_rate !== undefined && Number(item.unit_rate) > 0)
          ? Number(item.unit_rate)
          : (item.unitRate !== undefined && Number(item.unitRate) > 0)
          ? Number(item.unitRate)
          : (item.rate !== undefined && Number(item.rate) > 0)
          ? Number(item.rate)
          : (matchedDb?.unit_rate !== undefined && Number(matchedDb.unit_rate) > 0)
          ? Number(matchedDb.unit_rate)
          : (matchedDb?.target_rate !== undefined && Number(matchedDb.target_rate) > 0)
          ? Number(matchedDb.target_rate)
          : 0;

      result.push({
        id: item.id || `sub_${groupIdx}_${sizeIdx}`,
        subJobNo,
        groupChar,
        sizeIdx,
        theme: themeName,
        type: item.type || s.e.type || 'Plaque',
        size: item.size || 8,
        qty: item.qty || s.qty || 100,
        sampleRate: effSampleRate,
        sample_rate: effSampleRate,
        unitRate: effUnitRate,
        unit_rate: effUnitRate,
        rate: effUnitRate,
        sampleQty: item.sampleQty || s.sampleQty || 1,
        mat: item.mat || item.material || (item.materials && item.materials.length > 1 ? `Fusion: ${item.materials.join(' + ')}` : item.materials?.[0]) || s.e?.mat || 'Crystal + MDF',
        material: item.mat || item.material || (item.materials && item.materials.length > 1 ? `Fusion: ${item.materials.join(' + ')}` : item.materials?.[0]) || s.e?.mat || 'Crystal + MDF',
        kind: item.kind || 'custom',
        itemRef: item,
        is_on_hold: isOnHold,
        hold_reason: item.hold_reason || matchedDb?.hold_reason || "",
        is_dropped: isDropped,
        drop_reason: item.drop_reason || matchedDb?.drop_reason || "",
        designOptions: item.designOptions || [
          { optionNo: 1, name: 'Option 1', refImg: null },
          { optionNo: 2, name: 'Option 2', refImg: null }
        ],
        approvedDesign: s.subJobApprovals?.[subJobNo] || null
      });
    });
    groupIdx++;
  });

  return result;
};

export const addWork = (days) => {
  const d = new Date();
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0) added++; // Skip Sundays
  }
  return d;
};

export const workDaysTo = (iso) => {
  if (!iso) return 5;
  const target = new Date(iso);
  const now = new Date();
  let count = 0;
  const cur = new Date(now);
  while (cur < target) {
    cur.setDate(cur.getDate() + 1);
    if (cur.getDay() !== 0) count++;
  }
  return count || 1;
};

export const isoOf = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export const leadDateOf = (s) => (s?.leadDate ? new Date(s.leadDate) : null);
export const eventDateOf = (e) => (e?.eventDate ? new Date(e.eventDate) : null);
export const enqDelivDate = (e) => (e?.eventDate ? new Date(new Date(e.eventDate).getTime() - 86400000) : null);
export const delivDate = (s) => (s?.leadDate ? new Date(s.leadDate) : null);

export const billOn = (s) => !!(s?.billTo && s.billTo.on && s.billTo.name);
export const billName = (s, client) => (billOn(s) ? s.billTo.name : client.name);
export const payerName = (s, client) => (billOn(s) ? (s.billTo.payerSame !== false ? s.billTo.name : s.billTo.payer || s.billTo.name) : client.name);
export const posOf = (s, client) => {
  if (billOn(s) && s.billTo.pos) return { code: s.billTo.pos, name: STATES[s.billTo.pos] };
  if (billOn(s)) return stateOf(s.billTo.gstin) || { code: RD_STATE, name: STATES[RD_STATE] };
  return stateOf(client?.gstin) || { code: RD_STATE, name: STATES[RD_STATE] };
};
export const isIGST = (s, client) => posOf(s, client).code !== RD_STATE;

export const quoteTo = (s) => (billOn(s) ? s?.billTo?.quoteTo || 'bill' : 'client');

export const quoteRecipient = (s, client) => {
  if (billOn(s) && quoteTo(s) !== 'client') return s.billTo.name;
  const ct = contactsOf(client, s).find((x) => x.id === s?.contactId);
  return ct ? ct.name : client ? client.name : 'Client';
};

export const proofLine = (p) => {
  if (!p) return '';
  return `Confirmed via ${p.fmt || p.via || 'WhatsApp'}${p.ref ? ` (${p.ref})` : ''}`;
};

export const dtpOf = (s, phase) => {
  const normPh = (phase === 'prod' || phase === 'production') ? 'prod' : 'sample';
  const altPh = (phase === 'prod' || phase === 'production') ? 'production' : 'sample';
  return s?.dtp?.[normPh] || s?.dtp?.[altPh] || s?.dtp?.[phase] || {};
};

export const dtpState = (s, ph) => {
  const isS = ph === 'sample';
  const normPh = isS ? 'sample' : 'prod';
  const altPh = isS ? 'sample' : 'production';
  const d = s?.dtp?.[normPh] || s?.dtp?.[altPh] || s?.dtp?.[ph] || {};
  if (d.skipped) return 'skipped';

  const wiz = s?.wizard_state?.dtp?.[normPh] || s?.wizard_state?.dtp?.[altPh] || s?.wizard_state?.dtp?.[ph];

  const isApproved = isS
    ? Boolean(
        d.approved ||
        d.proofFile?.status === 'Approved' ||
        (Array.isArray(d.proofFiles) && d.proofFiles.some((f) => f.status === 'Approved')) ||
        wiz?.approved ||
        wiz?.proofFile?.status === 'Approved' ||
        (Array.isArray(wiz?.proofFiles) && wiz.proofFiles.some((f) => f.status === 'Approved')) ||
        (s?.sub_jobs || []).some((sj) => sj.sample_proof_status === 'approved' || sj.proof_status === 'approved' || sj.master_template_status === 'approved') ||
        (s?.rawJob?.sub_jobs || []).some((sj) => sj.sample_proof_status === 'approved' || sj.proof_status === 'approved' || sj.master_template_status === 'approved')
      )
    : Boolean(
        d.approved ||
        d.proofFile?.status === 'Approved' ||
        (Array.isArray(d.proofFiles) && d.proofFiles.some((f) => f.status === 'Approved')) ||
        wiz?.approved ||
        wiz?.proofFile?.status === 'Approved' ||
        (Array.isArray(wiz?.proofFiles) && wiz.proofFiles.some((f) => f.status === 'Approved')) ||
        (s?.sub_jobs || []).some((sj) => sj.production_proof_status === 'approved') ||
        (s?.rawJob?.sub_jobs || []).some((sj) => sj.production_proof_status === 'approved')
      );

  if (isApproved) return 'approved';
  if (d.proofSent) return 'client';
  if (d.proofAt) return 'proof';
  if (d.sentAt) return 'dtp';
  if (d.content || d.text) return 'ready';
  return 'content';
};

export const dtpDone = (s, ph) => {
  const d = dtpOf(s, ph);
  if (d.skipped) return true;
  return dtpState(s, ph) === 'approved';
};
export const DTP_LABEL = {
  content: 'Waiting for content',
  ready: 'Content in · send to DTP',
  dtp: 'With DTP',
  proof: 'Proof ready · send to client',
  client: 'Proof with client',
  approved: 'Artwork approved',
  skipped: 'No artwork needed'
};

export const roundOf = (s) => ({
  v: (s?.rounds?.length || 0) + 1,
  qty: s?.sampleQty || 1,
  rate: s?.sampleRate || 0,
  charge: s?.charge || 'foc',
  gstIncl: s?.sampleGstIncl,
  gst: s?.sampleGst,
  pp: !!s?.ppAfter
});

export const sfOf = (s) => s?.sflow?.[roundOf(s).v] || {};
export const sampleVideo = (s) =>
  s?.dmode === 'Video & images only, no delivery' ||
  s?.sdeliv?.mode === 'Video & images only, no delivery' ||
  s?.dmode === 'video' ||
  s?.sampleCarrier === 'Photos / video only' ||
  s?.delivCarrier === 'Photos / video only' ||
  /photo.*video|video.*photo/i.test(s?.sampleCarrier || s?.delivCarrier || s?.dmode || s?.sdeliv?.mode || '');
export const sampleDelivered = (s) => {
  const sf = sfOf(s);
  return !!(sf.deliveredAt || sf.photosAt || s?.sampleDelivered);
};

export const taxOf = (r) => {
  const amt = r?.charge === 'foc' ? 0 : (r?.rate || 0) * (r?.qty || 0);
  if (!amt) return { ready: r?.charge === 'foc', base: 0, gst: 0, total: 0 };
  if (!r.gst || r.gstIncl === null || r.gstIncl === undefined) return { ready: false, base: amt, gst: 0, total: amt };
  const base = r.gstIncl ? amt / (1 + r.gst / 100) : amt;
  const gst = (base * r.gst) / 100;
  return { ready: true, base, gst, total: base + gst };
};

export const finOf = (s, job, client, qty) => {
  const rate = (s?.fc && s.fc.rate) || s?.jobRate || job?.rate || 1000;
  const prodBase = (qty || 0) * rate;
  const rounds = (s?.mode === 'sample' || s?.ppAfter || (s?.rounds && s.rounds.length > 0))
    ? [...(s?.rounds || []), roundOf(s)]
    : [];
  const lines = rounds.map((r) => {
    const t = taxOf(r);
    const chargeable = r.charge !== 'foc' && t.base > 0;
    return { ...r, t, chargeable, adjusted: chargeable && s?.relAdjust !== false };
  });
  const adjBase = lines.filter((l) => l.adjusted).reduce((a, l) => a + l.t.base, 0);
  const net = Math.max(0, prodBase - adjBase);
  const pct = s?.prodGst || 18;
  const gst = (net * pct) / 100;
  const total = net + gst;
  const termsAp = /100%/.test(client?.terms || '') ? 1 : /50%/.test(client?.terms || '') ? 0.5 : 0;
  const plan = s?.advPlan?.mode || 'terms';
  const advAmt = plan === 'none' ? 0 : plan === 'custom' ? Math.min(total, s?.advPlan?.amount || 0) : total * termsAp;
  const ap = total ? advAmt / total : 0;
  const sampleInv = lines.filter((l) => l.chargeable).reduce((a, l) => a + l.t.total, 0);
  const focCost = lines.filter((l) => !l.chargeable).reduce((a, l) => a + (l.qty || 1) * Math.round(rate * 1.5 / 10) * 10, 0);
  return {
    rate,
    qty,
    prodBase,
    adjBase,
    net,
    pct,
    gst,
    total,
    adv: advAmt,
    ap,
    plan,
    termsAp,
    lines,
    sampleInv,
    focCost,
    grand: total + sampleInv,
    items: [{ id: 'primary', name: job?.product || 'Custom Trophy', qty, rate, amt: prodBase }]
  };
};

export const advSettled = (s, f) => {
  if (!f) return true;
  return !!(s?.rcpt || s?.advNA || s?.advLater || (s?.advTransit && !s.advTransit.hold) || f.adv === 0);
};

export const outstanding = (s, f) => {
  if (!f) return 0;
  const paid = (s?.rcpt?.amount || 0) + (s?.balRcpt?.amount || 0);
  return Math.max(0, Math.round(f.total - paid));
};

export const isSampleRatesApproved = (s) =>
  Boolean(
    s?.ratesApproved ||
    s?.sampleConfirmed ||
    s?.sampleRatesState === 'approved' ||
    s?.sampleDecision?.decision === 'approved' ||
    s?.rawJob?.sample_rates_approved ||
    s?.rawJob?.wizard_state?.ratesApproved ||
    s?.rawJob?.wizard_state?.sampleConfirmed ||
    s?.rawJob?.wizard_state?.sampleRatesState === 'approved' ||
    s?.rawJob?.wizard_state?.sampleDecision?.decision === 'approved'
  );

export const sampleRatesOk = (s) =>
  (s?.charge || 'foc') === 'foc' ||
  !s?.sampleRate ||
  (s?.sampleRate && s.sampleRate > 0 && isSampleRatesApproved(s));

export const CARRIERS = [
  { v: 'Our vehicle', icon: '🚐', pay: false },
  { v: 'Hand delivery', icon: '🤝', pay: false },
  { v: 'Tempo', icon: '🛻', pay: true },
  { v: 'Porter', icon: '🛵', pay: true },
  { v: 'Courier', icon: '📮', pay: true },
  { v: 'Air cargo', icon: '✈️', pay: true },
  { v: "Client's courier", icon: '📦', pay: false },
  { v: 'Client pickup', icon: '🏢', pay: false },
  { v: 'Photos / video only', icon: '📷', pay: false }
];

export const carrierOf = (mode) => {
  const m = String(mode || '');
  if (/photo|video/i.test(m)) return 'Photos / video only';
  const c = CARRIERS.find((x) => m.toLowerCase().startsWith(x.v.toLowerCase()));
  return c ? c.v : 'Our vehicle';
};
export const payerOf = (mode) => (/client pays/i.test(mode || '') ? 'client' : 'rd');
export const modeStr = (carrier, payer) =>
  (CARRIERS.find((x) => x.v === carrier) || {}).pay
    ? `${carrier}, ${payer === 'client' ? 'client pays' : 'we pay'}`
    : carrier;

export const BOX_OPTS = [
  { v: 'Standard box', icon: '📦', t: 'Standard box', sub: 'Plain corrugated' },
  { v: 'Custom printed box', icon: '🖨️', t: 'Custom printed box', sub: 'Client branding' },
  { v: 'Velvet box', icon: '💎', t: 'Velvet box', sub: 'Premium finish' },
  { v: 'Top-bottom box', icon: '🎁', t: 'Top-bottom box', sub: 'Lid + base, pick colour' },
  { v: 'Pouch', icon: '👝', t: 'Pouch', sub: 'Soft drawstring' }
];

export const PROTECT_OPTS = [
  { v: 'Thermocol cavity box', icon: '🧊', t: 'Thermocol cavity box', sub: 'Moulded cavity' },
  { v: 'Thermocol buffer', icon: '🧱', t: 'Thermocol buffer' },
  { v: 'Foam insert', icon: '🧽', t: 'Foam insert' },
  { v: 'Bubble wrap', icon: '🫧', t: 'Bubble wrap' }
];

export const LABEL_OPTS = [
  { v: 'Address & name label', icon: '🏷️', t: 'Address & name label', sub: 'Printed sticker' },
  { v: 'Premium sublimation label, gold mirror', icon: '✨', t: 'Premium sublimation label', sub: 'With gold mirror' },
  { v: 'Gold mirror UV-printed label', icon: '🪞', t: 'Gold mirror label', sub: 'UV-printed' }
];

export const ADDON_OPTS = [
  { v: 'Certificate', icon: '📜', t: 'Certificate' },
  { v: 'Custom tag', icon: '🔖', t: 'Custom tag' },
  { v: 'Gift card', icon: '💌', t: 'Gift card' },
  { v: 'Ribbon', icon: '🎀', t: 'Ribbon' },
  { v: 'Name plate sheet', icon: '🪪', t: 'Name plate sheet' },
  { v: 'Instruction card', icon: '📄', t: 'Instruction card' }
];

export const MODE_OPTS = [
  { v: 'Individual', icon: '1️⃣', t: 'Individual', sub: 'Each piece boxed' },
  { v: 'Consolidated', icon: '🗃️', t: 'Consolidated', sub: 'Master cartons' },
  { v: 'Both', icon: '📚', t: 'Both', sub: 'Boxed, then cartons' },
  { v: 'Individual + manager-wise', icon: '👤', t: 'Individual + manager-wise', sub: 'Grouped by manager' },
  { v: 'Individual + manager + zone/branch-wise', icon: '🗺️', t: 'Individual + manager + zone / branch', sub: 'Zone, then manager' },
  { v: 'Stage-list-wise', icon: '🎤', t: 'Stage-list-wise', sub: 'In award-ceremony order' }
];

export const BOX_COLOURS = ['Black', 'White', 'Navy', 'Maroon'];

export const normPack = (p) => {
  if (!p) return { outer: ['Standard box'], protect: ['Bubble wrap'], labels: [], addons: [], mode: 'Individual' };
  return {
    ...p,
    outer: p.outer || ['Standard box'],
    protect: p.protect || [],
    labels: p.labels || [],
    addons: p.addons || [],
    mode: p.mode || 'Individual'
  };
};

export const allLocs = (d, client) => [
  ...(client?.shipTos?.map((x) => ({ id: x.id, label: x.label })) || []),
  ...((d && d.extraLocs) || [])
];

export const delivWhere = (d, client) => {
  if (!d) return '';
  if (carrierOf(d.mode) === 'Client pickup') return 'Client pickup from RD';
  if (d.type === 'multi') return 'Split across multiple locations';
  const L = allLocs(d, client).find((x) => x.id === d.shipTo) || {};
  return L.address ? `${L.label} (${L.address})` : L.label || 'Default office';
};

export const remSentLast = (s) => s?.payRem?.sent?.[s.payRem.sent.length - 1] || null;

export const PROOF_LABEL = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  screenshot: 'Screenshot',
  verbal: 'Verbal call',
  written: 'Purchase Order / Written'
};

export const chargeLabel = {
  foc: 'Free of cost',
  charge: 'Chargeable',
  adjust: 'Chargeable (adjust against PO)'
};

export const ORIGIN_ICON = {
  WhatsApp: '💬',
  Email: '✉️',
  Call: '📞',
  'Walk-in': '🚶',
  Referral: '🤝',
  Website: '🌐',
  IndiaMART: '🛒'
};

export const LOST = ['Price', 'Timeline', 'Went with another vendor', 'Budget cut', 'No response', 'Design not liked'];

export const STAGES = [
  { k: 'enquiry', t: 'Enquiry', c: '#4B3BF5', bg: '#ECEAFF', ink: '#2E22B8', icon: '📝' },
  { k: 'sample', t: 'Sample', c: '#F2B705', bg: '#FFF5D1', ink: '#6E5100', icon: '✏️' },
  { k: 'production', t: 'Production', c: '#0D9488', bg: '#DBF5EC', ink: '#0A5E4A', icon: '🏭' },
  { k: 'packing', t: 'Packing', c: '#0E9E7B', bg: '#DBF5EC', ink: '#0A5E4A', icon: '📦' },
  { k: 'dispatch', t: 'Dispatch', c: '#E0524B', bg: '#FDE6E4', ink: '#8A2621', icon: '🚚' },
  { k: 'dtp', t: 'DTP', c: '#8B5CF6', bg: '#F3E8FF', ink: '#6D28D9', icon: '🖋️' },
  { k: 'aftersales', t: 'After-sales', c: '#0EA5E9', bg: '#E0F2FE', ink: '#0369A1', icon: '💬' },
  { k: 'collections', t: 'Collections', c: '#D97706', bg: '#FEF3C7', ink: '#92400E', icon: '💳' },
  { k: 'closed', t: 'Completed', c: '#0E9E7B', bg: '#DBF5EC', ink: '#0A5E4A', icon: '🏁' },
  { k: 'cancelled', t: 'Cancelled', c: '#6B7280', bg: '#F3F4F6', ink: '#374151', icon: '✕' }
];

export const stageOf = (k) => STAGES.find((x) => x.k === k) || STAGES[0];

export const jobStage = (s, f) => {
  if (s?.abandoned) return 'cancelled';
  const isOrder = s?.stage === 'order' || (s?.step !== undefined && s?.step >= 4) || !!s?.mode || !!s?.sent;
  if (!isOrder) return 'enquiry';
  if (s?.mode === 'sample' && !s?.approved) return 'sample';
  if (!s?.released) return !(s?.pi && s?.pi?.sent && s?.costOk) ? 'production' : s?.packOk ? 'dispatch' : 'packing';
  if (!dtpDone(s, 'prod')) return 'dtp';
  if (!s?.deliveredAt) return 'aftersales';
  if (f ? outstanding(s, f) > 0 : !s?.balRcpt) return 'collections';
  return 'closed';
};

// Utility to resolve the approved or primary product design image (returns null if no image exists)
export const getProductDesignImage = (s = {}, e = {}, p = {}, idx = 0) => {
  // 0. Direct approved design on product object itself
  if (p?.approved_design_url) return p.approved_design_url;
  if (p?.imgUrl) return p.imgUrl;
  if (p?.approved_design) {
    const ad = p.approved_design;
    const url = typeof ad === "string" ? ad : (ad?.file_url || ad?.url || ad?.signed_url);
    if (url) return url;
  }
  if (p?.image) return p.image;
  if (p?.img) return p.img;
  if (p?.photo) return p.photo;
  if (p?.refImg) return p.refImg;

  // Resolve group index (0 for group A, 1 for group B, etc.)
  let pIdx = p?.originalProductIndex !== undefined
    ? p.originalProductIndex
    : (p?.originalIndex !== undefined ? p.originalIndex : (idx !== undefined ? idx : 0));

  const subJobCode = p?.subJobNo || p?.sub_job_no || "";
  const matchLetter = subJobCode ? String(subJobCode).match(/[-_]?([A-Za-z])(\d+)?$/) : null;
  if (matchLetter && matchLetter[1]) {
    const letterIdx = matchLetter[1].toUpperCase().charCodeAt(0) - 65;
    if (!isNaN(letterIdx) && letterIdx >= 0) pIdx = letterIdx;
  }

  const uploadedDesigns = s?.uploadedDesigns || {};
  const productFeedback = s?.productFeedback || {};

  // 1. Look for approved option in productFeedback
  const feedbacks = productFeedback[pIdx] || productFeedback[String(pIdx)];
  const fbList = Array.isArray(feedbacks) ? feedbacks : (feedbacks ? [feedbacks] : []);
  const approvedFb = fbList.find((f) => f?.mode === 'approve');

  if (approvedFb) {
    if (Array.isArray(approvedFb.optIdxs) && approvedFb.optIdxs.length > 0) {
      for (const optIdx of approvedFb.optIdxs) {
        const fileUrl = uploadedDesigns[`${pIdx}-${optIdx}`];
        if (fileUrl) return fileUrl;
      }
    }
    if (approvedFb.optIdx !== undefined) {
      const fileUrl = uploadedDesigns[`${pIdx}-${approvedFb.optIdx}`];
      if (fileUrl) return fileUrl;
    }
  }

  // 2. Check any uploaded design for this product index (e.g. 0-0, 0-1)
  if (uploadedDesigns[`${pIdx}-0`]) return uploadedDesigns[`${pIdx}-0`];
  const matchingKey = Object.keys(uploadedDesigns).find((k) => k.startsWith(`${pIdx}-`));
  if (matchingKey && uploadedDesigns[matchingKey]) return uploadedDesigns[matchingKey];

  // 3. Fallback to any uploaded design if only 1 item exists
  const allUploads = Object.values(uploadedDesigns).filter(Boolean);
  if (allUploads.length > 0 && (pIdx === 0 || Object.keys(uploadedDesigns).length === 1)) {
    return allUploads[0];
  }

  // 4. Check sub_jobs array in s or job
  const matchingSubJob = (Array.isArray(s?.sub_jobs) ? s.sub_jobs : []).find(
    (sj) => sj.sub_job_no === subJobCode || sj.sub_job_no?.endsWith(`-${matchLetter?.[1] || ''}1`)
  );
  if (matchingSubJob) {
    if (matchingSubJob.approved_design_url) return matchingSubJob.approved_design_url;
    if (matchingSubJob.approved_design) {
      const ad = matchingSubJob.approved_design;
      const url = typeof ad === "string" ? ad : (ad?.file_url || ad?.url || ad?.signed_url);
      if (url) return url;
    }
    if (Array.isArray(matchingSubJob.designer_files) && matchingSubJob.designer_files[0]) {
      const df = matchingSubJob.designer_files[0];
      const url = typeof df === "string" ? df : (df?.file_url || df?.url);
      if (url) return url;
    }
  }

  // 5. Check product object arrays
  if (Array.isArray(p?.images) && p.images[0]) return p.images[0];
  if (p?.items?.[0]?.image) return p.items[0].image;

  // 6. Check DTP proof files or artwork files
  if (s?.dtp?.sample?.proofUrl) return s.dtp.sample.proofUrl;
  if (s?.dtp?.production?.proofUrl) return s.dtp.production.proofUrl;
  if (s?.dtp?.sample?.proofFile?.dataUrl) return s.dtp.sample.proofFile.dataUrl;
  if (s?.dtp?.production?.proofFile?.dataUrl) return s.dtp.production.proofFile.dataUrl;

  // 7. Check samplePhotos from shop floor
  const samplePhotos = s?.sf?.samplePhotos || s?.samplePhotos;
  if (samplePhotos) {
    const photoList = Object.values(samplePhotos).filter(Boolean);
    if (photoList[pIdx]?.url) return photoList[pIdx].url;
    if (photoList[0]?.url) return photoList[0].url;
  }

  // 8. Check e.products or e.productBriefs
  const pName = p?.theme || p?.name || p?.product;
  if (pName && e?.productBriefs?.[pName]?.refs?.[0]) {
    const r = e.productBriefs[pName].refs[0];
    const u = r?.dataUrl || r?.url || (typeof r === 'string' ? r : null);
    if (u) return u;
  }
  if (e?.products?.[pIdx]?.image) return e.products[pIdx].image;
  if (Array.isArray(e?.products?.[pIdx]?.images) && e.products[pIdx].images[0]) {
    return e.products[pIdx].images[0];
  }
  if (s?.e?.products?.[pIdx]?.image) return s.e.products[pIdx].image;

  // 9. Check global references
  const globalRefs = e?.globalRefs || s?.e?.globalRefs || s?.refFiles;
  if (Array.isArray(globalRefs) && globalRefs.length > 0) {
    const ref = globalRefs[pIdx] || globalRefs[0];
    const u = ref?.url || ref?.dataUrl || (typeof ref === 'string' ? ref : null);
    if (u) return u;
  }

  // Only show existing image - no default image
  return null;
};

// Unified helper to extract all product previews with their images for overlays and print sheets
export const getAllProductPreviews = (s = {}, e = {}, parentJobNo = ENQUIRY_CONFIG.DEFAULT_ENQUIRY_NO) => {
  const pId = s?.seq
    ? formatEnquiryNo(s.seq)
    : (parentJobNo.startsWith("RD") ? parentJobNo : `RD${parentJobNo}`);

  const subJobs = subJobsOf(s, pId);
  const items = (s.orderItems && s.orderItems.length > 0)
    ? s.orderItems
    : (subJobs.length > 0
        ? subJobs
        : allItems(s));

  if (!items || items.length === 0) {
    const fallbackTheme = s?.e?.theme || s?.theme || "Custom Trophy";
    const fallbackSubJob = `${pId}-A1`;
    const resolvedImg = getProductDesignImage(s, e, { theme: fallbackTheme, subJobNo: fallbackSubJob }, 0);
    return [{
      id: "prod_0",
      subJobNo: fallbackSubJob,
      theme: fallbackTheme,
      type: s?.e?.type || "Trophy",
      size: s?.e?.size || 8,
      mat: s?.e?.mat || "Crystal + MDF",
      qty: s?.qty || 1,
      rate: s?.jobRate || 1000,
      spec: `${s?.e?.type || "Trophy"} · ${s?.e?.size || 8} in · ${s?.e?.mat || "Crystal + MDF"}`,
      imgUrl: resolvedImg,
      approved_design_url: resolvedImg,
    }];
  }

  return items.map((it, idx) => {
    const subJobNo = it.subJobNo || `${pId}-A${idx + 1}`;
    const theme = it.theme || it.product || it.name || s?.e?.theme || "Custom Trophy";
    const type = it.type || s?.e?.type || "Plaque";
    const rawSize = it.size || s?.e?.size || 8;
    const effSize = typeof rawSize === "object" ? (rawSize?.trophyH || rawSize?.size || 8) : rawSize;
    const mat = it.mat || it.material || s?.e?.mat || "Fusion: Crystal + MDF";
    const qty = it.qty || it.pieces || s?.qty || 1;
    const rate = it.rate || it.budget || s?.jobRate || 1000;
    const safeSpec = (typeof it.spec === "string" && it.spec) || it.specLine || it.spec_line || it.desc || it.description || `${type} · ${effSize} in · ${mat}`;
    const resolvedImg = getProductDesignImage(s, e, it, idx) || it.imgUrl || it.approved_design_url || it.image || null;
    return {
      ...it,
      id: it.id || `prod_${idx}`,
      subJobNo,
      theme,
      type,
      size: effSize,
      mat,
      qty,
      rate,
      spec: safeSpec,
      imgUrl: resolvedImg,
      approved_design_url: resolvedImg,
    };
  });
};

export const mapJobToBoardCard = (j) => {
  if (j && j._isCardSummary) return j;
  const stage = j.stage || "enquiry";
  const rawDue =
    j.due ||
    j.job_completion_date ||
    j.delivery_details?.job_completion_date ||
    j.the_ask?.job_completion_date ||
    j.wizard_state?.e?.job_completion_date ||
    j.wizard_state?.e?.jobCompletionDate ||
    j.delivery_details?.delivery_date ||
    j.delivery_details?.needed_by_date ||
    j.needed_by_date ||
    j.delivery_date ||
    j.the_ask?.needed_by_date ||
    j.the_ask?.delivery_date ||
    j.order_mode?.production_date ||
    j.order_mode?.sample_date ||
    j.the_ask?.event_date ||
    j.event_date ||
    null;
  const due = rawDue ? String(rawDue).slice(0, 10) : null;

  const isHold = Boolean(
    j.sub_jobs?.some((s) => s.is_on_hold) ||
    j.is_on_hold ||
    j.wizard_state?.is_on_hold ||
    j.wizard_state?.e?.trophyGroups?.some((tg) => tg.is_on_hold)
  );

  const subJobsList = j.sub_jobs || [];
  const trophyGroupsList = j.wizard_state?.e?.trophyGroups || [];
  const distinctProducts = subJobsList.length > 0
    ? [...new Set(subJobsList.map((s) => s.product_name || s.theme || "Trophy"))]
    : trophyGroupsList.length > 0
      ? [...new Set(trophyGroupsList.map((g) => g.name || g.theme || "Trophy"))]
      : [j.the_ask?.product_name || j.the_ask?.theme || "Custom Trophy"];

  const pHeadline = distinctProducts.length > 1
    ? `${distinctProducts[0]} + ${distinctProducts.length - 1} more`
    : distinctProducts[0] || "Custom Trophy";

  const totalQty = subJobsList.length > 0
    ? subJobsList.reduce((acc, s) => acc + (s.quantity || 0), 0)
    : trophyGroupsList.length > 0
      ? trophyGroupsList.reduce((acc, g) => acc + (g.quantity || 0), 0)
      : Number(j.the_ask?.quantity || 100);

  const ageDays = j.ageDays != null
    ? j.ageDays
    : Math.max(1, Math.round((Date.now() - new Date(j.createdAt || Date.now()).getTime()) / 86400000));

  const buckets = Array.isArray(j.buckets) && j.buckets.length > 0
    ? j.buckets
    : [stage === "brief" ? "enquiry" : stage];

  const hasSubJobUploaded = subJobsList.some(
    (s) => !s.is_dropped && !s.is_on_hold && s.design_status === "uploaded"
  );
  const designStatus =
    j.the_brief?.design_status ||
    j.wizard_state?.the_brief?.design_status ||
    (hasSubJobUploaded || (j.wizard_state?.uploadedDesigns && Object.keys(j.wizard_state.uploadedDesigns).length > 0)
      ? "uploaded"
      : "pending");

  const isJobCancelled = Boolean(j.is_lost || stage === "cancelled" || stage === "lost" || j.wizard_state?.is_lost);

  let note = j.note || "";
  if (!note) {
    if (isJobCancelled) {
      note = j.lost_reason || j.wizard_state?.lost || j.wizard_state?.lostNotes || "Cancelled order · Abandoned";
    } else {
      const noteParts = [];
      if (stage === "dtp" || buckets.includes("pdtp")) {
        noteParts.push("Production artwork: waiting for content");
      }
      const pendingAdv = (j.financials?.total || 0) - (j.financials?.advance_received || 0);
      if (pendingAdv > 0 && stage !== "enquiry") {
        noteParts.push(`₹${Number(pendingAdv).toLocaleString("en-IN")} advance pending`);
      }
      if (buckets.includes("content")) {
        noteParts.push("Content list awaited");
      }
      if (stage === "packed" || buckets.includes("packed")) {
        noteParts.push("Packed 3 days ago · courier has not picked up");
      }
      if (stage === "aftersales") {
        noteParts.push("Delivered · 2 plaques arrived cracked (breakage ticket open)");
      }
      if (stage === "enquiry") {
        if (designStatus === "uploaded") {
          noteParts.push("Design uploaded · Ready to send to client");
        } else if (designStatus === "approved") {
          noteParts.push("Design approved · Ready for quotation");
        } else if (designStatus === "rework") {
          noteParts.push("Client requested revisions on design");
        } else {
          noteParts.push("Brief logged · Waiting for designer");
        }
      }
      note = noteParts.join(" · ") || `${pHeadline} · ${totalQty} pcs`;
    }
  }

  let next = j.next || "";
  if (!next) {
    if (isJobCancelled) {
      next = "Job closed & locked";
    } else if (buckets.includes("pay")) next = "Collect the advance";
    else if (stage === "dtp") next = "Collect the advance";
    else if (buckets.includes("content")) next = "Get the name list / content";
    else if (buckets.includes("packed")) next = "Escalate with the courier or switch to Porter today";
    else if (buckets.includes("dispatchq")) next = "Confirm dispatch address, then pack";
    else if (stage === "aftersales") next = "Send 2 replacements and close the ticket";
    else if (buckets.includes("collections")) next = "Follow up for payment";
    else if (stage === "enquiry") {
      if (designStatus === "uploaded") next = "Share design options with client";
      else if (designStatus === "approved") next = "Send quotation to client";
      else next = "Follow up with designer for artwork";
    } else {
      next = "Open job for next action";
    }
  }

  return {
    id: j.enquiry_no || formatEnquiryNo(j.seq),
    _id: j._id,
    seq: j.seq,
    step: j.step || 0,
    customerId: j.customer_id?._id || j.customer_id,
    customer_id: j.customer_id,
    product: pHeadline,
    qty: totalQty,
    client: j.customer_id?.name || "Client",
    amount: j.financials?.total || j.amount || 0,
    stage: isJobCancelled ? "cancelled" : stage,
    hold: isHold,
    is_lost: isJobCancelled,
    lost_reason: j.lost_reason || j.wizard_state?.lost || "",
    buckets: buckets.length > 0 ? buckets : ["enquiry"],
    due: due,
    ageDays: ageDays,
    score: j.wizard_state?.score || j.score || 400,
    exec: j.coordinator_name || j.wizard_state?.coordinator || (j.assigned_to?.name) || "Meera Joshi",
    created_by_name: j.created_by_name || j.created_by_user?.name || (typeof j.created_by === "object" && j.created_by?.name ? j.created_by.name : null) || (Array.isArray(j.history) && j.history[0]?.changed_by?.user_name ? j.history[0].changed_by.user_name : null) || j.coordinator_name || null,
    note: note,
    next: next,
    designStatus: designStatus,
    designNeeded: j.the_brief?.design_needed ?? j.wizard_state?.e?.designer ?? true,
    designerName: j.the_brief?.designer_name || j.wizard_state?.e?.designer_name || j.wizard_state?.e?.assignedDesignerName || "",
    wizard_state: j.wizard_state,
    rawJob: j,
  };
};

export const mapCustomerToClientProfile = (c, liveStats = null) => {
  if (!c || typeof c !== "object") return null;

  const contactsList = [];
  if (c.contact_person && String(c.contact_person).trim() && String(c.contact_person).trim().toLowerCase() !== "primary contact") {
    contactsList.push({
      id: "ct1",
      name: c.contact_person,
      email: c.email || "",
      phone: String(c.mobile_no || ""),
      role: "Primary",
      last: true,
    });
  }

  const others = [
    ...(Array.isArray(c.contacts) ? c.contacts : []),
    ...(Array.isArray(c.additional_contacts) ? c.additional_contacts : []),
  ];

  others.forEach((ac, i) => {
    if (ac && ac.name && String(ac.name).trim() && String(ac.name).trim().toLowerCase() !== "primary contact") {
      const cleanName = String(ac.name).trim();
      const existing = contactsList.find((x) => x.name?.trim().toLowerCase() === cleanName.toLowerCase());
      if (!existing) {
        contactsList.push({
          id: ac._id ? String(ac._id) : (ac.id || `ct_${i}`),
          name: cleanName,
          email: ac.email || "",
          phone: String(ac.mobile_no || ac.phone || ""),
          role: ac.role || "Member",
          last: contactsList.length === 0,
        });
      } else if (ac._id && !String(existing.id).startsWith("67")) {
        existing.id = String(ac._id);
      }
    }
  });

  const baseEnqs = c.stats?.enquiries_count ?? c.enquiries_count ?? 0;
  const baseWon = c.stats?.won_count ?? c.won_count ?? 0;
  const effEnqs = liveStats?.stats?.total_enquiries ?? baseEnqs;
  const effWon = liveStats?.stats?.completed_jobs ?? baseWon;
  const effJobs =
    liveStats?.stats?.in_process_jobs ??
    c.stats?.total_jobs ??
    (effWon === 0 && effEnqs > 0 ? effEnqs : 0);

  return {
    id: c._id || c.id,
    name: c.name || "Client",
    contact_person: c.contact_person || "",
    mobile_no: c.mobile_no || null,
    email: c.email || "",
    gstin: c.gstin || c.address?.[0]?.gst_no || "",
    gst_status: c.gst_status || (c.unregistered ? "none" : (c.gstPending ? "later" : "have")),
    unregistered: c.unregistered || c.gst_status === "none",
    billing:
      formatAddress(c.address?.[0]) ||
      formatAddress(c.billing) ||
      formatAddress(c.address) ||
      "",
    short: c.short_name || (c.name ? c.name.slice(0, 2).toUpperCase() : "CL"),
    hue: c.color_hue || "ind",
    terms: c.terms_text || "50% advance against order",
    advance_percentage: c.advance_percentage !== undefined ? c.advance_percentage : 50,
    credit_days: c.credit_days || 0,
    owner:
      c.owner_name ||
      c.owner?.name ||
      c.owner_user?.name ||
      (typeof c.owner === "string" && !/^[0-9a-fA-F]{24}$/.test(c.owner) ? c.owner : "") ||
      c.account_manager ||
      c.rd_account_manager ||
      c.account_person ||
      "",
    since: c.since_year || 2020,
    jobs: effJobs,
    winRate: effEnqs ? Math.round((effWon / effEnqs) * 100) : 0,
    enqs: effEnqs,
    won: effWon,
    avgOrder: c.stats?.avg_order_value || 0,
    season: c.season_insight || "",
    lastEnq: c.stats?.last_enquiry_summary || "",
    overdue: liveStats?.stats?.realtime_outstanding ?? c.outstanding_amount ?? 0,
    origin: c.enquiries_origin || "Email",
    live: liveStats?.live_jobs || [],
    pastOrders: liveStats?.past_orders?.length > 0 ? liveStats.past_orders : c.pastOrders || [],
    contacts: contactsList,
    address: Array.isArray(c.address) ? c.address : [],
    shipTos:
      Array.isArray(c.address) && c.address.length > 0
        ? c.address.map((a, i) => {
            const fullAddr = a.address || `${a.address_1 || ""}${a.address_2 ? ", " + a.address_2 : ""}`.trim();
            return {
              id: a._id ? String(a._id) : (a.id || `sh_${i}`),
              label: a.label || (a.city ? `${a.city} Office` : `Address ${i + 1}`),
              address: fullAddr,
              city: a.city || "",
              pin: a.postal_code || a.pin || "",
              last: i === 0,
              site_contact: a.site_contact || "",
              site_phone: a.site_phone || "",
            };
          })
        : Array.isArray(c.shipTos)
        ? c.shipTos
        : [],
  };
};

/**
 * Validates whether the Enquiry state can progress from Step 2 (Brief) to subsequent steps.
 * Enforces:
 * 1. Brief text entered (global or per product).
 * 2. Designer selection if designer needed is enabled (global or per product).
 *
 * @param {Object} s - Current enquiry wizard state
 * @returns {{ isValid: boolean, error?: string }}
 */
export const validateBriefStepProgression = (s) => {
  const e = s?.e || {};
  const trophyGroups = e.trophyGroups || [];
  const products =
    trophyGroups.length > 0
      ? trophyGroups.map((g, idx) => ({ name: g.theme || `Product ${idx + 1}`, kind: g.kind }))
      : [{ name: e.theme || "Custom Trophy", kind: e.askMode }];
  const isAllReady = products.length > 0 && products.every((p) => p.kind === "ready");
  const briefMode = e.briefMode || (products.length > 1 ? "each" : "one");

  if (briefMode === "each") {
    const productBriefs = e.productBriefs || s?.the_brief?.product_briefs || {};
    const missingBrief = products.filter((p) => {
      const pb = productBriefs[p.name] || productBriefs[p.theme];
      return !pb?.brief?.trim();
    });
    if (missingBrief.length > 0) {
      return {
        isValid: false,
        error:
          missingBrief.length === 1
            ? `Please enter brief for "${missingBrief[0].name}" before proceeding`
            : `Please enter brief for all products (${missingBrief.map((m) => m.name).join(", ")}) before proceeding`,
      };
    }

    const missingDesigner = products.filter((p) => {
      if (p.kind === "ready") return false;
      const pb = productBriefs[p.name] || productBriefs[p.theme] || {};
      const isNeeded =
        pb.designer !== undefined ? Boolean(pb.designer) : e.designer !== false;
      if (!isNeeded) return false;
      const assigned =
        pb.assignedDesigner !== undefined
          ? pb.assignedDesigner
          : e.assignedDesigner !== undefined
            ? e.assignedDesigner
            : (e.designer_id || s?.the_brief?.designer_id || "");
      return !(assigned?.trim?.() || assigned);
    });

    if (missingDesigner.length > 0) {
      return {
        isValid: false,
        error:
          missingDesigner.length === 1
            ? `Please select a designer for "${missingDesigner[0].name}" before proceeding`
            : `Please select a designer for all products (${missingDesigner.length} missing) before proceeding`,
      };
    }
  } else {
    const hasBrief = Boolean(e.globalBrief?.trim() || s?.the_brief?.brief_text?.trim());
    if (!hasBrief) {
      return {
        isValid: false,
        error: "Please enter brief details before proceeding",
      };
    }

    const isDesignerNeeded = isAllReady ? false : e.designer !== false;
    const assigned =
      e.assignedDesigner !== undefined
        ? e.assignedDesigner
        : (e.designer_id || s?.the_brief?.designer_id || "");
    if (isDesignerNeeded && !(assigned?.trim?.() || assigned)) {
      return {
        isValid: false,
        error: "Please select a designer before proceeding",
      };
    }
  }

  return { isValid: true };
};

// Deeply sanitizes wizard_state to strip recursive backend caches (like rawJob)
// and prevent MongoServerError: Nested BSON depth greater than 50 not allowed
export const sanitizeWizardState = (obj, depth = 0, seen = new WeakSet()) => {
  if (!obj || typeof obj !== "object") return obj;
  if (depth >= 8 || seen.has(obj)) return undefined;
  seen.add(obj);

  if (Array.isArray(obj)) {
    return obj
      .map((item) => sanitizeWizardState(item, depth + 1, seen))
      .filter((x) => x !== undefined);
  }

  const clean = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === "rawJob" || k === "raw_job" || k === "wizard_state") continue;
    const cleaned = sanitizeWizardState(v, depth + 1, seen);
    if (cleaned !== undefined) clean[k] = cleaned;
  }
  return clean;
};
