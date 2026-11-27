/**
 * Timing & Priority Filtering Utilities for Designer Enquiries
 */

export const getItemTimingStatus = (item) => {
  if (!item) {
    return {
      isCompleted: false,
      isOnHold: false,
      isOverdue: false,
      isRush: false,
      diff: Infinity,
      dueHours: 24,
    };
  }

  const rawJob = item.rawJob || item;
  const theBrief = item.the_brief || rawJob.the_brief || {};
  const wizardState = item.wizard_state || rawJob.wizard_state || {};

  // Check rework
  const isRework = Boolean(
    item.is_rework ||
    item.design_status === "rework" ||
    theBrief.design_status === "rework" ||
    (item.design_progress && item.design_progress.is_rework) ||
    (rawJob.design_progress && rawJob.design_progress.is_rework)
  );

  // Check completion (all subjobs approved by client)
  const isCompleted = !isRework && Boolean(
    item.is_completed ||
    (item.design_progress && item.design_progress.is_completed) ||
    (rawJob.design_progress && rawJob.design_progress.is_completed) ||
    item.design_status === "approved" ||
    theBrief.design_status === "approved"
  );

  // If designs have already been uploaded and not in rework, designer SLA is satisfied
  const isUploaded = !isRework && !isCompleted && Boolean(
    item.design_status === "uploaded" ||
    theBrief.design_status === "uploaded" ||
    (item.images && item.images.length > 0 && item.is_flow)
  );

  // Check on hold
  const isOnHold = Boolean(item.is_on_hold || rawJob.is_on_hold);

  if (isCompleted || isUploaded) {
    return {
      isCompleted: true,
      isOnHold: false,
      isOverdue: false,
      isRush: false,
      diff: Infinity,
      dueHours: 24,
    };
  }

  if (isOnHold) {
    return {
      isCompleted: false,
      isOnHold: true,
      isOverdue: false,
      isRush: false,
      diff: Infinity,
      dueHours: 24,
    };
  }

  // Due hours (e.g., 4, 24, 48)
  const dueHours = Number(
    item.options_due_in ||
    theBrief.options_due_in ||
    wizardState.e?.optionsDueIn ||
    wizardState.optionsDueIn ||
    24
  );

  // Assigned / rework timestamp
  const assignedAt =
    item.designer_assigned_at ||
    theBrief.designer_assigned_at ||
    rawJob.createdAt ||
    item.createdAt;

  const reworkRequestedAt =
    item.rework_requested_at ||
    theBrief.rework_requested_at ||
    wizardState.reworkRequestedAt;

  const baseDate = (isRework && reworkRequestedAt)
    ? new Date(reworkRequestedAt)
    : (assignedAt ? new Date(assignedAt) : new Date());

  const targetDeadline = baseDate.getTime() + dueHours * 60 * 60 * 1000;
  const diff = targetDeadline - Date.now();

  const isOverdue = diff <= 0;
  const isRush = !isOverdue && (diff <= 4 * 60 * 60 * 1000 || dueHours <= 4);

  return {
    isCompleted: false,
    isOnHold: false,
    isOverdue,
    isRush,
    dueHours,
    diff,
    targetDeadline,
    hoursRemaining: Math.floor(diff / (1000 * 60 * 60)),
  };
};

export const filterAndSortByPriority = (items, priorityFilter) => {
  if (!Array.isArray(items)) return [];

  if (priorityFilter === "overdue") {
    return items.filter((item) => {
      const timing = getItemTimingStatus(item);
      return timing.isOverdue;
    });
  }

  if (priorityFilter === "rush") {
    return items.filter((item) => {
      const timing = getItemTimingStatus(item);
      return timing.isRush;
    });
  }

  if (priorityFilter === "rush_first") {
    // Show active Rush & Overdue jobs first, ordered by most urgent
    const urgentItems = items.filter((item) => {
      const timing = getItemTimingStatus(item);
      return timing.isRush || timing.isOverdue;
    });
    return urgentItems.sort((a, b) => {
      const timingA = getItemTimingStatus(a);
      const timingB = getItemTimingStatus(b);
      const scoreA = timingA.isOverdue ? 1 : 2;
      const scoreB = timingB.isOverdue ? 1 : 2;
      if (scoreA !== scoreB) {
        return scoreA - scoreB;
      }
      return timingA.diff - timingB.diff;
    });
  }

  return items;
};

export const countPriorityItems = (items) => {
  if (!Array.isArray(items)) return { overdue: 0, rush: 0 };
  let overdue = 0;
  let rush = 0;
  items.forEach((item) => {
    const timing = getItemTimingStatus(item);
    if (timing.isOverdue) overdue++;
    else if (timing.isRush) rush++;
  });
  return { overdue, rush };
};
