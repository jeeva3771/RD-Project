import React, { useState, useEffect, useMemo } from "react";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PauseCircleFilledIcon from "@mui/icons-material/PauseCircleFilled";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";

const pad = (n) => String(Math.max(0, n)).padStart(2, "0");

const DesignerDueCountdownBadge = ({ enquiry, className = "" }) => {
  const [now, setNow] = useState(Date.now());

  // Extract timing details
  const dueHours = useMemo(() => {
    return Number(
      enquiry?.options_due_in ||
      enquiry?.the_brief?.options_due_in ||
      enquiry?.rawJob?.the_brief?.options_due_in ||
      enquiry?.rawJob?.wizard_state?.e?.optionsDueIn ||
      24
    );
  }, [enquiry]);

  const assignedAt = useMemo(() => {
    const d =
      enquiry?.designer_assigned_at ||
      enquiry?.the_brief?.designer_assigned_at ||
      enquiry?.rawJob?.the_brief?.designer_assigned_at ||
      enquiry?.rawJob?.createdAt ||
      enquiry?.createdAt;
    return d ? new Date(d) : null;
  }, [enquiry]);

  const reworkRequestedAt = useMemo(() => {
    const r =
      enquiry?.rework_requested_at ||
      enquiry?.the_brief?.rework_requested_at ||
      enquiry?.rawJob?.the_brief?.rework_requested_at;
    return r ? new Date(r) : null;
  }, [enquiry]);

  const isRework = Boolean(
    enquiry?.is_rework ||
    enquiry?.design_status === "rework" ||
    enquiry?.the_brief?.design_status === "rework" ||
    (enquiry?.design_progress && enquiry.design_progress.is_rework) ||
    (enquiry?.rawJob?.design_progress && enquiry.rawJob.design_progress.is_rework)
  );
  const isOnHold = Boolean(enquiry?.is_on_hold || enquiry?.rawJob?.is_on_hold);
  const allSubJobs = enquiry?.sub_jobs || enquiry?.rawJob?.sub_jobs || [];
  const activeCustomSubJobs = (Array.isArray(allSubJobs) ? allSubJobs : []).filter(
    (s) => !s.is_dropped && !s.is_on_hold && s.trophy_type !== "ready"
  );
  const areAllSubJobsApproved =
    activeCustomSubJobs.length > 0
      ? activeCustomSubJobs.every((s) => s.design_approved === true || s.design_status === "approved")
      : Boolean(enquiry?.design_status === "approved" || enquiry?.the_brief?.design_status === "approved");

  const isCompleted = !isRework && Boolean(
    enquiry?.is_completed ||
    (enquiry?.design_progress && enquiry.design_progress.is_completed) ||
    (enquiry?.rawJob?.design_progress && enquiry.rawJob.design_progress.is_completed) ||
    (areAllSubJobsApproved && (enquiry?.design_status === "approved" || enquiry?.the_brief?.design_status === "approved"))
  );
  const isUploaded = !isRework && !isCompleted && Boolean(
    enquiry?.design_status === "uploaded" ||
    enquiry?.the_brief?.design_status === "uploaded" ||
    (enquiry?.images && enquiry.images.length > 0 && enquiry.is_flow)
  );

  // Target deadline calculation
  const targetDeadline = useMemo(() => {
    const baseDate = (isRework && reworkRequestedAt) ? reworkRequestedAt : (assignedAt || new Date());
    return baseDate.getTime() + dueHours * 60 * 60 * 1000;
  }, [isRework, reworkRequestedAt, assignedAt, dueHours]);

  // Live 1-second ticking timer (only tick if job is active: not completed, not uploaded, not on hold)
  useEffect(() => {
    if (isCompleted || isUploaded || isOnHold) return;

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [isCompleted, isUploaded, isOnHold]);

  // Diff in milliseconds
  const diff = targetDeadline - now;

  // Render Completed / Approved State
  if (isCompleted) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold bg-green-50 text-green-800 border-green-300 shadow-2xs ${className}`}
        title="All designs approved by client"
      >
        <CheckCircleIcon sx={{ fontSize: 14 }} className="text-green-600" />
        <span>Approved & Completed</span>
      </div>
    );
  }

  // Render Uploaded / In Review State
  if (isUploaded) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs ${className}`}
        title={`Designs uploaded. Total allotted time: ${dueHours}h`}
      >
        <CheckCircleIcon sx={{ fontSize: 14 }} className="text-emerald-600" />
        <span>Designs Uploaded</span>
        <span className="text-[10px] text-emerald-600/80 font-normal">({dueHours}h SLA)</span>
      </div>
    );
  }

  // Render On-Hold State
  if (isOnHold) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold bg-gray-100 text-gray-700 border-gray-300 shadow-2xs ${className}`}
        title="Timer paused while enquiry is on hold"
      >
        <PauseCircleFilledIcon sx={{ fontSize: 14 }} className="text-gray-500" />
        <span>Timer Paused (Hold)</span>
      </div>
    );
  }

  // Active or Overdue Countdown
  const isOverdue = diff <= 0;
  const absSec = Math.floor(Math.abs(diff) / 1000);
  const hours = Math.floor(absSec / 3600);
  const minutes = Math.floor((absSec % 3600) / 60);
  const seconds = absSec % 60;
  const formattedTime = `${pad(hours)}h : ${pad(minutes)}m : ${pad(seconds)}s`;

  if (isOverdue) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold bg-rose-50 text-rose-800 border-rose-300 animate-pulse shadow-2xs ${className}`}
        title={`Exceeded allotted due time of ${dueHours} hours`}
      >
        <ErrorOutlineIcon sx={{ fontSize: 14 }} className="text-rose-600" />
        <span>🚨 Overdue: {formattedTime}</span>
      </div>
    );
  }

  // Urgent: <= 4 hours remaining
  const isUrgent = hours < 4;

  if (isUrgent) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold bg-amber-50 text-amber-900 border-amber-300 shadow-2xs ${className}`}
        title={`Due within ${dueHours} hours from assignment`}
      >
        <WarningAmberIcon sx={{ fontSize: 14 }} className="text-amber-600 animate-bounce" />
        <span>⚠️ Due in {formattedTime}</span>
        <span className="text-[10px] bg-amber-200/80 text-amber-950 px-1 py-0.2 rounded font-extrabold uppercase">
          Rush
        </span>
      </div>
    );
  }

  // Healthy: > 4 hours remaining
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold bg-indigo-50/80 text-indigo-900 border-indigo-200 shadow-2xs ${className}`}
      title={`Due within ${dueHours} hours from assignment`}
    >
      <AccessTimeIcon sx={{ fontSize: 14 }} className="text-indigo-600" />
      <span>Due in: <b className="font-mono">{formattedTime}</b></span>
      <span className="text-[10px] text-indigo-500 font-medium">({dueHours}h)</span>
    </div>
  );
};

export default DesignerDueCountdownBadge;
