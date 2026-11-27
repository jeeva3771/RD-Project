import EnquiryJob from "../../models/enquiry/enquiryJobModel.js";
import customerModel from "../../models/masters/customerModel.js";
import userModel from "../../models/users/userModel.js";
import roleModel from "../../models/masters/roleModel.js";
import departmentModel from "../../models/masters/departmentModel.js";
import { uploadToR2, generateSignedUrl, signJobWizardDesigns } from "../../helpers/r2helper.js";
import { computeNextEnquiry, getCurrentYearCode, formatEnquiryNo } from "../../config/enquiryConfig.js";
import mongoose from "mongoose";

// Generate sequential sub_job_no: e.g. parent "RD21072", groupIndex 0 -> A, sizeIndex 1 -> RD21072-A1
const _formatSubJobNo = (parentNo, groupIndex = 0, sizeIndex = 1) => {
  const groupChar = String.fromCharCode(65 + groupIndex); // 0 -> A, 1 -> B, 2 -> C
  return `${parentNo}-${groupChar}${sizeIndex}`;
};

// 1. Get next sequential job number (e.g. RD21072)
export const getNextEnquiryNumber = async (req, res) => {
  try {
    const currentYear = getCurrentYearCode();
    const lastJob = await EnquiryJob.findOne({
      $or: [{ year: currentYear }, { enquiry_no: new RegExp(`^RD${currentYear}`) }],
    }).sort({ seq: -1, createdAt: -1 });
    const { seq, enquiry_no, year } = computeNextEnquiry(lastJob, currentYear);
    res.status(200).json({
      success: true,
      enquiry_no,
      seq,
      year,
    });
  } catch (error) {
    console.error("Error fetching next enquiry number:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// Sync customer statistics in customerModel based on enquiry_flows
export const syncCustomerStats = async (customerId) => {
  try {
    if (!customerId) return;
    const cId = mongoose.Types.ObjectId.isValid(customerId)
      ? new mongoose.Types.ObjectId(customerId)
      : customerId;

    const allJobs = await EnquiryJob.find({ customer_id: cId }).lean();
    if (!allJobs) return;

    const totalEnquiries = allJobs.length;
    const inProcessJobs = allJobs.filter(
      (j) => !j.is_lost && ["enquiry", "brief", "sample", "production", "ready_for_dispatch", "dispatched"].includes(j.stage)
    ).length;
    const wonJobs = allJobs.filter(
      (j) => ["sample", "production", "ready_for_dispatch", "dispatched", "delivered", "closed"].includes(j.stage)
    ).length;

    const formattedLive = allJobs
      .filter((j) => !j.is_lost && ["enquiry", "brief", "sample", "production", "ready_for_dispatch"].includes(j.stage))
      .map((j) => ({
        id: j.enquiry_no,
        product: j.the_ask?.product_name || j.the_ask?.theme || "Custom Trophy",
        qty: j.delivery_details?.quantity || 0,
        stage: j.stage,
        value: j.financials?.total || 0,
        adv: j.financials?.advance_required || 0,
        recd: j.financials?.advance_received || 0,
        sample: j.stage === "sample",
        sub_jobs: j.sub_jobs || [],
      }));

    const lastJob = allJobs[allJobs.length - 1];
    const lastSummary = lastJob
      ? `${lastJob.stage} · ${lastJob.the_ask?.product_name || lastJob.the_ask?.theme || "Trophy"}`
      : "";

    await customerModel.findByIdAndUpdate(cId, {
      $set: {
        "stats.total_jobs": inProcessJobs,
        "stats.enquiries_count": totalEnquiries,
        "stats.won_count": wonJobs,
        "stats.last_enquiry_summary": lastSummary,
        live_jobs: formattedLive,
      },
    });
  } catch (err) {
    console.warn("Could not sync customer stats:", err);
  }
};

// 2. Create or initialize a new Enquiry Job in "enquiry_flows" collection
export const createEnquiryJob = async (req, res) => {
  try {
    const {
      customer_id,
      contact_id,
      ship_to_id,
      coordinator_name,
      step = 0,
      the_ask,
      the_brief,
      log_track,
      order_mode,
      delivery_details,
      financials,
      stage = "enquiry",
      wizard_state = {},
      sub_jobs,
    } = req.body;

    const currentYear = getCurrentYearCode();
    const lastJob = await EnquiryJob.findOne({
      $or: [{ year: currentYear }, { enquiry_no: new RegExp(`^RD${currentYear}`) }],
    }).sort({ seq: -1, createdAt: -1 });
    const nextInfo = computeNextEnquiry(lastJob, currentYear);
    const seq = req.body.seq || nextInfo.seq;
    const year = req.body.year || currentYear;
    const enquiry_no = req.body.enquiry_no || formatEnquiryNo(seq, year);

    // Process sub-jobs or auto-derive from trophyGroups in wizard_state/the_ask
    let processedSubJobs = [];
    if (Array.isArray(sub_jobs) && sub_jobs.length > 0) {
      processedSubJobs = sub_jobs;
    } else if (wizard_state?.e?.trophyGroups && Array.isArray(wizard_state.e.trophyGroups)) {
      wizard_state.e.trophyGroups.forEach((group, gIdx) => {
        const groupChar = String.fromCharCode(65 + gIdx);
        (group.items || [{ size: 8, qty: wizard_state.qty || 50 }]).forEach((item, sIdx) => {
          const subJobNo = `${enquiry_no}-${groupChar}${sIdx + 1}`;
          processedSubJobs.push({
            sub_job_no: subJobNo,
            design_group: groupChar,
            size_variant: sIdx + 1,
            trophy_type: group.kind || "custom",
            theme: group.theme || the_ask?.theme || "Custom Trophy",
            product_name: group.productName || the_ask?.product_name || "Custom Trophy",
            size: String(item.size || 8),
            quantity: item.qty || 0,
            target_rate: item.rate || item.budget || 0,
            line_total: (item.qty || 0) * (item.rate || item.budget || 0),
            stage: stage || "enquiry",
          });
        });
      });
    }

    // Initial audit log
    const initialHistory = [
      {
        action: "CREATED",
        step: step || 0,
        new_state: stage || "enquiry",
        remarks: `Enquiry ${enquiry_no} initialized at step ${step}`,
        changed_by: {
          user_id: req.user?.id || req.user?._id || null,
          user_name: req.user?.name || req.body.coordinator_name || "System",
          role: req.user?.role || "Coordinator",
        },
        timestamp: new Date(),
      },
    ];

    // Resolve customer_id string/nanoid to ObjectId
    let resolvedCustomerId = customer_id;
    if (customer_id) {
      if (!mongoose.Types.ObjectId.isValid(customer_id)) {
        const cust = await customerModel.findOne({ id: customer_id });
        if (cust) {
          resolvedCustomerId = cust._id;
        } else {
          // Fallback to first existing customer if prototype mockup ID passed
          const anyCust = await customerModel.findOne({});
          if (anyCust) resolvedCustomerId = anyCust._id;
        }
      }
    } else {
      const anyCust = await customerModel.findOne({});
      if (anyCust) resolvedCustomerId = anyCust._id;
    }

    // Resolve coordinator assigned_to user ID if coordinator_name provided
    let assignedUserId = req.user?.id || req.user?._id || null;
    if (coordinator_name) {
      const matchedCoordinator = await userModel.findOne({
        name: { $regex: new RegExp(`^${coordinator_name.trim()}$`, "i") },
      });
      if (matchedCoordinator) {
        assignedUserId = matchedCoordinator._id;
      }
    }

    const newJob = new EnquiryJob({
      enquiry_no,
      seq,
      step: step || 0,
      customer_id: resolvedCustomerId,
      contact_id,
      ship_to_id,
      coordinator_name,
      sub_jobs: processedSubJobs,
      the_ask: the_ask || {},
      the_brief: the_brief || {},
      log_track: log_track || {},
      order_mode: order_mode || {},
      delivery_details: delivery_details || {},
      financials: financials || {},
      stage: stage || "enquiry",
      wizard_state: wizard_state || {},
      history: initialHistory,
      created_by: req.user?.id || req.user?._id || null,
      assigned_to: assignedUserId,
    });

    const savedJob = await newJob.save();
    if (savedJob.customer_id) {
      await syncCustomerStats(savedJob.customer_id);
    }

    const resData = savedJob.toObject ? savedJob.toObject() : savedJob;
    signJobWizardDesigns(resData);

    res.status(201).json({
      success: true,
      message: "Enquiry Flow job created successfully",
      data: resData,
    });
  } catch (error) {
    console.error("Error creating Enquiry Job:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// 3. Get all enquiry jobs for Jobs Board (role-based filter: executive sees own jobs, admin/manager sees all)
export const getEnquiryJobs = async (req, res) => {
  try {
    const userRole = (req.user?.role || "").toLowerCase();
    const isHead = req.user?.is_head === true;
    const userId = req.user?.id || req.user?._id;

    const isAdminOrManager =
      userRole.includes("admin") ||
      userRole.includes("manager") ||
      userRole.includes("head") ||
      isHead;

    const query = {};
    if (!isAdminOrManager && (userId || req.user?.name)) {
      // CS Executive: view enquiries they created OR are assigned to (by ID or coordinator name)
      const userConditions = [];
      if (userId) {
        userConditions.push({ created_by: userId });
        userConditions.push({ assigned_to: userId });
      }
      if (req.user?.name) {
        userConditions.push({
          coordinator_name: { $regex: new RegExp(`^${req.user.name.trim()}$`, "i") },
        });
      }
      query.$or = userConditions;
    }

    const jobs = await EnquiryJob.find(query)
      .populate("customer_id", "name contact_person mobile_no email address color_hue short_name")
      .populate("assigned_to", "name")
      .sort({ createdAt: -1 })
      .lean();

    // Map signed URLs for thumbnail previews and wizard designs
    const jobsWithSignedUrls = jobs.map((j) => {
      signJobWizardDesigns(j);
      if (j.sub_jobs && Array.isArray(j.sub_jobs)) {
        j.sub_jobs.forEach((sj) => {
          if (sj.proof_files) {
            sj.proof_files.forEach((pf) => {
              pf.signed_url = generateSignedUrl(pf.file_url);
              pf.url = pf.signed_url;
            });
          }
          if (sj.design_files) {
            sj.design_files.forEach((df) => {
              df.signed_url = generateSignedUrl(df.file_url);
              df.url = df.signed_url;
            });
          }
        });
      }
      return j;
    });

    res.status(200).json({
      success: true,
      message: "Fetched successfully",
      data: jobsWithSignedUrls,
    });
  } catch (error) {
    console.error("Error fetching Enquiry Jobs:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// 4. Get a specific enquiry job by ID for auto-resume
export const getEnquiryJobById = async (req, res) => {
  try {
    const { id } = req.params;
    const query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { enquiry_no: id };
    const job = await EnquiryJob.findOne(query)
      .populate("customer_id", "name contact_person mobile_no email address color_hue short_name")
      .populate("assigned_to", "name")
      .lean();

    if (!job) {
      return res.status(404).json({ success: false, message: "Enquiry Job not found" });
    }

    // Attach 24-hr signed URLs to all files and wizard designs
    signJobWizardDesigns(job);
    if (job.sub_jobs && Array.isArray(job.sub_jobs)) {
      job.sub_jobs.forEach((sj) => {
        if (sj.dtp_files) sj.dtp_files.forEach((f) => { f.signed_url = generateSignedUrl(f.file_url); f.url = f.signed_url; });
        if (sj.packing_files) sj.packing_files.forEach((f) => { f.signed_url = generateSignedUrl(f.file_url); f.url = f.signed_url; });
        if (sj.proof_files) sj.proof_files.forEach((f) => { f.signed_url = generateSignedUrl(f.file_url); f.url = f.signed_url; });
        if (sj.design_files) sj.design_files.forEach((f) => { f.signed_url = generateSignedUrl(f.file_url); f.url = f.signed_url; });
      });
    }

    if (job.common_files) {
      Object.keys(job.common_files).forEach((cat) => {
        if (Array.isArray(job.common_files[cat])) {
          job.common_files[cat].forEach((f) => (f.signed_url = generateSignedUrl(f.file_url)));
        }
      });
    }

    res.status(200).json({
      success: true,
      message: "Fetched successfully",
      data: job,
    });
  } catch (error) {
    console.error("Error fetching Enquiry Job by ID:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// 5. Update an existing enquiry job (Step autosave, edit, sync)
export const updateEnquiryJob = async (req, res) => {
  try {
    const { id } = req.params;
    const existingJob = await EnquiryJob.findById(id);
    if (!existingJob) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    if (req.body.customer_id && !mongoose.Types.ObjectId.isValid(req.body.customer_id)) {
      const cust = await customerModel.findOne({ id: req.body.customer_id });
      if (cust) req.body.customer_id = cust._id;
    }

    // Determine audit history entry
    const historyEntry = {
      action: req.body.action || "STEP_UPDATED",
      step: req.body.step !== undefined ? req.body.step : existingJob.step,
      previous_state: existingJob.stage,
      new_state: req.body.stage || existingJob.stage,
      remarks: req.body.remarks || `Updated step ${req.body.step !== undefined ? req.body.step : existingJob.step}`,
      changed_by: {
        user_id: req.user?.id || req.user?._id || null,
        user_name: req.user?.name || req.body.coordinator_name || "User",
        role: req.user?.role || "Sales",
      },
      timestamp: new Date(),
    };

    // Resolve coordinator assigned_to user ID if coordinator_name is updated
    let updateAssignedTo = req.body.assigned_to;
    if (req.body.coordinator_name) {
      const matchedCoordinator = await userModel.findOne({
        name: { $regex: new RegExp(`^${req.body.coordinator_name.trim()}$`, "i") },
      });
      if (matchedCoordinator) {
        updateAssignedTo = matchedCoordinator._id;
      }
    }

    // Merge & preserve DTP & Proof properties from existingJob to prevent stale frontend overwrites
    if (Array.isArray(req.body.sub_jobs) && existingJob.sub_jobs) {
      req.body.sub_jobs = req.body.sub_jobs.map((newSj) => {
        const existingSj = (existingJob.sub_jobs || []).find(
          (s) => s.sub_job_no === newSj.sub_job_no
        );
        if (!existingSj) return newSj;
        const exObj = existingSj.toObject ? existingSj.toObject() : existingSj;
        return {
          ...exObj,
          ...newSj,
          dtp_id: newSj.dtp_id || exObj.dtp_id || null,
          proof_status: (newSj.proof_status && newSj.proof_status !== "pending") ? newSj.proof_status : (exObj.proof_status || newSj.proof_status || "pending"),
          master_template_status: (newSj.master_template_status && newSj.master_template_status !== "pending") ? newSj.master_template_status : (exObj.master_template_status || newSj.master_template_status || "pending"),
          content_proof_status: (newSj.content_proof_status && newSj.content_proof_status !== "pending") ? newSj.content_proof_status : (exObj.content_proof_status || newSj.content_proof_status || "pending"),
          proof_decision: newSj.proof_decision || exObj.proof_decision || null,
          proof_approved_at: newSj.proof_approved_at || exObj.proof_approved_at || null,
          master_template_approved_at: newSj.master_template_approved_at || exObj.master_template_approved_at || null,
          content_proof_approved_at: newSj.content_proof_approved_at || exObj.content_proof_approved_at || null,
          dtp_files: (newSj.dtp_files && newSj.dtp_files.length > 0) ? newSj.dtp_files : (exObj.dtp_files || []),
          proof_files: (newSj.proof_files && newSj.proof_files.length > 0) ? newSj.proof_files : (exObj.proof_files || []),
          sample_order_id: newSj.sample_order_id || exObj.sample_order_id || null,
          sample_order_nanoid: newSj.sample_order_nanoid || exObj.sample_order_nanoid || null,
          sales_order_id: newSj.sales_order_id || exObj.sales_order_id || null,
          sales_order_nanoid: newSj.sales_order_nanoid || exObj.sales_order_nanoid || null,
          sample_qty: newSj.sample_qty !== undefined ? newSj.sample_qty : (exObj.sample_qty || null),
          sample_rate: newSj.sample_rate !== undefined ? newSj.sample_rate : (exObj.sample_rate || null),
          is_sample_approved: newSj.is_sample_approved !== undefined ? newSj.is_sample_approved : exObj.is_sample_approved,
          is_sample: newSj.is_sample !== undefined ? newSj.is_sample : exObj.is_sample,
        };
      });
    }

    if (req.body.wizard_state && existingJob.wizard_state?.dtp) {
      req.body.wizard_state.dtp = req.body.wizard_state.dtp || {};
      ["sample", "production"].forEach((ph) => {
        if (existingJob.wizard_state.dtp[ph]?.approved && !req.body.wizard_state.dtp[ph]?.approved) {
          req.body.wizard_state.dtp[ph] = {
            ...(req.body.wizard_state.dtp[ph] || {}),
            ...existingJob.wizard_state.dtp[ph],
          };
        }
      });
    }

    const updatePayload = {
      ...req.body,
      ...(updateAssignedTo ? { assigned_to: updateAssignedTo } : {}),
      updated_by: req.user?.id || req.user?._id || null,
      $push: { history: historyEntry },
    };

    const updatedJob = await EnquiryJob.findByIdAndUpdate(id, updatePayload, {
      new: true,
      runValidators: true,
    });
    if (updatedJob?.customer_id) {
      await syncCustomerStats(updatedJob.customer_id);
    }

    const resData = updatedJob?.toObject ? updatedJob.toObject() : updatedJob;
    signJobWizardDesigns(resData);

    res.status(200).json({
      success: true,
      message: "Job updated successfully",
      data: resData,
    });
  } catch (error) {
    console.error("Error updating Enquiry Job:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// 6. Upload file directly to Cloudflare R2 under Client ID & Enquiry folder structure
export const uploadEnquiryFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file provided" });
    }

    const { clientId, enquiryNo, folderType = "design", subJobNo } = req.body;
    const effClientId = clientId || "general";
    const effEnquiryNo = enquiryNo || "RD_ENQUIRY";

    // Folder structure: clients/{clientId}/enquiries/{enquiryNo}/{folderType}/{subJobNo?}/...
    const subJobPrefix = subJobNo ? `${subJobNo}/` : "";
    const folderPath = `clients/${effClientId}/enquiries/${effEnquiryNo}/${folderType}/${subJobPrefix}`.replace(/\/+$/, "");

    const fileUrl = await uploadToR2(folderPath, req.file.buffer, req.file.originalname, req.file.mimetype);
    const signedUrl = generateSignedUrl(fileUrl, 86400);

    res.status(200).json({
      success: true,
      message: "File uploaded successfully to R2",
      data: {
        file_url: fileUrl,
        signed_url: signedUrl,
        file_name: req.file.originalname,
        folder_path: folderPath,
        folder_type: folderType,
        sub_job_no: subJobNo || null,
      },
    });
  } catch (error) {
    console.error("Error uploading file to R2:", error);
    res.status(500).json({ success: false, message: "Upload failed", error: error.message });
  }
};

// 7. Sub-Job Action: Hold / Unhold
export const toggleHoldSubJob = async (req, res) => {
  try {
    const { id, subJobNo } = req.params;
    const { hold, reason = "" } = req.body;

    const job = await EnquiryJob.findById(id);
    if (!job) return res.status(404).json({ success: false, message: "Job not found" });

    const subJob = job.sub_jobs.find((s) => s.sub_job_no === subJobNo);
    if (!subJob) return res.status(404).json({ success: false, message: "Sub-job not found" });

    subJob.is_on_hold = !!hold;
    if (hold) {
      subJob.hold_reason = reason;
      subJob.held_at = new Date();
    } else {
      subJob.unheld_at = new Date();
    }

    job.history.push({
      action: hold ? "SUB_JOB_HOLD" : "SUB_JOB_UNHELD",
      sub_job_no: subJobNo,
      remarks: hold ? `Sub-job ${subJobNo} placed on hold: ${reason}` : `Sub-job ${subJobNo} unheld`,
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
      message: `Sub-job ${subJobNo} ${hold ? "placed on hold" : "unheld"} successfully`,
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

    const subJob = job.sub_jobs.find((s) => s.sub_job_no === subJobNo);
    if (!subJob) return res.status(404).json({ success: false, message: "Sub-job not found" });

    subJob.is_dropped = true;
    subJob.drop_reason = reason;
    subJob.dropped_at = new Date();
    subJob.stage = "cancelled";

    // Recalculate financial totals excluding dropped sub-jobs
    const activeSubJobs = job.sub_jobs.filter((s) => !s.is_dropped);
    const newSubtotal = activeSubJobs.reduce((acc, s) => acc + (s.line_total || 0), 0);
    const gstRate = job.financials?.gst_rate || 18;
    const gstAmount = Math.round((newSubtotal * gstRate) / 100);
    const total = newSubtotal + gstAmount;

    job.financials.subtotal = newSubtotal;
    job.financials.gst_amount = gstAmount;
    job.financials.total = total;
    job.financials.balance = total - (job.financials.advance_received || 0);

    job.history.push({
      action: "SUB_JOB_DROPPED",
      sub_job_no: subJobNo,
      remarks: `Sub-job ${subJobNo} dropped: ${reason}. Financials recalibrated.`,
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
export const markJobLost = async (req, res) => {
  try {
    const { id } = req.params;
    const { lost_stage = "enquiry", lost_reason = "", lost_to_competitor = "" } = req.body;

    const job = await EnquiryJob.findById(id);
    if (!job) return res.status(404).json({ success: false, message: "Job not found" });

    job.is_lost = true;
    job.stage = "lost";
    job.lost_stage = lost_stage;
    job.lost_reason = lost_reason;
    job.lost_to_competitor = lost_to_competitor;
    job.lost_at = new Date();
    job.lost_by = req.user?.id || req.user?._id || null;

    job.history.push({
      action: "MARKED_LOST",
      remarks: `Enquiry marked lost at ${lost_stage} stage: ${lost_reason} ${lost_to_competitor ? `(Competitor: ${lost_to_competitor})` : ""}`,
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
      message: "Enquiry marked as lost",
      data: job,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// 10. Client Level Live Stats Aggregation (In-Process vs Completed Trophies & Real-time Outstanding)
export const getClientEnquiryStats = async (req, res) => {
  try {
    const { clientId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      return res.status(400).json({ success: false, message: "Invalid client ID" });
    }

    const cId = new mongoose.Types.ObjectId(clientId);

    const stats = await EnquiryJob.aggregate([
      {
        $match: {
          customer_id: cId,
          is_lost: { $ne: true },
        },
      },
      {
        $group: {
          _id: "$customer_id",
          total_enquiries: { $sum: 1 },

          // In-process jobs count & value
          in_process_jobs: {
            $sum: {
              $cond: [
                { $in: ["$stage", ["enquiry", "brief", "sample", "production", "ready_for_dispatch", "dispatched"]] },
                1,
                0,
              ],
            },
          },
          in_process_value: {
            $sum: {
              $cond: [
                { $in: ["$stage", ["enquiry", "brief", "sample", "production", "ready_for_dispatch", "dispatched"]] },
                "$financials.total",
                0,
              ],
            },
          },

          // Completed trophies count
          completed_jobs: {
            $sum: {
              $cond: [{ $in: ["$stage", ["delivered", "closed"]] }, 1, 0],
            },
          },

          // Financials
          total_ordered: { $sum: "$financials.total" },
          total_advance_received: { $sum: "$financials.advance_received" },
          realtime_outstanding: {
            $sum: { $subtract: ["$financials.total", "$financials.advance_received"] },
          },
        },
      },
    ]);

    // Live jobs list for client card
    const liveJobs = await EnquiryJob.find({
      customer_id: cId,
      stage: { $in: ["brief", "sample", "production", "ready_for_dispatch"] },
      is_lost: { $ne: true },
    })
      .select("enquiry_no the_ask delivery_details stage financials sub_jobs")
      .lean();

    const formattedLive = liveJobs.map((j) => ({
      id: j.enquiry_no,
      product: j.the_ask?.product_name || j.the_ask?.theme || "Custom Trophy",
      qty: j.delivery_details?.quantity || 0,
      stage: j.stage,
      value: j.financials?.total || 0,
      adv: j.financials?.advance_required || 0,
      recd: j.financials?.advance_received || 0,
      sample: j.stage === "sample",
      sub_jobs: j.sub_jobs || [],
    }));

    const pastJobs = await EnquiryJob.find({
      customer_id: cId,
      is_lost: { $ne: true },
    })
      .select("enquiry_no the_ask delivery_details stage financials sub_jobs createdAt")
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    const formattedPast = [];
    pastJobs.forEach((j) => {
      const monthStr = j.createdAt
        ? new Date(j.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })
        : "Recent";

      if (j.sub_jobs && Array.isArray(j.sub_jobs) && j.sub_jobs.length > 0) {
        j.sub_jobs.forEach((sj) => {
          const pName = (sj.theme || sj.product_name || j.the_ask?.theme || j.the_ask?.product_name || "Custom Trophy").trim();
          if (!formattedPast.some((po) => po.name.toLowerCase() === pName.toLowerCase())) {
            formattedPast.push({
              name: pName,
              month: monthStr,
              size: sj.size || 8,
              rate: sj.target_rate || (sj.line_total && sj.quantity ? Math.round(sj.line_total / sj.quantity) : 850),
              mat: sj.material || "MDF",
              qty: sj.quantity || 50,
            });
          }
        });
      } else {
        const pName = (j.the_ask?.theme || j.the_ask?.product_name || "Custom Trophy").trim();
        if (!formattedPast.some((po) => po.name.toLowerCase() === pName.toLowerCase())) {
          formattedPast.push({
            name: pName,
            month: monthStr,
            size: j.the_ask?.size || 8,
            rate: j.financials?.total && j.delivery_details?.quantity ? Math.round(j.financials.total / j.delivery_details.quantity) : 850,
            mat: j.the_ask?.material || "MDF",
            qty: j.delivery_details?.quantity || 50,
          });
        }
      }
    });

    const resultStats = stats[0] || {
      total_enquiries: 0,
      in_process_jobs: 0,
      in_process_value: 0,
      completed_jobs: 0,
      total_ordered: 0,
      total_advance_received: 0,
      realtime_outstanding: 0,
    };

    res.status(200).json({
      success: true,
      stats: resultStats,
      live_jobs: formattedLive,
      past_orders: formattedPast,
    });
  } catch (error) {
    console.error("Error aggregating client enquiry stats:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// 10. Get all Client Servicing Managers and Executives for assignment
export const getCoordinators = async (req, res) => {
  try {
    const csDepts = await departmentModel.find({ name: /client servicing/i }).select("_id");
    const deptIds = csDepts.map((d) => d._id);

    const csRoles = await roleModel.find({ name: /client servicing/i }).select("_id name");
    const roleIds = csRoles.map((r) => r._id);
    const roleMap = csRoles.reduce((acc, r) => {
      acc[String(r._id)] = r.name;
      return acc;
    }, {});

    let users = await userModel
      .find({
        is_active: true,
        $or: [
          { department_id: { $in: deptIds } },
          { role: { $in: roleIds } },
          { name: /client servicing/i },
        ],
      })
      .populate("role", "name")
      .select("id name username email role department_id")
      .lean();

    // Fallback if no specific CS users found
    if (!users || users.length === 0) {
      users = await userModel.find({ is_active: true }).limit(5).populate("role", "name").lean();
    }

    // Count open enquiries per coordinator from enquiry_flows
    const openEnquiriesByUser = await EnquiryJob.aggregate([
      { $match: { stage: { $in: ["enquiry", "brief", "sample", "production"] }, is_lost: { $ne: true } } },
      { $group: { _id: "$coordinator_name", count: { $sum: 1 } } },
    ]);
    const loadMap = {};
    openEnquiriesByUser.forEach((item) => {
      if (item._id) loadMap[item._id] = item.count;
    });

    const coordinators = users.map((u) => {
      const roleName = u.role?.name || roleMap[String(u.role)] || "Client Servicing";
      const openCount = loadMap[u.name] || 0;
      return {
        id: u.id || String(u._id),
        _id: String(u._id),
        name: u.name,
        username: u.username,
        role: roleName,
        is_manager: /manager/i.test(roleName),
        is_executive: /executive/i.test(roleName),
        open_enquiries: openCount,
      };
    });

    res.status(200).json({
      success: true,
      data: coordinators,
    });
  } catch (error) {
    console.error("Error fetching coordinators:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching coordinators",
      error: error.message,
    });
  }
};

