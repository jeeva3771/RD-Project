import React, { useState, useEffect } from 'react';
import { ArrowLeft, FileText, AlertCircle, Package, CheckCircle2 } from 'lucide-react';
import { InfoItem } from './InfoItem';
import { SummaryRow } from './SummaryRow';
import { axiosInstance } from '../../../../utils/url/config';

export function InvoicePage({ job, onBack, onSubmit }) {
  const invoiced = job.invoiced_qty !== undefined
    ? Number(job.invoiced_qty)
    : ((Array.isArray(job.invoices) ? job.invoices.reduce((s, i) => s + (Number(i.qty) || 0), 0) : 0) || Number(job.invoice?.qty) || 0);
  const inwardReceived = Number(job.inward?.received !== undefined ? job.inward.received : (job.inward_qty !== undefined ? job.inward_qty : job.order_qty || 0));
  const pending = Math.max(0, inwardReceived - invoiced);

  const [qty, setQty] = useState(pending > 0 ? pending : '');
  const [pricePerQty, setPricePerQty] = useState(job.unit_price || '');
  const [gstPct, setGstPct] = useState('0');
  const [selectedTaxId, setSelectedTaxId] = useState('');
  const [gstTaxes, setGstTaxes] = useState([]);
  const [loadingTaxes, setLoadingTaxes] = useState(true);
  const [customerTaxInfo, setCustomerTaxInfo] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [qtyErr, setQtyErr] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focused, setFocused] = useState('');

  // Fetch active GST taxes from Tax Master and resolve Customer Master GST default
  useEffect(() => {
    let isMounted = true;
    const fetchTaxesAndCustomer = async () => {
      try {
        setLoadingTaxes(true);
        // 1. Fetch active GST taxes from Tax Master
        const taxRes = await axiosInstance.get('/taxmaster', {
          params: { limit: 'all', status: true }
        });

        let activeGst = [];
        if (taxRes.data?.success && Array.isArray(taxRes.data.data)) {
          activeGst = taxRes.data.data.filter(t => t.is_active && t.tax_type === 'GST');
          if (isMounted) setGstTaxes(activeGst);
        }

        // 2. Resolve Customer GST configuration
        let custTaxId = job.customer_gst_tax || null;
        let custTaxRate = (job.customer_gst_rate !== undefined && job.customer_gst_rate !== null) ? Number(job.customer_gst_rate) : null;
        let custTaxName = job.customer_gst_name || null;

        // If not directly present on job, try fetching from Customer Master by client_name
        if ((custTaxRate === null || isNaN(custTaxRate)) && job.client_name) {
          try {
            const custRes = await axiosInstance.get('/customer', {
              params: { search: job.client_name.trim(), limit: 5 }
            });
            const custData = custRes.data?.data || custRes.data;
            if (Array.isArray(custData)) {
              const matched = custData.find(c => c.name?.trim().toLowerCase() === job.client_name.trim().toLowerCase());
              if (matched) {
                custTaxId = matched.gst_tax?._id || matched.gst_tax || null;
                custTaxRate = matched.gst_tax?.tax_rate !== undefined 
                  ? Number(matched.gst_tax.tax_rate) 
                  : (matched.gst_rate !== undefined ? Number(matched.gst_rate) : null);
                custTaxName = matched.gst_tax?.tax_name || null;
              }
            }
          } catch (e) {
            console.warn('Could not lookup customer by client_name:', e);
          }
        }

        // 3. Set default tax
        if (custTaxRate !== null && !isNaN(custTaxRate)) {
          const matchedTax = activeGst.find(t => (custTaxId && t._id === custTaxId) || Number(t.tax_rate) === custTaxRate);
          const finalInfo = {
            id: custTaxId,
            rate: custTaxRate,
            tax_name: matchedTax?.tax_name || custTaxName || `GST ${custTaxRate}%`
          };
          if (isMounted) {
            setCustomerTaxInfo(finalInfo);
            setGstPct(String(custTaxRate));
            setSelectedTaxId(matchedTax?._id || (custTaxId || ''));
          }
        } else {
          // If no customer default, pick 18% or first available or 0%
          if (activeGst.length > 0) {
            const defaultChoice = activeGst.find(t => t.tax_rate === 18) || activeGst[0];
            if (isMounted) {
              setGstPct(String(defaultChoice.tax_rate));
              setSelectedTaxId(defaultChoice._id);
            }
          } else {
            if (isMounted) {
              setGstPct('0');
              setSelectedTaxId('');
            }
          }
        }
      } catch (err) {
        console.error('Failed to load tax master in InvoicePage:', err);
      } finally {
        if (isMounted) setLoadingTaxes(false);
      }
    };

    fetchTaxesAndCustomer();
    return () => { isMounted = false; };
  }, [job]);

  const handleQtyChange = (raw) => {
    if (raw.includes('-')) return;
    const val = raw === '' ? '' : Number(raw);
    setQty(val);
    if (val !== '') {
      if (val > pending) setQtyErr(`Cannot exceed ${pending} ${job.uom} pending`);
      else if (val < 1) setQtyErr(`Min 1 ${job.uom} required`);
      else setQtyErr('');
    } else setQtyErr('');
  };

  const numQty = Number(qty) || 0;
  const numPrice = Number(pricePerQty) || 0;
  const numGst = Number(gstPct);
  const subtotal = Number((numQty * numPrice).toFixed(2));
  const gstAmt = Number((subtotal * (numGst / 100)).toFixed(2));
  const totalAmt = Number((subtotal + gstAmt).toFixed(2));

  const canSubmit = pending > 0 && numQty > 0 && numPrice > 0 && !qtyErr;

  const handleGenerate = async () => {
    if (!canSubmit || isSubmitting) return;
    setIsSubmitting(true);
    await onSubmit(job.id, {
      qty: numQty,
      pricePerQty: numPrice,
      gstPct: numGst,
      gst_tax: selectedTaxId || null,
      subtotal,
      gstAmt,
      totalAmt,
      remarks
    });
    setIsSubmitting(false);
  };

  const inputStyle = (key, hasErr) => ({
    width: '100%',
    padding: '11px 12px',
    fontSize: 16,
    fontWeight: 800,
    border: `1.5px solid ${hasErr ? '#EF4444' : focused === key ? '#7C3AED' : 'var(--bdr)'}`,
    borderRadius: 8,
    outline: 'none',
    transition: 'border-color .15s ease, box-shadow .15s ease',
    boxShadow: focused === key && !hasErr ? '0 0 0 3px rgba(124,58,237,0.12)' : 'none',
  });

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <button
        onClick={onBack}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--txt2)', fontSize: 13, fontWeight: 800, cursor: 'pointer', marginBottom: 16, padding: '8px 0' }}
      >
        <ArrowLeft size={15} strokeWidth={2.5} /> Back
      </button>

      <div className="card" style={{ overflow: 'hidden', boxShadow: '0 4px 24px rgba(91,33,182,0.10)', borderRadius: 14 }}>
        <div style={{ background: 'linear-gradient(135deg, #5B21B6, #7C3AED)', padding: '22px 24px 20px', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={16} color="#fff" strokeWidth={2.5} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: 1 }}>Generate Invoice</div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#E9D5FF', textAlign: 'center' }}>Job No: {job.job_no} · {job.product}</div>
        </div>

        <div style={{ padding: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 20px', background: '#FAF5FF', border: '1px solid #E9D5FF', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
            <InfoItem label="Order Qty" value={`${job.order_qty} ${job.uom}`} />
            <InfoItem label="Already Invoiced" value={`${invoiced} ${job.uom}`} />
          </div>

          {pending <= 0 && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
              <AlertCircle size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 12, fontWeight: 700, color: '#DC2626' }}>
                No pending received quantity to invoice. Inward more items first.
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--txt2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3 }}>Qty to Invoice</label>
              <input
                type="number"
                disabled={pending <= 0}
                value={qty}
                placeholder={`Max ${pending}`}
                onChange={e => handleQtyChange(e.target.value)}
                onFocus={() => setFocused('qty')}
                onBlur={() => setFocused('')}
                style={inputStyle('qty', !!qtyErr)}
              />
              {qtyErr ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 800, color: '#EF4444', marginTop: 5, textTransform: 'uppercase' }}>
                  <AlertCircle size={11} /> {qtyErr}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: 'var(--txt3)', marginTop: 5 }}>
                  <Package size={11} /> of {pending} {job.uom} pending
                </div>
              )}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--txt2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3 }}>Per Qty Price (₹)</label>
              <input
                type="number"
                readOnly
                disabled={pending <= 0}
                value={pricePerQty}
                placeholder="e.g. 10"
                style={{ width: '100%', padding: '11px 12px', fontSize: 16, fontWeight: 800, border: '1.5px solid var(--bdr)', borderRadius: 8, backgroundColor: '#F8FAFC', color: '#64748B', cursor: 'not-allowed' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
                GST Tax Rate
              </label>
              {customerTaxInfo && (
                <span style={{ fontSize: 11, color: '#2563EB', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>⭐ Customer Master:</span>
                  <strong>{customerTaxInfo.tax_name} ({customerTaxInfo.rate}%)</strong>
                </span>
              )}
            </div>

            {/* Customer Default Highlight Banner */}
            {customerTaxInfo && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: 8,
                marginBottom: 8,
                background: Number(gstPct) === customerTaxInfo.rate ? '#F0FDF4' : '#FFFBEB',
                border: `1px solid ${Number(gstPct) === customerTaxInfo.rate ? '#BBF7D0' : '#FDE68A'}`,
                transition: 'all 0.2s ease'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13 }}>{Number(gstPct) === customerTaxInfo.rate ? '✓' : '⚡'}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: Number(gstPct) === customerTaxInfo.rate ? '#166534' : '#92400E' }}>
                    {Number(gstPct) === customerTaxInfo.rate
                      ? `Selected from Customer Master: ${customerTaxInfo.tax_name} (${customerTaxInfo.rate}%)`
                      : `Customized Tax (${customerTaxInfo.rate}% default → ${numGst}%)`}
                  </span>
                </div>
                {Number(gstPct) !== customerTaxInfo.rate && (
                  <button
                    type="button"
                    onClick={() => {
                      setGstPct(String(customerTaxInfo.rate));
                      const match = gstTaxes.find(t => t.tax_rate === customerTaxInfo.rate || t._id === customerTaxInfo.id);
                      setSelectedTaxId(match?._id || customerTaxInfo.id || '');
                    }}
                    style={{
                      background: '#F59E0B',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      padding: '3px 8px',
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    Reset to Default
                  </button>
                )}
              </div>
            )}

            <select
              disabled={pending <= 0 || loadingTaxes}
              value={selectedTaxId || (Number(gstPct) === 0 ? "0" : gstPct)}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "0" || val === "") {
                  setSelectedTaxId("");
                  setGstPct("0");
                } else {
                  const match = gstTaxes.find(t => t._id === val || String(t.tax_rate) === String(val));
                  if (match) {
                    setSelectedTaxId(match._id);
                    setGstPct(String(match.tax_rate));
                  } else {
                    setSelectedTaxId("");
                    setGstPct(val);
                  }
                }
              }}
              onFocus={() => setFocused('gst')}
              onBlur={() => setFocused('')}
              style={{
                ...inputStyle('gst', false),
                fontSize: 13,
                cursor: pending <= 0 ? 'not-allowed' : 'pointer',
                appearance: 'auto',
                borderColor: customerTaxInfo && Number(gstPct) === customerTaxInfo.rate ? '#10B981' : (focused === 'gst' ? '#7C3AED' : 'var(--bdr)')
              }}
            >
              <option value="0">0% (No GST)</option>
              {gstTaxes.map(tax => {
                const isCustDefault = customerTaxInfo && (tax._id === customerTaxInfo.id || tax.tax_rate === customerTaxInfo.rate);
                return (
                  <option key={tax._id} value={tax._id}>
                    {tax.tax_name} ({tax.tax_rate}%) {isCustDefault ? '⭐ [Customer Master Default]' : ''}
                  </option>
                );
              })}
            </select>
            {loadingTaxes && (
              <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 4 }}>Loading active taxes from Tax Master...</div>
            )}
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--txt2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3 }}>Terms & Conditions (optional)</label>
            <textarea
              style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${focused === 'remarks' ? '#7C3AED' : 'var(--bdr)'}`, borderRadius: 8, fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit', transition: 'border-color .15s ease' }}
              rows="2"
              placeholder="Add any terms & conditions..."
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              onFocus={() => setFocused('remarks')}
              onBlur={() => setFocused('')}
            />
          </div>

          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: 16, marginBottom: 20 }}>
            <SummaryRow label={`Subtotal (${numQty} × ₹${numPrice || 0})`} value={subtotal} />
            <SummaryRow label={`GST Amt (${numGst}%)`} value={gstAmt} />
            <div style={{ height: 1, background: '#E2E8F0', margin: '10px 0' }} />
            <SummaryRow label="Total Amount" value={totalAmt} big />
          </div>

          <button
            style={{
              width: '100%',
              padding: '15px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              background: canSubmit && !isSubmitting ? 'linear-gradient(135deg, #5B21B6, #7C3AED)' : '#E2E8F0',
              color: canSubmit && !isSubmitting ? '#fff' : '#94A3B8',
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 800,
              cursor: canSubmit && !isSubmitting ? 'pointer' : 'not-allowed',
              boxShadow: canSubmit && !isSubmitting ? '0 4px 14px rgba(124,58,237,0.35)' : 'none',
              transition: 'box-shadow .15s ease, transform .1s ease',
            }}
            disabled={!canSubmit || isSubmitting}
            onClick={handleGenerate}
          >
            {isSubmitting ? (
              'Generating...'
            ) : canSubmit ? (
              <>
                <CheckCircle2 size={16} strokeWidth={2.5} />
                Generate Invoice — ₹{totalAmt.toFixed(2)}
              </>
            ) : pending <= 0 ? (
              'No Qty to Invoice'
            ) : numPrice === 0 ? (
              'Enter Per Qty Price'
            ) : (
              'Enter Qty to Invoice'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}