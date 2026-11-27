import EnquiryJob from "../../../models/enquiry/enquiryJobIntegrationModel.js";

// ==========================================
// SUB-JOB LIFECYCLE CONTROLLERS (HOLD & DROP)
// ==========================================

export const toggleHoldSubJob = async (req, res) => {
  try {
    const { id, subJobNo } = req.params;
    const { hold, reason = "" } = req.body;

    const job = await EnquiryJob.findById(id);
    if (!job) return res.status(404).json({ success: false, message: "Job not found" });

    // Ensure sub_jobs array exists
    if (!job.sub_jobs || job.sub_jobs.length === 0) {
      if (job.wizard_state?.e?.trophyGroups && Array.isArray(job.wizard_state.e.trophyGroups)) {
        job.sub_jobs = [];
        job.wizard_state.e.trophyGroups.forEach((group, gIdx) => {
          const groupChar = String.fromCharCode(65 + gIdx);
          (group.items || [{ size: "8", qty: 50 }]).forEach((item, sIdx) => {
            job.sub_jobs.push({
              sub_job_no: `${job.enquiry_no}-${groupChar}${sIdx + 1}`,
              design_group: groupChar,
              size_variant: sIdx + 1,
              trophy_type: group.kind || "custom",
              theme: group.theme || job.the_ask?.theme || "Custom Trophy",
              product_name: group.productName || job.the_ask?.product_name || "Custom Trophy",
              size: String(item.size || "8"),
              material: Array.isArray(group.mats) ? group.mats.join(" + ") : (group.mat || "MDF"),
              quantity: Number(item.qty || 50),
              target_rate: item.rate || item.budget || 0,
              line_total: (Number(item.qty) || 50) * (item.rate || item.budget || 0),
              stage: job.stage || "enquiry",
            });
          });
        });
      }
    }

    let subJob = job.sub_jobs.find((s) => s.sub_job_no === subJobNo);
    // If not found by exact string, try finding by suffix (e.g. A1, B1)
    if (!subJob) {
      subJob = job.sub_jobs.find((s) => s.sub_job_no?.endsWith(subJobNo) || subJobNo?.endsWith(s.sub_job_no));
    }
    if (!subJob) return res.status(404).json({ success: false, message: `Sub-job ${subJobNo} not found` });

    subJob.is_on_hold = !!hold;
    if (hold) {
      subJob.hold_reason = reason;
      subJob.held_at = new Date();
    } else {
      subJob.unheld_at = new Date();
    }

    // Sync to wizard_state specifically per item/variant
    if (job.wizard_state?.e?.trophyGroups && Array.isArray(job.wizard_state.e.trophyGroups)) {
      job.wizard_state.e.trophyGroups.forEach((tg, idx) => {
        const groupChar = String.fromCharCode(65 + idx);
        if (subJob.sub_job_no.includes(`-${groupChar}`) || tg.name === subJob.product_name || tg.theme === subJob.theme) {
          if (Array.isArray(tg.items)) {
            const match = subJob.sub_job_no.match(new RegExp(`-${groupChar}(\\d+)`));
            const variantIdx = match ? parseInt(match[1], 10) - 1 : -1;
            if (variantIdx >= 0 && tg.items[variantIdx]) {
              tg.items[variantIdx].is_on_hold = !!hold;
              tg.items[variantIdx].hold_reason = hold ? reason : "";
              tg.items[variantIdx].held_at = hold ? new Date().toISOString() : null;
              tg.items.forEach((it, k) => {
                if (k !== variantIdx && it.is_on_hold === undefined) {
                  it.is_on_hold = false;
                }
              });
            } else {
              const matchedItem = tg.items.find((it) => String(it.size) === String(subJob.size));
              if (matchedItem) {
                matchedItem.is_on_hold = !!hold;
                matchedItem.hold_reason = hold ? reason : "";
              }
            }
          }
          const allItemsHeld = Array.isArray(tg.items) && tg.items.length > 0 && tg.items.every((it) => it.is_on_hold);
          tg.is_on_hold = allItemsHeld;
          if (allItemsHeld && hold) {
            tg.hold_reason = reason;
          } else if (!hold) {
            tg.hold_reason = "";
          }
        }
      });
      job.markModified("wizard_state");
    }

    job.history.push({
      action: hold ? "SUB_JOB_HOLD" : "SUB_JOB_UNHELD",
      sub_job_no: subJob.sub_job_no,
      remarks: hold ? `Sub-job ${subJob.sub_job_no} placed on hold: ${reason}` : `Sub-job ${subJob.sub_job_no} unheld`,
      changed_by: {
        user_id: req.user?.id || req.user?._id || null,
        user_name: req.user?.name || "User",
        role: req.user?.role || "Operator",
      },
      timestamp: new Date(),
    });

    await job.save();

    res.status(200).json({
      success: true,
      message: `Sub-job ${subJob.sub_job_no} ${hold ? "placed on hold" : "unheld"} successfully`,
      data: job,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// 8. Sub-Job Action: Drop / Cancel Sub-Job
export const dropSubJob = async (req, res) => {
  try {
    const { id, subJobNo } = req.params;
    const { reason = "Client dropped product" } = req.body;

    const job = await EnquiryJob.findById(id);
    if (!job) return res.status(404).json({ success: false, message: "Job not found" });

    // Ensure sub_jobs array exists
    if (!job.sub_jobs || job.sub_jobs.length === 0) {
      if (job.wizard_state?.e?.trophyGroups && Array.isArray(job.wizard_state.e.trophyGroups)) {
        job.sub_jobs = [];
        job.wizard_state.e.trophyGroups.forEach((group, gIdx) => {
          const groupChar = String.fromCharCode(65 + gIdx);
          (group.items || [{ size: "8", qty: 50 }]).forEach((item, sIdx) => {
            job.sub_jobs.push({
              sub_job_no: `${job.enquiry_no}-${groupChar}${sIdx + 1}`,
              design_group: groupChar,
              size_variant: sIdx + 1,
              trophy_type: group.kind || "custom",
              theme: group.theme || job.the_ask?.theme || "Custom Trophy",
              product_name: group.productName || job.the_ask?.product_name || "Custom Trophy",
              size: String(item.size || "8"),
              material: Array.isArray(group.mats) ? group.mats.join(" + ") : (group.mat || "MDF"),
              quantity: Number(item.qty || 50),
              target_rate: item.rate || item.budget || 0,
              line_total: (Number(item.qty) || 50) * (item.rate || item.budget || 0),
              stage: job.stage || "enquiry",
            });
          });
        });
      }
    }

    let subJob = job.sub_jobs.find((s) => s.sub_job_no === subJobNo);
    if (!subJob) {
      subJob = job.sub_jobs.find((s) => s.sub_job_no?.endsWith(subJobNo) || subJobNo?.endsWith(s.sub_job_no));
    }
    if (!subJob) return res.status(404).json({ success: false, message: `Sub-job ${subJobNo} not found` });

    subJob.is_dropped = true;
    subJob.drop_reason = reason;
    subJob.dropped_at = new Date();
    subJob.stage = "cancelled";

    // Sync to wizard_state specifically per item/variant
    if (job.wizard_state?.e?.trophyGroups && Array.isArray(job.wizard_state.e.trophyGroups)) {
      job.wizard_state.e.trophyGroups.forEach((tg, idx) => {
        const groupChar = String.fromCharCode(65 + idx);
        if (subJob.sub_job_no.includes(`-${groupChar}`) || tg.name === subJob.product_name || tg.theme === subJob.theme) {
          if (Array.isArray(tg.items)) {
            const match = subJob.sub_job_no.match(new RegExp(`-${groupChar}(\\d+)`));
            const variantIdx = match ? parseInt(match[1], 10) - 1 : -1;
            if (variantIdx >= 0 && tg.items[variantIdx]) {
              tg.items[variantIdx].is_dropped = true;
              tg.items[variantIdx].drop_reason = reason;
              tg.items[variantIdx].dropped_at = new Date().toISOString();
              tg.items.forEach((it, k) => {
                if (k !== variantIdx && it.is_dropped === undefined) {
                  it.is_dropped = false;
                }
              });
            } else {
              const matchedItem = tg.items.find((it) => String(it.size) === String(subJob.size));
              if (matchedItem) {
                matchedItem.is_dropped = true;
                matchedItem.drop_reason = reason;
              }
            }
          }
          const allItemsDropped = Array.isArray(tg.items) && tg.items.length > 0 && tg.items.every((it) => it.is_dropped);
          tg.is_dropped = allItemsDropped;
          if (allItemsDropped) {
            tg.drop_reason = reason;
          } else {
            delete tg.drop_reason;
          }
        }
      });
      job.markModified("wizard_state");
    }

    // Recalculate financial totals excluding dropped sub-jobs
    const activeSubJobs = job.sub_jobs.filter((s) => !s.is_dropped);
    const newSubtotal = activeSubJobs.reduce((acc, s) => acc + (s.line_total || 0), 0);
    const gstRate = job.financials?.gst_rate || 18;
    const gstAmount = Math.round((newSubtotal * gstRate) / 100);
    const total = newSubtotal + gstAmount;

    if (job.financials) {
      job.financials.subtotal = newSubtotal;
      job.financials.gst_amount = gstAmount;
      job.financials.total = total;
      job.financials.balance = total - (job.financials.advance_received || 0);
    }

    job.history.push({
      action: "SUB_JOB_DROPPED",
      sub_job_no: subJob.sub_job_no,
      remarks: `Sub-job ${subJob.sub_job_no} dropped: ${reason}. Financials recalibrated.`,
      changed_by: {
        user_id: req.user?.id || req.user?._id || null,
        user_name: req.user?.name || "User",
        role: req.user?.role || "Sales",
      },
      timestamp: new Date(),
    });

    await job.save();

    res.status(200).json({
      success: true,
      message: `Sub-job ${subJobNo} dropped successfully`,
      data: job,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// 9. Mark Job as Lost (Before Sample or Production)