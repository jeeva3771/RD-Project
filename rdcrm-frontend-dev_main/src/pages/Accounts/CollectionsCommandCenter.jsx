import React, { useState, useMemo, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import { axiosInstance } from "../../utils/url/config";
import { getUser } from "../../utils/permission/auth";
import { useLoader } from "../../context/LoaderContext";
import "./accountsConsole.css";

import {
  COLLECTION_STAGES,
  INV_STATUS_LABEL,
  INV_STATUS_STYLE,
  TODAY,
} from "./collections/constants/collectionsConstants";
import {
  inr,
  formatDate,
  isPromiseOverdue,
} from "./collections/utils/collectionsFormatters";
import {
  allocateReceiptsToInvoices,
  computeRepeatOffenderIntel,
} from "./collections/utils/collectionsAllocation";
import CollectionIcon from "./collections/components/common/CollectionIcon";
import CollectionsKpiStrip from "./collections/components/cards/CollectionsKpiStrip";
import CollectionsBoardView from "./collections/components/views/CollectionsBoardView";
import CaseDetailModal from "./collections/components/modals/CaseDetailModal";
import ReceiptsLedgerPage from "./collections/components/views/ReceiptsLedgerPage";
import IntelligencePage from "./collections/components/views/IntelligencePage";

export default function CollectionsCommandCenter() {
  const { showLoader, hideLoader } = useLoader();
  const [cases, setCases] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [boardReceiptsTotal, setBoardReceiptsTotal] = useState(0);
  const [receiptsFetched, setReceiptsFetched] = useState(false);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [intelligenceFetched, setIntelligenceFetched] = useState(false);
  const [intelligenceLoading, setIntelligenceLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("board"); // "board" | "receipts" | "intelligence"
  const [groupBy, setGroupBy] = useState("client"); // "client" | "officer"
  const [entityFilter, setEntityFilter] = useState(null);
  const [todayOnly, setTodayOnly] = useState(false);
  const [openCaseId, setOpenCaseId] = useState(null);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState("admin"); // "admin" | "my"
  const [officers, setOfficers] = useState([]);
  const [currentOfficer, setCurrentOfficer] = useState("");
  const [legendOpen, setLegendOpen] = useState(false);
  const [unallocatedReceipts, setUnallocatedReceipts] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Lazy-load receipts ledger on-demand when user visits the Receipts view
  const fetchReceiptsLedger = useCallback(async (force = false) => {
    if (receiptsFetched && !force) return;
    try {
      showLoader();
      setReceiptsLoading(true);
      const res = await axiosInstance.get("/accounts/collections/receipts");
      if (res.data?.success && Array.isArray(res.data.data)) {
        setReceipts(res.data.data);
        setReceiptsFetched(true);
      }
    } catch (err) {
      console.error("Failed to load receipts ledger:", err);
      toast.error("Failed to load receipts ledger from server");
    } finally {
      setReceiptsLoading(false);
      hideLoader();
    }
  }, [receiptsFetched, showLoader, hideLoader]);

  // Lazy-load intelligence & receipts analytics on-demand ONLY when visiting the Intelligence tab
  const fetchIntelligenceData = useCallback(async (force = false) => {
    if (intelligenceFetched && !force) return;
    try {
      showLoader();
      setIntelligenceLoading(true);
      const res = await axiosInstance.get("/accounts/collections/receipts", {
        params: { limit: "all" },
      });
      if (res.data?.success && Array.isArray(res.data.data)) {
        const mapped = res.data.data.map((r) => ({
          ...r,
          dateObj: r.dateObj ? new Date(r.dateObj) : (r.date ? new Date(r.date) : new Date()),
        }));
        setReceipts(mapped);
        setReceiptsFetched(true);
        setIntelligenceFetched(true);
      }
    } catch (err) {
      console.error("Failed to load intelligence data:", err);
      toast.error("Failed to load intelligence data from server");
    } finally {
      setIntelligenceLoading(false);
      hideLoader();
    }
  }, [intelligenceFetched, showLoader, hideLoader]);

  // Automatically fetch intelligence on-demand when user opens the Intelligence tab
  useEffect(() => {
    if (activeTab === "intelligence" && !intelligenceFetched && !intelligenceLoading) {
      fetchIntelligenceData();
    }
  }, [activeTab, intelligenceFetched, intelligenceLoading, fetchIntelligenceData]);

  // Fetch live board data from backend on mount
  const fetchBoardData = useCallback(async () => {
    try {
      showLoader();
      setLoading(true);
      const res = await axiosInstance.get("/accounts/collections/board");
      if (res.data?.success && res.data.data) {
        const {
          cases: bCases = [],
          receipts: bReceipts = [],
          totalReceiptsAmount = 0,
          unallocatedReceipts: bUnalloc = [],
          officers: bOfficers = [],
          bankAccounts: bBanks = [],
        } = res.data.data;

        setCases(bCases);
        if (totalReceiptsAmount) {
          setBoardReceiptsTotal(totalReceiptsAmount);
        }
        if (bReceipts.length > 0) {
          setReceipts(bReceipts);
          setReceiptsFetched(true);
        }
        setUnallocatedReceipts(bUnalloc);
        setOfficers(bOfficers);
        setBankAccounts(bBanks);

        const loggedUser = getUser();
        if (loggedUser && loggedUser.name) {
          const match = bOfficers.find(
            (o) => o.toLowerCase() === loggedUser.name.toLowerCase()
          );
          if (match) setCurrentOfficer(match);
          else if (bOfficers.length > 0) setCurrentOfficer(bOfficers[0]);
        } else if (bOfficers.length > 0) {
          setCurrentOfficer(bOfficers[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load collections board data:", err);
      toast.error("Failed to load collections data from server");
    } finally {
      setLoading(false);
      hideLoader();
    }
  }, [showLoader, hideLoader]);

  useEffect(() => {
    fetchBoardData();
  }, [fetchBoardData]);

  const addHistory = async (caseId, entry) => {
    setCases((prev) =>
      prev.map((c) =>
        c.id === caseId
          ? {
            ...c,
            history: [...(c.history || []), entry],
            stage: c.stage === "new" ? "contacted" : c.stage,
          }
          : c
      )
    );
    try {
      await axiosInstance.post(`/accounts/collections/case/${caseId}/history`, entry);
    } catch (err) {
      console.warn("Backend history sync notice:", err.message);
    }
  };

  const moveStage = async (caseId, stageId) => {
    setCases((prev) =>
      prev.map((c) => {
        if (c.id !== caseId) return c;
        const escalationCount =
          stageId === "escalated" && c.stage !== "escalated"
            ? (c.escalationCount || 0) + 1
            : (c.escalationCount || 0);
        return { ...c, stage: stageId, escalationCount };
      })
    );
    try {
      await axiosInstance.patch(`/accounts/collections/case/${caseId}/stage`, {
        stage: stageId,
      });
    } catch (err) {
      console.warn("Backend stage sync notice:", err.message);
    }
  };

  const setFollowUp = async (caseId, dateLabel, dateIso) => {
    setCases((prev) =>
      prev.map((c) =>
        c.id === caseId ? { ...c, nextFollowUp: dateLabel, stage: "followup" } : c
      )
    );
    try {
      await axiosInstance.patch(`/accounts/collections/case/${caseId}/follow-up`, {
        dateLabel,
        followUpDate: dateIso,
      });
    } catch (err) {
      console.warn("Backend follow-up sync notice:", err.message);
    }
  };

  const recordPromise = async (caseId, { promisedDate, promisedAmount, note }) => {
    const resolvedDate = new Date(promisedDate);
    const dateLabel = formatDate(resolvedDate);
    const amtNum = promisedAmount ? Number(promisedAmount) : null;
    const dateIso = resolvedDate.toISOString();
    const amtStr = amtNum ? inr(amtNum) : "full balance";

    const historyEntry = {
      id: caseId + "-prom-" + Date.now(),
      date: formatDate(new Date()),
      type: "note",
      by: "Accounts Officer",
      text: `Payment promised: ${amtStr} on ${dateLabel}.${note ? ` Note: "${note}"` : ""}`,
    };

    setCases((prev) =>
      prev.map((c) => {
        if (c.id !== caseId) return c;
        return {
          ...c,
          stage: "promised",
          promisedDate: dateLabel,
          promisedDateIso: dateIso,
          promisedAmount: amtNum,
          promisedNote: note || "",
          history: [...c.history, historyEntry],
        };
      })
    );

    try {
      const res = await axiosInstance.patch(`/accounts/collections/case/${caseId}/promise`, {
        promisedDate,
        promisedAmount: amtNum,
        note,
      });
      if (res.data?.success) {
        toast.success(`Payment promise recorded for ${dateLabel}`);
      }
    } catch (err) {
      console.warn("Backend promise sync notice:", err.message);
      toast.error(err.response?.data?.message || "Failed to record promise");
    }
  };

  const applyReceiptAndMaybeClose = (
    caseId,
    invoiceId,
    amount,
    nextReceipts,
    extraNote,
    by
  ) => {
    const c = cases.find((x) => x.id === caseId);
    if (!c) return;
    const clientInvoices = allocateReceiptsToInvoices(c.invoices || [], nextReceipts);
    const allPaid =
      clientInvoices.length > 0 &&
      clientInvoices.every((i) => i.balance <= 0);
    const inv = clientInvoices.find(
      (i) => i.id === invoiceId || i.invoiceNo === invoiceId || (i.sub_job_no && i.sub_job_no === invoiceId)
    );
    const historyEntry = {
      id: caseId + "-rcpt-" + Date.now(),
      date: formatDate(new Date()),
      type: "receipt",
      by: by || "Accounts Team",
      text:
        (extraNote ||
          `Receipt confirmed: ${inr(amount)} against ${inv ? inv.invoiceNo : (invoiceId || "invoice")
          }.`) + (allPaid ? " All invoices settled — follow-up closed." : ""),
    };
    setCases((prev) =>
      prev.map((x) =>
        x.id === caseId
          ? {
            ...x,
            history: [...(x.history || []), historyEntry],
            stage: allPaid ? "closed" : x.stage,
            nextFollowUp: allPaid ? null : x.nextFollowUp,
          }
          : x
      )
    );
  };

  const recordReceipt = async (
    caseId,
    { invoiceId, sub_job_no, invoiceNo, amount, tds_amount = 0, tds_rate = 0, tds_tax = null, total_payable, gross_amount, dateLabel, dateObj, mode: payMode, refNo, confirmedBy, bankAccountId, proofFiles, proofFile }
  ) => {
    const allFiles = proofFiles && proofFiles.length > 0
      ? proofFiles
      : (proofFile ? [proofFile] : []);
    const receiptNo = "RCPT-" + (3000 + receipts.length + 1);
    const c = cases.find((x) => x.id === caseId);
    const inv = (c?.invoices || []).find(
      (i) => i.id === invoiceId || i.invoiceNo === invoiceId || (sub_job_no && i.sub_job_no === sub_job_no)
    );
    const targetInvId = inv ? inv.id : invoiceId;
    const targetInvNo = inv ? inv.invoiceNo : (invoiceNo || invoiceId);
    const proofSummary = allFiles.length > 0
      ? (allFiles.length === 1 ? allFiles[0].name : `${allFiles.length} files (${allFiles[0].name} +${allFiles.length - 1} more)`)
      : "";

    const grossVal = Number(gross_amount || (Number(amount || 0) + Number(tds_amount || 0)));
    const netVal = Number(amount || 0);

    const newReceipt = {
      id: "RCPT" + Date.now(),
      receiptNo,
      date: dateLabel,
      dateObj: dateObj || new Date(),
      invoiceId: targetInvId,
      invoiceNo: targetInvNo,
      sub_job_no: inv?.sub_job_no || sub_job_no || "",
      amount: netVal,
      tds_amount: Number(tds_amount || 0),
      tds_rate: Number(tds_rate || 0),
      tds_tax: tds_tax || null,
      total_payable: Number(total_payable || netVal),
      gross_amount: grossVal,
      mode: payMode,
      refNo,
      attachmentName: proofSummary,
      attachments: allFiles.map((f) => ({ name: f.name, url: "" })),
      confirmedBy,
    };
    const nextReceipts = [...receipts, newReceipt];
    setReceipts(nextReceipts);
    applyReceiptAndMaybeClose(
      caseId,
      targetInvId,
      grossVal,
      nextReceipts,
      `Receipt confirmed: ${inr(netVal)}${tds_amount > 0 ? ` (+ ${inr(tds_amount)} TDS @ ${tds_rate}%)` : ""} via ${payMode}${refNo ? " (Ref: " + refNo + ")" : ""
      } against ${targetInvNo}${proofSummary ? " [Proof: " + proofSummary + "]" : ""}.`,
      confirmedBy
    );
    try {
      const formData = new FormData();
      formData.append("caseId", caseId);
      formData.append("invoiceId", targetInvId);
      formData.append("sub_job_no", inv?.sub_job_no || sub_job_no || "");
      formData.append("invoiceNo", targetInvNo);
      formData.append("amount", netVal);
      formData.append("tds_amount", Number(tds_amount || 0));
      formData.append("tds_rate", Number(tds_rate || 0));
      if (tds_tax) formData.append("tds_tax", tds_tax);
      formData.append("total_payable", Number(total_payable || netVal));
      formData.append("gross_amount", grossVal);
      formData.append("mode", payMode);
      formData.append("refNo", refNo || "");
      formData.append("confirmedBy", confirmedBy);
      formData.append("date", (dateObj || new Date()).toISOString());
      formData.append("date_label", dateLabel || formatDate(dateObj || new Date()));
      if (payMode !== "Cash" && bankAccountId) {
        formData.append("bankAccountId", bankAccountId);
      }
      formData.append("isUnallocated", "false");
      allFiles.forEach((f) => {
        formData.append("attachments", f);
      });

      const res = await axiosInstance.post("/accounts/collections/record-receipt", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data?.success) {
        fetchBoardData();
      } else {
        toast.error(res.data?.message || "Failed to record receipt");
      }
    } catch (err) {
      console.warn("Backend receipt sync notice:", err.message);
      toast.error(err.response?.data?.message || "Failed to save receipt on server");
    }
  };

  const recordUnallocated = async (
    caseId,
    client,
    { amount, dateLabel, dateObj, mode: payMode, refNo, confirmedBy, bankAccountId, proofFiles, proofFile }
  ) => {
    const allFiles = proofFiles && proofFiles.length > 0
      ? proofFiles
      : (proofFile ? [proofFile] : []);
    const proofSummary = allFiles.length > 0
      ? (allFiles.length === 1 ? allFiles[0].name : `${allFiles.length} files (${allFiles[0].name} +${allFiles.length - 1} more)`)
      : "";

    const tempId = "UNALLOC" + Date.now();
    const newEntry = {
      id: tempId,
      receiptNo: "RCPT-UN-" + (unallocatedReceipts.length + 1),
      date: dateLabel,
      dateObj: dateObj || new Date(),
      client,
      amount,
      mode: payMode,
      refNo,
      attachmentName: proofSummary,
      attachments: allFiles.map((f) => ({ name: f.name, url: "" })),
      confirmedBy,
      allocations: [],
    };
    setUnallocatedReceipts((prev) => [...prev, newEntry]);
    addHistory(caseId, {
      id: caseId + "-unalloc-" + Date.now(),
      date: formatDate(new Date()),
      type: "note",
      by: confirmedBy,
      text: `Unmatched payment received: ${inr(amount)} via ${payMode}${refNo ? " (Ref: " + refNo + ")" : ""
        }${proofSummary ? " [Proof: " + proofSummary + "]" : ""} — not yet linked to an invoice. Reconcile before further follow-up.`,
    });
    try {
      const formData = new FormData();
      formData.append("caseId", caseId);
      formData.append("clientName", client);
      formData.append("amount", amount);
      formData.append("mode", payMode);
      formData.append("refNo", refNo || "");
      formData.append("confirmedBy", confirmedBy);
      formData.append("date", (dateObj || new Date()).toISOString());
      formData.append("date_label", dateLabel || formatDate(dateObj || new Date()));
      if (payMode !== "Cash" && bankAccountId) {
        formData.append("bankAccountId", bankAccountId);
      }
      formData.append("isUnallocated", "true");
      allFiles.forEach((f) => {
        formData.append("attachments", f);
      });

      const res = await axiosInstance.post("/accounts/collections/record-receipt", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data?.success && res.data?.data?._id) {
        const realId = res.data.data._id.toString();
        const realReceiptNo = res.data.data.receipt_no || newEntry.receiptNo;
        setUnallocatedReceipts((prev) =>
          prev.map((u) => (u.id === tempId ? { ...u, id: realId, _id: realId, receiptNo: realReceiptNo } : u))
        );
        fetchBoardData();
      } else {
        toast.error(res.data?.message || "Failed to record unmatched payment");
      }
    } catch (err) {
      console.warn("Backend unallocated sync notice:", err.message);
      toast.error(err.response?.data?.message || "Failed to record unmatched payment on server");
    }
  };

  const allocateReceipt = async (caseId, unallocId, invoiceId, amount, tdsData = {}) => {
    const un = unallocatedReceipts.find((u) => u.id === unallocId || u._id === unallocId);
    if (!un) return;
    const c = cases.find((x) => x.id === caseId);
    const inv = (c?.invoices || []).find((i) => i.id === invoiceId || i.invoiceNo === invoiceId);
    const targetInvoiceId = inv ? inv.id : invoiceId;
    const targetInvoiceNo = inv ? inv.invoiceNo : invoiceId;
    const tdsAmt = Number(tdsData.tds_amount || 0);
    const tdsRate = Number(tdsData.tds_rate || 0);
    const grossAmt = Number(tdsData.gross_amount || (amount + tdsAmt));

    const newReceipt = {
      id: "RCPT" + Date.now(),
      receiptNo: un.receiptNo || un.receipt_no || ("RCPT-" + (3000 + receipts.length + 1)),
      date: un.date,
      dateObj: un.dateObj,
      invoiceId: targetInvoiceId,
      invoiceNo: targetInvoiceNo,
      sub_job_no: inv?.sub_job_no || "",
      amount,
      tds_amount: tdsAmt,
      tds_rate: tdsRate,
      tds_tax: tdsData.tds_tax || null,
      total_payable: amount,
      gross_amount: grossAmt,
      mode: un.mode,
      refNo: un.refNo,
      attachment: un.attachment || "",
      attachmentName: un.attachmentName || "",
      attachments: un.attachments || [],
      confirmedBy: un.confirmedBy,
      fromUnallocatedId: unallocId,
    };
    const nextReceipts = [...receipts, newReceipt];
    setReceipts(nextReceipts);
    setUnallocatedReceipts((prev) =>
      prev.map((u) =>
        u.id === unallocId || u._id === unallocId
          ? { ...u, allocations: [...(u.allocations || []), { invoiceId: targetInvoiceId, invoiceNo: targetInvoiceNo, amount }] }
          : u
      )
    );
    applyReceiptAndMaybeClose(
      caseId,
      targetInvoiceId,
      grossAmt,
      nextReceipts,
      `Reconciled ${inr(amount)}${tdsAmt > 0 ? ` (+ ${inr(tdsAmt)} TDS @ ${tdsRate}%)` : ""} from unmatched payment (${un.receiptNo || "unmatched"}) on ${un.date} against ${targetInvoiceNo}.`,
      un.confirmedBy
    );
    try {
      const res = await axiosInstance.post("/accounts/collections/reconcile", {
        unallocatedId: un.id || unallocId,
        receiptNo: un.receiptNo,
        invoiceId: targetInvoiceId,
        sub_job_no: inv?.sub_job_no || "",
        amount,
        tds_rate: tdsRate,
        tds_amount: tdsAmt,
        tds_tax: tdsData.tds_tax || null,
        total_payable: amount,
        gross_amount: grossAmt,
        caseId,
        invoiceNo: targetInvoiceNo,
      });
      if (res.data?.success) {
        toast.success(`Successfully reconciled ${inr(amount)}${tdsAmt > 0 ? ` (TDS: ${inr(tdsAmt)})` : ""} against ${targetInvoiceNo}`);
        fetchBoardData();
      } else {
        toast.error(res.data?.message || "Server reconciliation failed");
      }
    } catch (err) {
      console.error("Backend reconcile error:", err);
      toast.error(err.response?.data?.message || "Failed to reconcile with server");
    }
  };

  // Enriched Cases with live balances and computed flags from real MongoDB data
  const enrichedCases = useMemo(() => {
    return cases.map((c) => {
      const invs = allocateReceiptsToInvoices(c.invoices || [], receipts);
      const unpaid = invs.filter((i) => i.balance > 0);
      const total = unpaid.reduce((s, i) => s + i.balance, 0);
      const oldest = unpaid.reduce((m, i) => Math.max(m, i.daysOverdue || 0), 0);
      const allPaid = invs.length > 0 && invs.every((i) => i.balance <= 0);
      const contact = c.contact || {
        contactPerson: "Contact Person",
        phone: "—",
        email: "—",
      };
      const base = {
        ...c,
        contact,
        invoices: invs,
        total,
        oldest,
        allPaid,
      };
      const repeatOffenderIntel = computeRepeatOffenderIntel(c.escalationCount || 0, invs);
      const unallocatedForClient = unallocatedReceipts.filter(
        (u) =>
          (u.client || "").trim().toLowerCase() === (c.client || "").trim().toLowerCase() &&
          Number(u.amount || 0) - (u.allocations || []).reduce((s, a) => s + Number(a.amount || 0), 0) > 0.01
      );
      return {
        ...base,
        repeatOffenderIntel,
        repeatOffenderTier: repeatOffenderIntel.tier,
        hasUnallocated: unallocatedForClient.length > 0,
      };
    });
  }, [cases, receipts, unallocatedReceipts]);

  const ownerFilterFromMode = mode === "my" ? currentOfficer : null;
  const baseFiltered = useMemo(
    () =>
      enrichedCases.filter(
        (c) => !ownerFilterFromMode || c.owner === ownerFilterFromMode
      ),
    [enrichedCases, ownerFilterFromMode]
  );

  const filtered = useMemo(() => {
    let rows = baseFiltered;
    if (entityFilter) {
      rows = rows.filter((c) =>
        groupBy === "client" ? c.client === entityFilter : c.owner === entityFilter
      );
    }
    if (todayOnly) {
      rows = rows.filter((c) => c.nextFollowUp === formatDate(TODAY));
    }
    return rows;
  }, [baseFiltered, entityFilter, groupBy, todayOnly]);

  const receiptsTotal = useMemo(() => {
    if (receipts.length > 0) {
      let rows = baseFiltered;
      if (entityFilter) {
        rows = rows.filter((c) =>
          groupBy === "client" ? c.client === entityFilter : c.owner === entityFilter
        );
      }
      const clientSet = new Set(rows.map((c) => c.client));
      return receipts
        .filter((r) => !clientSet.size || clientSet.has(r.client))
        .reduce((s, r) => s + Number(r.amount || 0), 0);
    }
    return boardReceiptsTotal || 0;
  }, [baseFiltered, entityFilter, groupBy, receipts, boardReceiptsTotal]);

  const searchResults = useMemo(() => {
    if (search.trim() === "") return [];
    const q = search.trim().toLowerCase();
    return baseFiltered
      .filter(
        (c) =>
          c.client.toLowerCase().includes(q) ||
          c.contact.contactPerson.toLowerCase().includes(q) ||
          c.invoices.some((inv) => inv.invoiceNo.toLowerCase().includes(q))
      )
      .slice(0, 6);
  }, [search, baseFiltered]);

  const activeOfficers = useMemo(() => {
    if (Array.isArray(officers) && officers.length > 0) {
      return officers;
    }
    const set = new Set();
    cases.forEach((c) => {
      if (c.owner) set.add(c.owner);
    });
    return Array.from(set);
  }, [officers, cases]);

  const clientLeaderboard = [...baseFiltered].sort((a, b) => b.total - a.total);
  const officerLeaderboard = activeOfficers
    .map((o) => {
      const rows = baseFiltered.filter((c) => c.owner === o);
      return {
        owner: o,
        total: rows.reduce((s, c) => s + c.total, 0),
        count: rows.length,
        escalated: rows.filter((c) => c.stage === "escalated").length,
      };
    })
    .filter((o) => o.count > 0)
    .sort((a, b) => b.total - a.total);

  const openCase = enrichedCases.find((c) => c.id === openCaseId) || null;

  const handlePickCase = (id) => {
    setOpenCaseId(id);
    setSearch("");
    setActiveTab("board");
  };

  const handleModeChange = (m) => {
    setMode(m);
    setEntityFilter(null);
    if (m === "my") {
      if ((!currentOfficer || !activeOfficers.includes(currentOfficer)) && activeOfficers.length > 0) {
        setCurrentOfficer(activeOfficers[0]);
      }
    }
  };

  const handleOfficerChange = (o) => {
    setCurrentOfficer(o);
    setEntityFilter(null);
  };

  const reassignCaseOwner = async (caseId, newOwner) => {
    if (!newOwner) return;
    setCases((prev) =>
      prev.map((c) => (c.id === caseId ? { ...c, owner: newOwner } : c))
    );
    try {
      await axiosInstance.patch(`/accounts/collections/case/${caseId}/owner`, {
        owner: newOwner,
      });
      toast.success(`Case assigned to ${newOwner}`);
    } catch (err) {
      console.warn("Backend owner sync notice:", err.message);
    }
  };

  // KPI Calculations
  const totalOutstanding = baseFiltered.reduce((s, c) => s + c.total, 0);
  const followUpsToday = baseFiltered.filter(
    (c) => c.nextFollowUp === formatDate(TODAY)
  ).length;
  const promisedCount = baseFiltered.filter((c) => c.stage === "promised").length;
  const brokenPromiseCount = baseFiltered.filter(
    (c) => c.stage === "promised" && isPromiseOverdue(c.promisedDateIso)
  ).length;
  const escalatedCount = baseFiltered.filter((c) => c.stage === "escalated").length;
  const overdue30Count = baseFiltered.filter((c) => c.oldest >= 30).length;

  return (
    <div className="h-full w-full bg-slate-50 text-slate-800 flex flex-col font-sans overflow-hidden">
      {/* ---------------- Top Command Bar ---------------- */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 shrink-0 z-30 shadow-2xs">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Search Box on Left */}
          <div className="relative w-64 sm:w-80 md:w-96">
            <CollectionIcon
              name="search"
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search client, contact, invoice no..."
              className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800 outline-none focus:border-amber-500 focus:bg-white focus:ring-1 focus:ring-amber-200 transition placeholder:text-slate-400"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <CollectionIcon name="x" size={13} />
              </button>
            )}

            {/* Live Search Autocomplete Popup */}
            {search.trim() !== "" && (
              <div className="absolute mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-80 overflow-y-auto animate-in fade-in duration-100 divide-y divide-slate-100">
                {searchResults.length === 0 && (
                  <div className="px-3.5 py-3 text-xs text-slate-400 italic">
                    No matching client or invoice found.
                  </div>
                )}
                {searchResults.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => handlePickCase(c.id)}
                    className="px-3.5 py-2.5 hover:bg-amber-50/70 cursor-pointer flex items-center justify-between text-xs transition"
                  >
                    <div>
                      <span className="font-bold text-slate-800">{c.client}</span>
                      <span className="text-slate-400 ml-1">
                        • {c.contact.contactPerson}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-amber-700">
                      {inr(c.total)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Center Tabs: Board / Receipts Ledger / Intelligence */}
          <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-bold shrink-0">
            <button
              onClick={() => setActiveTab("board")}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition text-xs font-semibold ${
                activeTab === "board"
                  ? "bg-white text-amber-800 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <CollectionIcon name="wallet" size={13} /> Board
            </button>
            <button
              onClick={() => setActiveTab("receipts")}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition text-xs font-semibold ${
                activeTab === "receipts"
                  ? "bg-white text-emerald-800 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <CollectionIcon name="check" size={13} /> Receipts Ledger
            </button>
            <button
              onClick={() => {
                setActiveTab("intelligence");
                if (!intelligenceFetched) {
                  fetchIntelligenceData();
                }
              }}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition text-xs font-semibold ${
                activeTab === "intelligence"
                  ? "bg-white text-indigo-800 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <CollectionIcon name="shield" size={13} /> Intelligence & Insights
            </button>
          </div>

          {/* Right Action Controls: Admin / My View + Legend */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
              <button
                onClick={() => handleModeChange("admin")}
                className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-md transition ${
                  mode === "admin"
                    ? "bg-white text-amber-700 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <CollectionIcon name="users" size={12} /> Full Team
              </button>
              <button
                onClick={() => handleModeChange("my")}
                className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-md transition ${
                  mode === "my"
                    ? "bg-white text-amber-700 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <CollectionIcon name="user" size={12} /> My View
              </button>
            </div>

            {mode === "my" && (
              <select
                value={currentOfficer}
                onChange={(e) => handleOfficerChange(e.target.value)}
                className="text-xs font-semibold border border-amber-200 rounded-lg px-2.5 py-1.5 text-amber-800 outline-none bg-amber-50/70"
              >
                {activeOfficers.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            )}

            {/* Legend Popover */}
            <div className="relative">
              <button
                onClick={() => setLegendOpen(!legendOpen)}
                className="flex items-center gap-1 text-xs font-semibold text-slate-600 border border-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 transition"
              >
                <CollectionIcon name="info" size={13} />
                <span className="hidden sm:inline">Legend</span>
              </button>
              {legendOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl p-3.5 z-50 animate-in fade-in zoom-in-95 duration-100 text-xs">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2">
                    Follow-Up Stages
                  </div>
                  <div className="space-y-1 mb-3">
                    {COLLECTION_STAGES.map((s) => (
                      <div key={s.id} className="flex items-center justify-between py-0.5">
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                          style={{ background: s.color }}
                        >
                          {s.label}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2 border-t border-slate-100 pt-2">
                    Invoice Statuses
                  </div>
                  <div className="space-y-1">
                    {Object.keys(INV_STATUS_LABEL).map((k) => (
                      <div key={k} className="flex items-center justify-between py-0.5">
                        <span
                          className={
                            "px-2 py-0.5 rounded-full border text-[10px] font-bold " +
                            INV_STATUS_STYLE[k]
                          }
                        >
                          {INV_STATUS_LABEL[k]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* ---------------- Sub-Content Area ---------------- */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
        {/* KPI Strip */}
        <CollectionsKpiStrip
          totalOutstanding={totalOutstanding}
          receiptsTotal={receiptsTotal}
          casesCount={baseFiltered.length}
          followUpsToday={followUpsToday}
          todayOnly={todayOnly}
          setTodayOnly={setTodayOnly}
          promisedCount={promisedCount}
          brokenPromiseCount={brokenPromiseCount}
          escalatedCount={escalatedCount}
          overdue30Count={overdue30Count}
          mode={mode}
          currentOfficer={currentOfficer}
          onSwitchFullTeam={() => handleModeChange("admin")}
        />

        {/* Tab 1: Board View */}
        {activeTab === "board" && (
          <CollectionsBoardView
            filtered={filtered}
            groupBy={groupBy}
            setGroupBy={setGroupBy}
            entityFilter={entityFilter}
            setEntityFilter={setEntityFilter}
            todayOnly={todayOnly}
            setTodayOnly={setTodayOnly}
            clientLeaderboard={clientLeaderboard}
            officerLeaderboard={officerLeaderboard}
            onSelectCase={(id) => setOpenCaseId(id)}
          />
        )}

        {/* Tab 2: Receipts Ledger */}
        {activeTab === "receipts" && (
          <ReceiptsLedgerPage
            cases={cases}
            ownerFilterFromMode={ownerFilterFromMode}
            groupBy={groupBy}
            entityFilter={entityFilter}
          />
        )}

        {/* Tab 3: Intelligence & Insights */}
        {activeTab === "intelligence" && (
          <IntelligencePage
            cases={baseFiltered}
            receipts={receipts}
            unallocatedReceipts={unallocatedReceipts}
            onPickCase={handlePickCase}
            loading={intelligenceLoading}
            onRefresh={() => fetchIntelligenceData(true)}
          />
        )}
      </div>

      {/* ---------------- Case Detail Modal Workspace ---------------- */}
      <CaseDetailModal
        caseObj={openCase}
        onClose={() => setOpenCaseId(null)}
        onAddHistory={addHistory}
        onMoveStage={moveStage}
        onSetFollowUp={setFollowUp}
        onRecordPromise={recordPromise}
        onRecordReceipt={recordReceipt}
        onRecordUnallocated={recordUnallocated}
        onAllocate={allocateReceipt}
        unallocatedForClient={
          openCase
            ? unallocatedReceipts.filter(
              (u) =>
                (u.client || "").trim().toLowerCase() === (openCase.client || "").trim().toLowerCase() &&
                Number(u.amount || 0) - (u.allocations || []).reduce((s, a) => s + Number(a.amount || 0), 0) > 0.01
            )
            : []
        }
        repeatOffenderIntel={openCase ? openCase.repeatOffenderIntel : null}
        bankAccounts={bankAccounts}
        officers={activeOfficers}
        onReassignOwner={reassignCaseOwner}
      />
    </div>
  );
}
