import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchAllCustomers } from "../../reducer/customerReducer";
import { axiosInstance } from "../../utils/url/config";
import "./EnquiryFlow.css";
import JobsBoard from "./components/JobsBoard";
import ClientStep from "./components/Steps/ClientStep";
import AskStep from "./components/Steps/AskStep";
import BriefStep from "./components/Steps/BriefStep";
import LogStep from "./components/Steps/LogStep";
import ModeStep from "./components/Steps/ModeStep";
import DetailsStep from "./components/Steps/DetailsStep";
import SendStep from "./components/Steps/SendStep";
import JobCard from "./components/JobCard";
import StageBar from "./components/common/StageBar";
import { heatOf, finOf } from "./utils/helpers";
import { toast } from "react-toastify";

const STEPS = [
  { label: "Client", g: "Enquiry" },
  { label: "The ask", g: "Enquiry" },
  { label: "Brief", g: "Enquiry" },
  { label: "Log and track", g: "Enquiry" },
  { label: "Sample or production", g: "Order" },
  { label: "Essentials", g: "Order" },
  { label: "Send", g: "Order" },
];

const Q = [
  [
    "Who’s asking?",
    "Start typing. You’ll see their outstanding, win rate and habits before you commit to anything.",
  ],
  [
    "What do they want?",
    "Custom designed, ready trophies, or both. Add each product with its sizes, quantities and approximate rates.",
  ],
  [
    "Give design the brief",
    "One brief for everything, or a brief for each product. Add references, the brief and how many design options.",
  ],
  [
    "Log it",
    "Who asked and how it came in. The heat score sets its place in the queue.",
  ],
  [
    "Sample first, or straight to production?",
    "The enquiry becomes the order. Same job number, nothing re-entered.",
  ],
  [
    "Just the essentials",
    "Only what’s new at order stage: quantity, date, where and how it ships.",
  ],
  [
    "Ready to start the order?",
    "The job card on the right is exactly what the shop floor will see.",
  ],
];

const EnquiryFlow = () => {
  const dispatch = useDispatch();
  const { customers } = useSelector((state) => state.customer);
  const [view, setView] = useState("board");
  const [seqCount, setSeqCount] = useState(21072);
  const [boardJobs, setBoardJobs] = useState([]);

  let userRole = "";
  try {
    const rawUser = localStorage.getItem("user");
    if (rawUser) {
      const u = JSON.parse(rawUser);
      userRole = String(u?.role?.name || u?.role_obj?.name || u?.role || "").toLowerCase();
    }
  } catch (e) {
    // ignore error reading local user
  }

  const fetchBoardJobs = async () => {
    try {
      const res = await axiosInstance.get("/enquiry-flow");
      if (res.data?.data) {
        const todayStr = new Date().toISOString().slice(0, 10);
        const mapped = res.data.data.map((j) => {
          const stage = j.stage || "enquiry";
          const rawDue = j.delivery_details?.delivery_date || j.order_mode?.production_date || j.order_mode?.sample_date || j.the_ask?.delivery_date || j.the_ask?.event_date || null;
          const due = rawDue ? String(rawDue).slice(0, 10) : null;
          const isDueToday = due === todayStr;

          const buckets = [];
          if (j.is_lost || stage === "cancelled" || stage === "lost") {
            buckets.push("cancelled");
          } else {
            // "today" bucket: ONLY when active sample/production/dispatch is actually due today!
            if (isDueToday && ["sample", "production", "ready_for_dispatch", "packing"].includes(stage)) {
              buckets.push("today");
            }
            if (stage === "enquiry" || stage === "brief") {
              buckets.push("enquiry");
            } else if (stage === "sample") {
              buckets.push(j.wizard_state?.approved ? "sappr" : "sampling");
            } else if (stage === "production") {
              buckets.push("push");
            } else if (stage === "ready_for_dispatch") {
              buckets.push("dispatchq");
            } else if (stage === "packed") {
              buckets.push("packed");
            } else if (stage === "aftersales") {
              buckets.push("aftersales");
            } else if (stage === "closed" || stage === "delivered") {
              buckets.push((j.financials?.balance || 0) > 0 ? "collections" : "reviews");
            } else {
              buckets.push(stage);
            }
          }

          return {
            id: j.enquiry_no || `RD${j.seq}`,
            _id: j._id,
            customerId: j.customer_id?._id || j.customer_id,
            customer_id: j.customer_id,
            product: j.the_ask?.product_name || j.the_ask?.theme || "Custom Trophy",
            client: j.customer_id?.name || "Client",
            amount: j.financials?.total || 0,
            stage: stage,
            is_lost: j.is_lost,
            buckets: buckets.length > 0 ? buckets : ["enquiry"],
            due: due,
            wizard_state: j.wizard_state,
            rawJob: j,
          };
        });
        setBoardJobs(mapped);
      }
    } catch (err) {
      console.warn("Could not load board jobs:", err);
    }
  };

  const REAL_CLIENTS = (customers || []).map((c) => {
    const cId = String(c._id || c.id);
    const clientJobs = (boardJobs || []).filter((j) => {
      const jCustId = String(j.customerId || j.customer_id?._id || j.customer_id || "");
      const jCustName = (j.client || j.customer_id?.name || "").trim().toLowerCase();
      const cName = (c.name || "").trim().toLowerCase();
      return (jCustId && jCustId === cId) || (jCustName && jCustName === cName);
    });

    const inProcessJobs = clientJobs.length > 0
      ? clientJobs.filter((j) => ["brief", "sample", "production", "ready_for_dispatch", "dispatched"].includes(j.stage) && !j.is_lost).length
      : (c.stats?.total_jobs || 0);

    const totalEnqs = clientJobs.length > 0 ? clientJobs.length : (c.stats?.enquiries_count || 0);

    const wonCount = clientJobs.length > 0
      ? clientJobs.filter((j) => ["sample", "production", "ready_for_dispatch", "dispatched", "delivered", "closed"].includes(j.stage)).length
      : (c.stats?.won_count || 0);

    const clientLive = clientJobs.length > 0
      ? clientJobs
          .filter((j) => !j.is_lost && ["brief", "sample", "production", "ready_for_dispatch"].includes(j.stage))
          .map((j) => ({
            id: j.id,
            product: j.product,
            qty: j.rawJob?.delivery_details?.quantity || 100,
            stage: j.stage,
            value: j.amount || 0,
            adv: j.rawJob?.financials?.advance_required || 0,
            recd: j.rawJob?.financials?.advance_received || 0,
            sample: j.stage === "sample",
            sub_jobs: j.rawJob?.sub_jobs || [],
          }))
      : (c.live_jobs || []);

    return {
      id: c._id || c.id,
      name: c.name,
      gstin: c.address?.[0]?.gst_no || "",
      billing: (c.address?.[0] && c.address[0].address_1)
        ? `${c.address[0].address_1}${c.address[0].address_2 ? ', ' + c.address[0].address_2 : ''}, ${c.address[0].city || ''} ${c.address[0].postal_code || ''}`.trim()
        : (typeof c.billing === "string" ? c.billing : ""),
      short: c.short_name || c.name.slice(0, 2).toUpperCase(),
      hue: c.color_hue || "ind",
      terms: c.terms_text || "50% advance against order",
      advance_percentage: c.advance_percentage !== undefined ? c.advance_percentage : 50,
      credit_days: c.credit_days || 0,
      owner: (c.owner_name || c.owner?.name || c.owner_user?.name || (typeof c.owner === 'string' && !/^[0-9a-fA-F]{24}$/.test(c.owner) ? c.owner : '') || c.account_manager || c.rd_account_manager || c.account_person || ''),
      since: c.since_year || 2020,
      jobs: inProcessJobs,
      winRate: totalEnqs ? Math.round((wonCount / totalEnqs) * 100) : 0,
      enqs: totalEnqs,
      won: wonCount,
      avgOrder: c.stats?.avg_order_value || 0,
      season: c.season_insight || "",
      lastEnq: c.stats?.last_enquiry_summary || "",
      overdue: c.outstanding_amount || 0,
      origin: c.enquiries_origin || "Email",
      live: clientLive,
      contacts: (() => {
        const list = [];
        if (c.contact_person) {
          list.push({
            id: "ct1",
            name: c.contact_person,
            email: c.email || "",
            phone: String(c.mobile_no || ""),
            role: "Primary",
            last: true,
          });
        }
        const others = Array.isArray(c.additional_contacts) && c.additional_contacts.length > 0
          ? c.additional_contacts
          : (Array.isArray(c.contacts) ? c.contacts.filter((x) => !x.is_primary) : []);

        others.forEach((ac, i) => {
          if (ac.name && !list.some((x) => x.name?.trim().toLowerCase() === ac.name.trim().toLowerCase())) {
            list.push({
              id: ac._id ? String(ac._id) : (ac.id || `ct_add_${i}`),
              name: ac.name,
              email: ac.email || "",
              phone: String(ac.mobile_no || ""),
              role: ac.role || "Member",
              last: false,
            });
          }
        });
        return list.length > 0 ? list : [{ id: "ct1", name: c.name, email: "", phone: "", role: "Contact" }];
      })(),
      shipTos: Array.isArray(c.address) && c.address.length > 0 && c.address[0].address_1
        ? c.address.map((a, i) => ({
            id: `sh_${i}`,
            label: a.label || `${a.city || 'Billing'} Office`,
            address: `${a.address_1 || ''}${a.address_2 ? ', ' + a.address_2 : ''}`,
            city: a.city,
            pin: a.postal_code,
            last: i === 0,
          }))
        : (Array.isArray(c.shipTos) ? c.shipTos : []),
    };
  });

  const [s, setS] = useState({
    step: 0,
    e: { type: "Trophy", theme: "Custom Trophy", askMode: "custom" },
    clientId: null,
    enqSent: false,
    mode: null,
    qty: 0,
    leadDate: null,
    sent: false,
    seq: 21072,
    charge: "foc",
    sampleRate: 0,
  });

  const syncJobToBackend = async (currentState) => {
    if (!currentState.clientId) return;
    try {
      const parentNo = `RD${currentState.seq}`;
      const subJobs = [];
      if (currentState.e?.trophyGroups && Array.isArray(currentState.e.trophyGroups)) {
        currentState.e.trophyGroups.forEach((group, gIdx) => {
          const groupChar = String.fromCharCode(65 + gIdx);
          (group.items || [{ size: 8, qty: currentState.qty || 50 }]).forEach((item, sIdx) => {
            const subJobNo = `${parentNo}-${groupChar}${sIdx + 1}`;
            subJobs.push({
              sub_job_no: subJobNo,
              design_group: groupChar,
              size_variant: sIdx + 1,
              trophy_type: group.kind || "custom",
              sku: group.sku || "",
              theme: group.theme || currentState.e?.theme || "Custom Trophy",
              product_name: group.productName || currentState.e?.productName || "Custom Trophy",
              size: String(item.size || 8),
              material: Array.isArray(group.mats) ? group.mats.join(" + ") : (group.mat || "MDF"),
              quantity: item.qty || 0,
              target_rate: item.rate || item.budget || 0,
              line_total: (item.qty || 0) * (item.rate || item.budget || 0),
              stage: currentState.sent
                ? (currentState.mode === "sample" ? "sample" : "production")
                : (currentState.enqSent ? "brief" : "enquiry"),
            });
          });
        });
      }

      const payload = {
        enquiry_no: parentNo,
        seq: currentState.seq,
        step: currentState.step,
        customer_id: currentState.clientId,
        contact_id: currentState.contactId,
        ship_to_id: currentState.shipToId,
        coordinator_name: currentState.coordinator,
        sub_jobs: subJobs,
        the_ask: {
          product_type: currentState.e?.type || "Trophy",
          theme: currentState.e?.theme || "Custom Trophy",
          ask_mode: currentState.e?.askMode || "custom",
          sku: currentState.e?.sku,
          product_name: currentState.e?.productName,
          size: currentState.e?.size,
          material: currentState.e?.material,
          quantity: currentState.e?.qty || currentState.qty || 0,
          approx_budget: currentState.e?.approxBudget,
          budget_none: currentState.e?.budgetNone || false,
          event_date: currentState.e?.eventDate,
          delivery_date: currentState.e?.deliveryDate,
        },
        the_brief: {
          brief_text: currentState.brief,
          design_needed: currentState.designNeeded ?? true,
          options_count: currentState.optionsCount || 2,
          ref_files: currentState.refFiles || [],
          client_logo: currentState.clientLogo || [],
          show_logo: currentState.showLogo ?? currentState.e?.showRDLogo ?? false,
          show_content: currentState.showContent ?? currentState.e?.showRDContent ?? false,
          content_text: currentState.contentDetails || currentState.e?.copyrightContent || currentState.e?.copyright_content || "",
          copyright_content: currentState.e?.copyrightContent || currentState.e?.copyright_content || "",
        },
        log_track: {
          origin: currentState.origin || "Email",
          heat_score: currentState.heatScore || 50,
          heat_label: currentState.heatLabel || "Warm",
          proof_type: currentState.proofType,
          proof_file: currentState.proofFile,
          internal_notes: currentState.internalNotes,
          enq_sent: currentState.enqSent || false,
          sent_at: currentState.enqSent ? new Date() : undefined,
        },
        order_mode: {
          mode: currentState.mode,
          charge: currentState.charge || "foc",
          sample_rate: currentState.sampleRate || 0,
          sample_qty: currentState.sampleQty || 1,
          sample_approved: currentState.approved || false,
          sample_date: currentState.sampleDate,
          production_date: currentState.productionDate,
        },
        delivery_details: {
          quantity: currentState.qty || currentState.finalQty || 0,
          target_rate: currentState.jobRate,
          client_po: currentState.clientPo,
          delivery_mode: currentState.deliveryMode,
          delivery_cost: currentState.deliveryCost || 0,
          who_pays: currentState.whoPays || "Client",
          shipping_address: currentState.shipTo,
        },
        financials: {
          subtotal: currentState.subtotal || 0,
          gst_rate: currentState.gstRate || 18,
          gst_amount: currentState.gstAmount || 0,
          total: currentState.finalTotal || 0,
          advance_percentage: currentState.advPct || 50,
          advance_required: currentState.advDue || 0,
          advance_received: currentState.advRecd || 0,
          advance_txn_id: currentState.advTxn,
          advance_date: currentState.advDate,
          balance: currentState.balance || 0,
          payment_status: currentState.paymentStatus || "pending",
          proforma_no: currentState.proforma?.pno,
          proforma_date: currentState.proforma?.date,
          tax_invoice_no: currentState.tinv,
        },
        stage: currentState.sent
          ? (currentState.mode === "sample" ? "sample" : "production")
          : (currentState.enqSent ? "brief" : "enquiry"),
        wizard_state: currentState,
      };

      if (currentState.dbJobId) {
        await axiosInstance.put(`/enquiry-flow/${currentState.dbJobId}`, payload);
      } else {
        const res = await axiosInstance.post("/enquiry-flow", payload);
        if (res.data?.data?._id) {
          setS((prev) => ({ ...prev, dbJobId: res.data.data._id }));
        }
      }
      fetchBoardJobs();
      if (currentState.enqSent) {
        toast.success(`Enquiry ${parentNo} successfully logged and added to Jobs Board!`);
      }
    } catch (err) {
      console.warn("Could not sync enquiry job to backend:", err);
    }
  };

  const handleNewEnquiry = async () => {
    let nextSeq = seqCount + 1;
    try {
      const res = await axiosInstance.get("/enquiry-flow/next-number");
      if (res.data?.seq) {
        nextSeq = res.data.seq;
      }
    } catch (err) {
      console.log("Next sequence fallback:", err);
    }

    setSeqCount(nextSeq);
    setS({
      step: 0,
      e: { type: "Trophy", theme: "Custom Trophy", askMode: "custom" },
      clientId: null,
      enqSent: false,
      mode: null,
      qty: 0,
      leadDate: null,
      sent: false,
      seq: nextSeq,
      charge: "foc",
      sampleRate: 0,
      dbJobId: null,
    });
    setView("job");
  };

  const set = (p) => {
    if (!p) {
      handleNewEnquiry();
      return;
    }
    setS((prev) => {
      const updated = { ...prev, ...p };
      setTimeout(() => {
        if (p.enqSent || p.step !== undefined || p.sent || p.mode || p.clientId) {
          syncJobToBackend(updated);
        }
      }, 0);
      return updated;
    });
  };
  const next = () => {
    const nextStep = s.step + 1;
    set({ step: nextStep });
  };

  const handleGoToBoard = async () => {
    fetchBoardJobs();
    let nextSeq = seqCount + 1;
    try {
      const res = await axiosInstance.get("/enquiry-flow/next-number");
      if (res.data?.seq) {
        nextSeq = res.data.seq;
      }
    } catch (err) {
      console.log("Next sequence fallback:", err);
    }

    setSeqCount(nextSeq);
    setS({
      step: 0,
      e: { type: "Trophy", theme: "Custom Trophy", askMode: "custom" },
      clientId: null,
      enqSent: false,
      mode: null,
      qty: 0,
      leadDate: null,
      sent: false,
      seq: nextSeq,
      charge: "foc",
      sampleRate: 0,
      dbJobId: null,
    });
    setView("board");
  };

  useEffect(() => {
    dispatch(fetchAllCustomers({}));
    axiosInstance
      .get("/enquiry-flow/next-number")
      .then((res) => {
        if (res.data?.seq) {
          setSeqCount(res.data.seq);
          setS((prev) => ({ ...prev, seq: res.data.seq }));
        }
      })
      .catch((err) => console.log("Next enquiry seq fallback", err));
    fetchBoardJobs();
  }, [dispatch]);

  // Intercept any native window.alert calls inside enquiry-flow and redirect to toast notification
  useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (msg) => {
      toast.warn(String(msg || ""), { position: "top-right", autoClose: 4000 });
    };
    return () => {
      window.alert = originalAlert;
    };
  }, []);

  const currentClient = REAL_CLIENTS.find((c) => c.id === s.clientId);

  const curSeq = s.seq || seqCount;
  const currentIds = {
    enq: `RD${curSeq}`,
    qt: `QT${curSeq}`,
    cst: `CST${curSeq}`,
    s: `RD/S/${curSeq}`,
    p: `RD/P/${curSeq}`,
  };

  return (
    <div className="enquiry-flow-page app">
      <header
        className="top"
        style={{ justifyContent: "flex-end", gap: "10px" }}
      >
        {view !== "board" && (
          <button className="themebtn" onClick={handleGoToBoard}>
            ▦ Jobs board
          </button>
        )}
        <button className="themebtn" onClick={handleNewEnquiry}>
          + New enquiry
        </button>
      </header>

      {view === "board" ? (
        <div style={{ padding: "20px 24px", width: "100%", margin: "0" }}>
          <JobsBoard
            jobs={boardJobs}
            role={userRole}
            onOpen={(job) => {
              if (job.wizard_state) {
                setS({
                  ...job.wizard_state,
                  dbJobId: job._id,
                  seq: job.wizard_state.seq || parseInt(String(job.id || "").replace(/\D/g, ""), 10) || seqCount,
                });
                setView("job");
              }
            }}
            ex="all"
            clientStep={
              <div className="panel" style={{ marginBottom: "16px" }}>
                <b style={{ fontSize: "18px", fontFamily: "var(--display)" }}>
                  Start a new enquiry ({currentIds.enq})
                </b>
                <p
                  style={{
                    color: "var(--ink2)",
                    fontSize: "13px",
                    margin: "4px 0 16px",
                  }}
                >
                  Search a client, or pick one below. The job card automatically initializes as {currentIds.enq}.
                </p>
                <ClientStep
                  s={s}
                  set={(p) => {
                    set(p);
                    if (p && p.clientId) {
                      setView("job");
                    }
                  }}
                  next={() => {
                    set({ step: 1 });
                    setView("job");
                  }}
                  CLIENTS={REAL_CLIENTS}
                  onResume={() => setView("job")}
                />
              </div>
            }
          />
        </div>
      ) : (
        <div className="grid">
          <aside className="rail" style={{ background: "transparent", backgroundColor: "transparent", border: "none", boxShadow: "none" }}>
            <h1 className="railtitle">One job, start to finish</h1>
            <p className="railsub">
              Enquiry, sample and production on one card.
            </p>
            {STEPS.map((st, i) => {
              const active = s.step === i;
              const done = s.step > i;
              const showGroupHeader = i === 0 || STEPS[i - 1].g !== st.g;
              
              // Dynamic subtitle text for rail steps to match design
              let subText = st.sub;
              if (i === 0) {
                subText = currentClient ? currentClient.name : "Search or add";
              } else if (i === 1) {
                subText = s.e?.theme ? `${s.e.theme} · ${s.qty || s.e?.qty || 100} pcs` : "Crystal Wave Trophy · 100 pcs";
              } else if (i === 2) {
                subText = "Refs, design, options";
              } else if (i === 3) {
                subText = "Source, owner, heat";
              } else if (i === 4) {
                subText = "Unlocks when won";
              }

              return (
                <React.Fragment key={i}>
                  {showGroupHeader && (
                    <div className="rgroup">
                      <span>{st.g}</span>
                      {st.g === "Order" && <span className="lock">· unlocks when won</span>}
                    </div>
                  )}
                  <button
                    className={`rstep ${active ? "on" : ""} ${done ? "done" : ""}`}
                    onClick={() => set({ step: i })}
                  >
                    <span className="rdot">{done ? "✓" : i + 1}</span>
                    <span>
                      <span className="rlabel">{st.label}</span>
                      {subText && <div className="rsum">{subText}</div>}
                    </span>
                  </button>
                </React.Fragment>
              );
            })}
          </aside>

          <main className="stage">
            {s.step !== 6 && (
              <>
                <h2 className="q">{Q[s.step][0]}</h2>
                <p className="qs">{Q[s.step][1]}</p>

                {/* 9-Stage Lifecycle Bar */}
                <StageBar
                  s={s}
                  f={finOf(
                    s,
                    { rate: s.jobRate || 1000, product: s.e?.theme || "Custom Trophy" },
                    currentClient,
                    s.qty || 100
                  )}
                />
              </>
            )}

            {s.step === 0 && (
              <ClientStep s={s} set={set} next={next} CLIENTS={REAL_CLIENTS} />
            )}
            {s.step === 1 && <AskStep s={s} set={set} next={next} client={currentClient} />}
            {s.step === 2 && <BriefStep s={s} set={set} next={next} />}
            {s.step === 3 && (
              <LogStep
                s={s}
                set={set}
                next={next}
                client={currentClient}
                heat={heatOf(currentClient, s.e)}
                ids={currentIds}
                goOrder={(m) => set({ mode: m, step: 4 })}
              />
            )}
            {s.step === 4 && <ModeStep s={s} set={set} next={next} />}
            {s.step === 5 && (
              <DetailsStep
                s={s}
                set={set}
                next={next}
                client={currentClient}
                job={{ rate: s.jobRate || 1000, product: s.e?.theme || "Custom Trophy" }}
                ids={currentIds}
              />
            )}
            {s.step === 6 && (
              <SendStep
                s={s}
                set={set}
                client={currentClient}
                ids={currentIds}
              />
            )}
          </main>

          <JobCard s={s} client={currentClient} ids={currentIds} />
        </div>
      )}
    </div>
  );
};

export default EnquiryFlow;
