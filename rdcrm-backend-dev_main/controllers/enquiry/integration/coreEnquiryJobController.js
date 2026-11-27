import EnquiryJob from "../../../models/enquiry/enquiryJobIntegrationModel.js";
import customerModel from "../../../models/masters/customerModel.js";
import userModel from "../../../models/users/userModel.js";
import { signJobWizardDesigns } from "../../../helpers/r2helper.js";
import mongoose from "mongoose";
import { computeNextEnquiry, getCurrentYearCode, formatEnquiryNo, parseEnquiryNo } from "../../../config/enquiryConfig.js";
import {
  _formatSubJobNo,
  sanitizeDepth,
  computeJobBucketsAndKpis,
  formatBoardCardSummary,
  buildJobsSearchFilter,
  syncCustomerStats,
  getAssignedCustomerIdsForUser,
  enrichJobWithSignedAssetsAndBOM,
  mapTrophyGroupItemsToSubJobs,
  BOARD_SCAN_PROJECTION,
  BOARD_CARD_PROJECTION,
} from "./coreEnquiryJobHelpers.js";

// Re-export handlers from modular helpers and controllers
export { getNextEnquiryNumber, uploadEnquiryFile, markJobLost, getClientEnquiryStats } from "./enquiryFileController.js";
export { syncCustomerStats };

// 2. Create or initialize a new Enquiry Job in "enquiry_flows_integration" collection
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
    let seq = req.body.seq || nextInfo.seq;
    const year = req.body.year || currentYear;
    let enquiry_no = req.body.enquiry_no;
    if (enquiry_no && (await EnquiryJob.exists({ enquiry_no }))) {
      enquiry_no = nextInfo.enquiry_no;
      seq = nextInfo.seq;
    }
    if (!enquiry_no || !parseEnquiryNo(enquiry_no)?.year) {
      enquiry_no = formatEnquiryNo(seq, year);
    }

    // Derive effective size and quantity with robust default fallback (size: 8, qty: 50)
    const effSize = String(
      the_ask?.size ||
      wizard_state?.e?.size ||
      "8"
    );

    const effQty = Number(
      the_ask?.quantity ||
      delivery_details?.quantity ||
      wizard_state?.qty ||
      wizard_state?.e?.qty ||
      50
    );

    // Process sub-jobs or auto-derive from trophyGroups in wizard_state/the_ask
    let processedSubJobs = [];
    if (Array.isArray(sub_jobs) && sub_jobs.length > 0) {
      processedSubJobs = sub_jobs;
    } else if (wizard_state?.e?.trophyGroups && Array.isArray(wizard_state.e.trophyGroups)) {
      processedSubJobs = mapTrophyGroupItemsToSubJobs({
        trophyGroups: wizard_state.e.trophyGroups,
        enquiry_no,
        effSize,
        effQty,
        stage: stage || "enquiry",
      });
    }

    // If still empty, create default sub-job
    if (processedSubJobs.length === 0) {
      processedSubJobs.push({
        sub_job_no: `${enquiry_no}-A1`,
        design_group: "A",
        size_variant: 1,
        trophy_type: "custom",
        theme: the_ask?.theme || "Custom Trophy",
        product_name: the_ask?.product_name || "Custom Trophy",
        size: effSize,
        material: the_ask?.material || "MDF",
        quantity: effQty,
        target_rate: 0,
        line_total: 0,
        stage: stage || "enquiry",
      });
    } else {
      processedSubJobs.forEach((sj) => {
        if (!sj.size || sj.size === "undefined" || sj.size === "null") sj.size = effSize;
        if (!sj.quantity || sj.quantity === 0) sj.quantity = effQty;
        if (!sj.product_name) sj.product_name = the_ask?.theme || the_ask?.product_name || "Custom Trophy";
        if (!sj.material) sj.material = the_ask?.material || "MDF";
        if (!sj.spec) sj.spec = {};
        if (sj.colourQuantities && sj.colourQuantities.length > 0) sj.spec.colourQuantities = sj.colourQuantities;
        if (sj.colour) sj.spec.colour = sj.colour;
        if (sj.customFinishes && sj.customFinishes.length > 0) sj.spec.customFinishes = sj.customFinishes;
        if (sj.sizeDimensions && sj.sizeDimensions.length > 0) sj.spec.sizeDimensions = sj.sizeDimensions;
        if (sj.sizeRate !== undefined) sj.spec.sizeRate = sj.sizeRate;
      });
    }

    // Initial audit log
    const initialHistory = [
      {
        action: "CREATED",
        step: step || 0,
        new_state: stage || "enquiry",
        remarks: `Enquiry (Integration) ${enquiry_no} initialized at step ${step}`,
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
    let customerDoc = null;
    if (customer_id) {
      if (!mongoose.Types.ObjectId.isValid(customer_id)) {
        customerDoc = await customerModel.findOne({ id: customer_id });
        if (customerDoc) {
          resolvedCustomerId = customerDoc._id;
        } else {
          return res.status(400).json({ success: false, message: "Invalid or non-existent customer ID." });
        }
      } else {
        customerDoc = await customerModel.findById(customer_id);
        if (!customerDoc) {
          return res.status(400).json({ success: false, message: "Customer not found." });
        }
      }
    } else {
      return res.status(400).json({ success: false, message: "Customer ID is required." });
    }

    // Resolve contact_id and contact details from customer master
    let resolvedContactId = contact_id || null;
    let resolvedContactPerson = req.body.contact_person || "";
    let resolvedContactMobile = req.body.contact_mobile || "";
    let resolvedContactEmail = req.body.contact_email || "";

    if (customerDoc) {
      const allContacts = [
        ...(Array.isArray(customerDoc.contacts) ? customerDoc.contacts : []),
        ...(Array.isArray(customerDoc.additional_contacts) ? customerDoc.additional_contacts : []),
      ];
      if (allContacts.length > 0) {
        const matched = resolvedContactId
          ? allContacts.find((c) => String(c.id || c._id) === String(resolvedContactId))
          : allContacts[0];
        if (matched) {
          if (!resolvedContactId) resolvedContactId = String(matched.id || matched._id || "");
          if (!resolvedContactPerson) resolvedContactPerson = matched.name || "";
          if (!resolvedContactMobile) resolvedContactMobile = matched.mobile_no || matched.phone || "";
          if (!resolvedContactEmail) resolvedContactEmail = matched.email || "";
        }
      } else if (!resolvedContactPerson && customerDoc.contact_person && customerDoc.contact_person !== "Primary Contact") {
        resolvedContactPerson = customerDoc.contact_person;
        resolvedContactMobile = customerDoc.mobile_no || "";
        resolvedContactEmail = customerDoc.email || "";
      }
    }

    // Resolve coordinator assigned_to user ID ONLY if coordinator_name is explicitly provided
    let assignedUserId = null;
    if (coordinator_name && String(coordinator_name).trim()) {
      const matchedCoordinator = await userModel.findOne({
        name: { $regex: new RegExp("^" + coordinator_name.trim() + "$", "i") },
      });
      if (matchedCoordinator) {
        assignedUserId = matchedCoordinator._id;
      }
    }

    const effDesignerId =
      req.body.assigned_designer ||
      the_brief?.designer_id ||
      wizard_state?.e?.assignedDesigner ||
      wizard_state?.e?.designer_id ||
      null;

    const effDesignerName =
      req.body.assigned_designer_name ||
      the_brief?.designer_name ||
      wizard_state?.e?.assignedDesignerName ||
      wizard_state?.e?.designer_name ||
      null;

    const effOptionsDueIn = Number(
      req.body.options_due_in ||
      req.body["the_brief.options_due_in"] ||
      the_brief?.options_due_in ||
      wizard_state?.e?.optionsDueIn ||
      24
    );

    const effDesignerAssignedAt =
      the_brief?.designer_assigned_at ||
      req.body.designer_assigned_at ||
      wizard_state?.e?.designer_assigned_at ||
      (effDesignerId ? new Date() : null);

    const processedTheBrief = {
      brief_text: "",
      design_needed: true,
      options_count: 2,
      options_due_in: effOptionsDueIn,
      links_duration: req.body.links_duration || the_brief?.links_duration || wizard_state?.e?.links_duration || 24,
      ...(the_brief || {}),
      ...(effDesignerId ? { designer_id: effDesignerId } : {}),
      ...(effDesignerName ? { designer_name: effDesignerName } : {}),
      ...(effDesignerAssignedAt ? { designer_assigned_at: effDesignerAssignedAt } : {}),
      ...(wizard_state?.e?.productBriefs ? { product_briefs: wizard_state.e.productBriefs } : {}),
    };

    if ((!processedTheBrief.signatures || processedTheBrief.signatures.length === 0) && (wizard_state?.e?.globalSignatures?.length > 0 || wizard_state?.e?.signatures?.length > 0)) {
      processedTheBrief.signatures = wizard_state?.e?.globalSignatures || wizard_state?.e?.signatures;
    }
    if ((!processedTheBrief.client_logo || processedTheBrief.client_logo.length === 0) && (wizard_state?.e?.globalLogos?.length > 0 || wizard_state?.e?.clientLogo?.length > 0 || wizard_state?.e?.clientLogos?.length > 0)) {
      processedTheBrief.client_logo = wizard_state?.e?.globalLogos || wizard_state?.e?.clientLogo || wizard_state?.e?.clientLogos;
    }
    if ((!processedTheBrief.additional_files || processedTheBrief.additional_files.length === 0) && (wizard_state?.e?.globalAdditionalFiles?.length > 0 || wizard_state?.e?.additionalFiles?.length > 0 || wizard_state?.e?.additional_files?.length > 0)) {
      processedTheBrief.additional_files = wizard_state?.e?.globalAdditionalFiles || wizard_state?.e?.additionalFiles || wizard_state?.e?.additional_files;
    }

    const effNeededOrDeliveryDate =
      req.body.needed_by_date ||
      req.body.delivery_date ||
      the_ask?.needed_by_date ||
      the_ask?.delivery_date ||
      delivery_details?.needed_by_date ||
      delivery_details?.delivery_date ||
      wizard_state?.e?.delivery_date ||
      wizard_state?.e?.neededByDate ||
      wizard_state?.e?.deliveryDate ||
      null;

    const effEventDate =
      req.body.event_date ||
      the_ask?.event_date ||
      wizard_state?.e?.event_date ||
      wizard_state?.e?.eventExactDate ||
      wizard_state?.e?.eventDate ||
      null;

    const effJobCompletionDate =
      req.body.job_completion_date ||
      the_ask?.job_completion_date ||
      delivery_details?.job_completion_date ||
      wizard_state?.e?.jobCompletionDate ||
      null;

    const processedTheAsk = {
      product_type: "Trophy",
      theme: "Custom Trophy",
      ask_mode: "custom",
      product_name: "Custom Trophy",
      material: "MDF",
      ...(the_ask || {}),
      size: effSize,
      quantity: effQty,
      ...(effEventDate ? { event_date: effEventDate } : {}),
      ...(effNeededOrDeliveryDate ? { needed_by_date: effNeededOrDeliveryDate, delivery_date: effNeededOrDeliveryDate } : {}),
      ...(effJobCompletionDate ? { job_completion_date: effJobCompletionDate } : {}),
    };

    const processedDeliveryDetails = {
      ...(delivery_details || {}),
      quantity: Number(delivery_details?.quantity || effQty),
      ...(effNeededOrDeliveryDate ? { needed_by_date: effNeededOrDeliveryDate, delivery_date: effNeededOrDeliveryDate } : {}),
      ...(effJobCompletionDate ? { job_completion_date: effJobCompletionDate } : {}),
    };

    const newJob = new EnquiryJob({
      enquiry_no,
      seq,
      year: year || currentYear,
      step: step || 0,
      customer_id: resolvedCustomerId,
      contact_id: resolvedContactId,
      contact_person: resolvedContactPerson,
      contact_mobile: resolvedContactMobile,
      contact_email: resolvedContactEmail,
      ship_to_id,
      coordinator_name,
      sub_jobs: processedSubJobs,
      event_date: effEventDate,
      needed_by_date: effNeededOrDeliveryDate,
      delivery_date: effNeededOrDeliveryDate,
      job_completion_date: effJobCompletionDate,
      the_ask: processedTheAsk,
      the_brief: processedTheBrief,
      assigned_designer: effDesignerId,
      assigned_designer_name: effDesignerName,
      log_track: log_track || {},
      order_mode: order_mode || {},
      delivery_details: processedDeliveryDetails,
      financials: financials || {},
      stage: stage || "enquiry",
      sample_rates_approved: Boolean(req.body.sample_rates_approved || wizard_state?.ratesApproved || wizard_state?.sampleConfirmed),
      wizard_state: sanitizeDepth(wizard_state) || {},
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
      message: "Enquiry Flow (Integration) job created successfully",
      data: resData,
    });
  } catch (error) {
    console.error("Error creating Enquiry Job (integration):", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// 3. Get all enquiry jobs for Jobs Board
export const getEnquiryJobs = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const assignedCustIds = await getAssignedCustomerIdsForUser(req.user);

    const query = {};
    if (assignedCustIds !== null) {
      // Client Servicing Executive: only see enquiries for assigned clients or created by executive
      const userObjId = userId && mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null;
      const userConditions = [
        { customer_id: { $in: assignedCustIds } },
        ...(userId ? [{ created_by: userId }] : []),
        ...(userObjId ? [{ created_by: userObjId }] : []),
      ];
      query.$or = userConditions;
    }

    // Apply search filter (enquiry_no, sub_jobs.sub_job_no, customer name, product_name)
    const searchFilter = await buildJobsSearchFilter(req.query.search);
    if (searchFilter) {
      if (query.$or) {
        query.$and = [{ $or: query.$or }, searchFilter];
        delete query.$or;
      } else {
        Object.assign(query, searchFilter);
      }
    }

    // Step 1: Ultra-minimal scan for bucket counts, KPIs, week schedule & pagination IDs (Latest created job first)
    const allJobsMeta = await EnquiryJob.find(query)
      .select(BOARD_SCAN_PROJECTION)
      .sort({ createdAt: -1, seq: -1 })
      .lean();

    const { filteredJobs, bucketCounts, kpis, week } = computeJobBucketsAndKpis(
      allJobsMeta,
      req.query.bucket || "all",
      req.query.day || null
    );

    const totalFiltered = filteredJobs.length;

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const parsedLimit = parseInt(req.query.limit);
    const isPaginated = !isNaN(parsedLimit) && parsedLimit > 0;
    const limit = isPaginated ? parsedLimit : (req.query.all === "true" ? Math.max(1, totalFiltered) : 25);

    let paginatedMeta = filteredJobs;
    if (isPaginated) {
      const skip = (page - 1) * limit;
      paginatedMeta = filteredJobs.slice(skip, skip + limit);
    }

    // Step 2: Fetch card display details ONLY for the paginated slice (e.g. 8 jobs)
    const pageIds = paginatedMeta.map((m) => m._id);
    const pageDocs =
      pageIds.length > 0
        ? await EnquiryJob.find({ _id: { $in: pageIds } }).select(BOARD_CARD_PROJECTION).lean()
        : [];
    const docById = new Map(pageDocs.map((d) => [d._id.toString(), d]));

    // Step 3: Resolve customer names and coordinator names ONLY for those paginated docs
    const custIdsToFetch = [
      ...new Set(
        pageDocs
          .map((j) => j.customer_id)
          .filter((id) => id && mongoose.Types.ObjectId.isValid(id))
          .map((id) => id.toString())
      ),
    ];
    const userIdsToFetch = [
      ...new Set(
        pageDocs
          .map((j) => j.assigned_to)
          .concat(pageDocs.map((j) => j.created_by))
          .filter((id) => id && mongoose.Types.ObjectId.isValid(id))
          .map((id) => id.toString())
      ),
    ];

    const [customersList, usersList] = await Promise.all([
      custIdsToFetch.length > 0
        ? customerModel.find({ _id: { $in: custIdsToFetch } }, "name").lean().catch(() => [])
        : Promise.resolve([]),
      userIdsToFetch.length > 0
        ? userModel.find({ _id: { $in: userIdsToFetch } }, "name").lean().catch(() => [])
        : Promise.resolve([]),
    ]);

    const customerMap = new Map(customersList.map((c) => [c._id.toString(), c]));
    const userMap = new Map(usersList.map((u) => [u._id.toString(), u]));

    // Return lean flat card summaries (only the 16 fields rendered on JobsBoard UI)
    const boardCards = paginatedMeta
      .map((meta) => {
        const doc = docById.get(meta._id.toString());
        if (!doc) return null;
        const custKey = doc.customer_id ? doc.customer_id.toString() : null;
        const userKey = doc.assigned_to ? doc.assigned_to.toString() : null;
        const createdByKey = doc.created_by ? doc.created_by.toString() : null;
        const hydrated = {
          ...doc,
          customer_id: custKey && customerMap.has(custKey) ? customerMap.get(custKey) : doc.customer_id,
          assigned_to: userKey && userMap.has(userKey) ? userMap.get(userKey) : doc.assigned_to,
          created_by_user: createdByKey && userMap.has(createdByKey) ? userMap.get(createdByKey) : null,
        };
        return formatBoardCardSummary(hydrated, meta);
      })
      .filter(Boolean);

    res.status(200).json({
      success: true,
      message: "Fetched successfully",
      total: totalFiltered,
      page,
      limit,
      totalPages: Math.ceil(totalFiltered / limit),
      bucketCounts,
      kpis,
      week,
      data: boardCards,
    });
  } catch (error) {
    console.error("Error fetching Enquiry Jobs (integration):", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// 4. Get a specific enquiry job by ID for auto-resume
export const getEnquiryJobById = async (req, res) => {
  try {
    const { id } = req.params;
    const cleanId = String(id || "").trim();
    const strippedId = cleanId.replace(/-[A-Z]\d*$/i, "");
    const seqNum = Number(cleanId.replace(/^RD/i, ""));

    const orConditions = [
      ...(mongoose.Types.ObjectId.isValid(cleanId) ? [{ _id: cleanId }] : []),
      { enquiry_no: cleanId },
      { enquiry_no: strippedId },
      { enquiry_no: `RD${strippedId.replace(/^RD/i, "")}` },
      { "sub_jobs.sub_job_no": cleanId },
      { "sub_jobs.sub_job_no": `RD${cleanId.replace(/^RD/i, "")}` },
    ];
    if (!isNaN(seqNum) && cleanId !== "") {
      orConditions.push({ seq: seqNum });
      orConditions.push({ enquiry_no: `RD${seqNum}` });
    }

    const query = { $or: orConditions };
    let job = null;
    try {
      job = await EnquiryJob.findOne(query)
        .populate(
          "customer_id",
          "name contact_person mobile_no email address color_hue short_name additional_contacts contacts terms_text advance_percentage credit_days owner_name owner since_year season_insight outstanding_amount enquiries_origin stats"
        )
        .lean();
    } catch (popErr) {
      console.warn("Error in EnquiryJob.findOne with populate, fallback to plain findOne:", popErr);
      job = await EnquiryJob.findOne(query).lean();
    }

    if (!job) {
      return res.status(404).json({ success: false, message: "Enquiry Job not found" });
    }

    // Role-based security guard for Client Servicing Executives
    const assignedCustIds = await getAssignedCustomerIdsForUser(req.user);
    if (assignedCustIds !== null) {
      const jobCustId = String(job.customer_id?._id || job.customer_id || "");
      const jobCustNanoid = String(job.customer_id?.id || "");
      const isAssigned =
        assignedCustIds.some((cid) => String(cid) === jobCustId || (jobCustNanoid && String(cid) === jobCustNanoid)) ||
        String(job.created_by) === String(req.user?.id || req.user?._id);

      if (!isAssigned) {
        return res.status(403).json({ success: false, message: "Access denied: Not assigned to this client" });
      }
    }

    if (job.assigned_to && mongoose.Types.ObjectId.isValid(job.assigned_to)) {
      try {
        const u = await userModel.findById(job.assigned_to, "name").lean();
        if (u) job.assigned_to = u;
      } catch (err) {
        console.warn("User lookup error in getEnquiryJobById:", err);
      }
    }

    if (job.created_by && mongoose.Types.ObjectId.isValid(job.created_by)) {
      try {
        const u = await userModel.findById(job.created_by, "name email").lean();
        if (u) job.created_by_user = u;
      } catch (err) {
        console.warn("Created by lookup error in getEnquiryJobById:", err);
      }
    }

    // Enrich with 24-hr signed asset URLs, auto-resolved BOM rates, and healed design states
    await enrichJobWithSignedAssetsAndBOM(job);

    res.status(200).json({
      success: true,
      message: "Fetched successfully",
      data: job,
    });
  } catch (error) {
    console.error("Error fetching Enquiry Job by ID (integration):", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// 5. Update an existing enquiry job (Step autosave, edit, sync)
export const updateEnquiryJob = async (req, res) => {
  try {
    const { id } = req.params;
    const cleanId = String(id || "").trim();
    let query = mongoose.Types.ObjectId.isValid(cleanId) ? { _id: cleanId } : { enquiry_no: cleanId };
    let existingJob = await EnquiryJob.findOne(query);

    // Fallback: search by enquiry_no, seq, or stripped ID if _id was not found
    if (!existingJob && req.body.enquiry_no) {
      existingJob = await EnquiryJob.findOne({ enquiry_no: String(req.body.enquiry_no).trim() });
    }
    if (!existingJob && cleanId) {
      existingJob = await EnquiryJob.findOne({
        $or: [
          { enquiry_no: cleanId },
          { enquiry_no: `RD${cleanId.replace(/^RD/i, "")}` },
          { "sub_jobs.sub_job_no": cleanId },
        ],
      });
    }
    if (!existingJob && req.body.seq) {
      existingJob = await EnquiryJob.findOne({ seq: Number(req.body.seq) });
    }

    const isNewUpsert = !existingJob;

    // Resolve customer_id string/nanoid to ObjectId safely
    let resolvedCustomerId = req.body.customer_id;
    let customerDoc = null;
    if (resolvedCustomerId) {
      if (!mongoose.Types.ObjectId.isValid(resolvedCustomerId)) {
        customerDoc = await customerModel.findOne({ id: resolvedCustomerId });
        if (customerDoc) {
          resolvedCustomerId = customerDoc._id;
        } else {
          return res.status(400).json({ success: false, message: "Invalid or non-existent customer ID." });
        }
      } else {
        customerDoc = await customerModel.findById(resolvedCustomerId);
        if (!customerDoc) {
          return res.status(400).json({ success: false, message: "Customer not found." });
        }
      }
    } else if (existingJob?.customer_id) {
      resolvedCustomerId = existingJob.customer_id;
      customerDoc = await customerModel.findById(resolvedCustomerId).catch(() => null);
    } else {
      return res.status(400).json({ success: false, message: "Customer ID is required." });
    }

    // Determine audit history entry
    const historyEntry = {
      action: req.body.action || "STEP_UPDATED",
      step: req.body.step !== undefined ? req.body.step : (existingJob ? existingJob.step : 0),
      previous_state: existingJob ? existingJob.stage : "enquiry",
      new_state: req.body.stage || (existingJob ? existingJob.stage : "enquiry"),
      remarks: req.body.remarks || `Updated step ${req.body.step !== undefined ? req.body.step : (existingJob ? existingJob.step : 0)}`,
      changed_by: {
        user_id: req.user?.id || req.user?._id || null,
        user_name: req.user?.name || req.body.coordinator_name || "User",
        role: req.user?.role || "Sales",
      },
      timestamp: new Date(),
    };

    // Resolve coordinator assigned_to user ID if coordinator_name is updated
    let updateAssignedTo = req.body.assigned_to;
    if (req.body.coordinator_name !== undefined) {
      if (req.body.coordinator_name && String(req.body.coordinator_name).trim()) {
        const matchedCoordinator = await userModel.findOne({
          name: { $regex: new RegExp("^" + req.body.coordinator_name.trim() + "$", "i") },
        });
        updateAssignedTo = matchedCoordinator ? matchedCoordinator._id : null;
      } else {
        updateAssignedTo = null;
      }
    }

    const effNeededOrDeliveryDate =
      req.body.needed_by_date ||
      req.body.delivery_date ||
      req.body["the_ask.needed_by_date"] ||
      req.body["the_ask.delivery_date"] ||
      req.body["delivery_details.needed_by_date"] ||
      req.body["delivery_details.delivery_date"] ||
      req.body.the_ask?.needed_by_date ||
      req.body.the_ask?.delivery_date ||
      req.body.delivery_details?.needed_by_date ||
      req.body.delivery_details?.delivery_date ||
      req.body.wizard_state?.e?.delivery_date ||
      req.body.wizard_state?.e?.neededByDate ||
      req.body.wizard_state?.e?.deliveryDate;

    const effEventDate =
      req.body.event_date ||
      req.body["the_ask.event_date"] ||
      req.body.the_ask?.event_date ||
      req.body.wizard_state?.e?.event_date ||
      req.body.wizard_state?.e?.eventExactDate ||
      req.body.wizard_state?.e?.eventDate;

    const effJobCompletionDate =
      req.body.job_completion_date ||
      req.body["the_ask.job_completion_date"] ||
      req.body["delivery_details.job_completion_date"] ||
      req.body.the_ask?.job_completion_date ||
      req.body.delivery_details?.job_completion_date ||
      req.body.wizard_state?.e?.job_completion_date ||
      req.body.wizard_state?.e?.jobCompletionDate;

    // Resolve contact details
    let resolvedContactId = req.body.contact_id !== undefined ? req.body.contact_id : (existingJob?.contact_id || null);
    let resolvedContactPerson = req.body.contact_person !== undefined ? req.body.contact_person : (existingJob?.contact_person || "");
    let resolvedContactMobile = req.body.contact_mobile !== undefined ? req.body.contact_mobile : (existingJob?.contact_mobile || "");
    let resolvedContactEmail = req.body.contact_email !== undefined ? req.body.contact_email : (existingJob?.contact_email || "");

    if (customerDoc && (!resolvedContactPerson || req.body.contact_id)) {
      const allContacts = [
        ...(Array.isArray(customerDoc.contacts) ? customerDoc.contacts : []),
        ...(Array.isArray(customerDoc.additional_contacts) ? customerDoc.additional_contacts : []),
      ];
      if (allContacts.length > 0) {
        const matched = resolvedContactId
          ? allContacts.find((c) => String(c.id || c._id) === String(resolvedContactId))
          : allContacts[0];
        if (matched) {
          resolvedContactPerson = matched.name || "";
          resolvedContactMobile = matched.mobile_no || matched.phone || "";
          resolvedContactEmail = matched.email || "";
        }
      } else if (!resolvedContactPerson && customerDoc.contact_person && customerDoc.contact_person !== "Primary Contact") {
        resolvedContactPerson = customerDoc.contact_person;
        resolvedContactMobile = customerDoc.mobile_no || "";
        resolvedContactEmail = customerDoc.email || "";
      }
    }

    // Resolve size and quantity for edit update
    const effSize = String(
      req.body.the_ask?.size ||
      req.body["the_ask.size"] ||
      req.body.wizard_state?.e?.size ||
      (req.body.sub_jobs?.[0]?.size) ||
      existingJob?.the_ask?.size ||
      "8"
    );

    const effQty = Number(
      req.body.the_ask?.quantity ||
      req.body["the_ask.quantity"] ||
      req.body.delivery_details?.quantity ||
      req.body.wizard_state?.qty ||
      req.body.wizard_state?.e?.qty ||
      (req.body.sub_jobs?.[0]?.quantity) ||
      existingJob?.the_ask?.quantity ||
      50
    );

    let processedSubJobs = req.body.sub_jobs;
    if (Array.isArray(processedSubJobs) && existingJob && Array.isArray(existingJob.sub_jobs)) {
      processedSubJobs = processedSubJobs.map((incomingSj) => {
        const existingSj = existingJob.sub_jobs.find(
          (s) =>
            s.sub_job_no === incomingSj.sub_job_no ||
            s.sub_job_no?.endsWith(incomingSj.sub_job_no) ||
            incomingSj.sub_job_no?.endsWith(s.sub_job_no)
        );

        if (!existingSj) return incomingSj;

        const effBomId = incomingSj.bom_id || existingSj.bom_id || null;
        const effTargetRate =
          incomingSj.budget !== undefined && incomingSj.budget !== "" && Number(incomingSj.budget) >= 0
            ? Number(incomingSj.budget)
            : incomingSj.target_rate !== undefined && Number(incomingSj.target_rate) > 0
              ? Number(incomingSj.target_rate)
              : (incomingSj.unit_rate !== undefined && incomingSj.unit_rate > 0)
                ? incomingSj.unit_rate
                : (existingSj.target_rate || existingSj.unit_rate || 0);

        const isCostingDone = Boolean(effBomId);

        const effUnitRate = isCostingDone
          ? (incomingSj.unit_rate !== undefined && incomingSj.unit_rate > 0
            ? incomingSj.unit_rate
            : (existingSj.unit_rate || 0))
          : 0;

        const effSampleRate =
          incomingSj.sample_rate !== undefined && incomingSj.sample_rate > 0
            ? incomingSj.sample_rate
            : (existingSj.sample_rate || (effUnitRate > 0 ? effUnitRate + 200 : 0));

        const effArtworkCharge =
          incomingSj.artwork_charge !== undefined
            ? incomingSj.artwork_charge
            : (existingSj.artwork_charge || 0);

        const effCostingStatus = isCostingDone
          ? "completed"
          : (incomingSj.costing_status === "completed" && !effBomId)
            ? (existingSj.costing_status === "in_costing" ? "in_costing" : "pending")
            : (existingSj.costing_status === "completed" && !effBomId)
              ? (existingSj.costing_requested_at ? "pending" : "not_requested")
              : (incomingSj.costing_status || existingSj.costing_status || "not_requested");

        const rawSpec = incomingSj.spec || existingSj.spec || {};
        const cleanSpec = { ...rawSpec };
        delete cleanSpec.dimensions;
        delete cleanSpec.customL;
        delete cleanSpec.customB;
        delete cleanSpec.thickness;
        // Current size card takes strict precedence: if incoming sub-job provides colourQuantities (even empty []), use it directly
        const rawColours = Array.isArray(incomingSj.colourQuantities)
          ? incomingSj.colourQuantities
          : (Array.isArray(cleanSpec.colourQuantities)
            ? cleanSpec.colourQuantities
            : []);
        if (rawColours.length > 0) {
          cleanSpec.colourQuantities = rawColours;
        } else {
          delete cleanSpec.colourQuantities;
        }

        const effColour = incomingSj.colour !== undefined
          ? incomingSj.colour
          : (cleanSpec.colour !== undefined ? cleanSpec.colour : "");
        if (effColour && String(effColour).trim()) {
          cleanSpec.colour = String(effColour).trim();
        } else {
          delete cleanSpec.colour;
        }

        const rawCustoms = Array.isArray(incomingSj.customFinishes)
          ? incomingSj.customFinishes
          : (Array.isArray(cleanSpec.customFinishes)
            ? cleanSpec.customFinishes
            : []);
        const customs = Array.isArray(rawCustoms)
          ? rawCustoms.map((c) => {
            if (typeof c === "string") return { colour: c, colourCode: "#B08D57", isCustom: true };
            return {
              colour: c.colour || c.name || "",
              colourCode: c.colourCode || c.code || "#B08D57",
              isCustom: true
            };
          }).filter((c) => Boolean(c.colour))
          : [];
        if (customs.length > 0) {
          cleanSpec.customFinishes = customs;
        } else {
          delete cleanSpec.customFinishes;
        }

        const rawDims = (incomingSj.sizeDimensions && incomingSj.sizeDimensions.length > 0)
          ? incomingSj.sizeDimensions
          : (cleanSpec.sizeDimensions && cleanSpec.sizeDimensions.length > 0)
            ? cleanSpec.sizeDimensions
            : (existingSj.spec?.sizeDimensions || existingSj.sizeDimensions || []);
        const isTrophyProduct = (incomingSj.trophy_type || "").toLowerCase().includes("trophy") || (incomingSj.trophy_type || "").toLowerCase().includes("memento");
        if (rawDims.length > 0) {
          cleanSpec.sizeDimensions = rawDims;
          if (isTrophyProduct) {
            const wObj = rawDims.find((d) => d.key === "width");
            if (wObj && wObj.value !== undefined && cleanSpec.trophyW === undefined) cleanSpec.trophyW = Number(wObj.value) || wObj.value;
            const dObj = rawDims.find((d) => d.key === "depth");
            if (dObj && dObj.value !== undefined && cleanSpec.trophyD === undefined) cleanSpec.trophyD = Number(dObj.value) || dObj.value;
            const hObj = rawDims.find((d) => d.key === "height");
            if (hObj && hObj.value !== undefined && cleanSpec.trophyH === undefined) cleanSpec.trophyH = Number(hObj.value) || hObj.value;
          }
        } else {
          delete cleanSpec.sizeDimensions;
        }

        if (!isTrophyProduct) {
          delete cleanSpec.trophyW;
          delete cleanSpec.trophyD;
          delete cleanSpec.trophyH;
        }

        const effSizeRate = incomingSj.sizeRate !== undefined
          ? incomingSj.sizeRate
          : (cleanSpec.sizeRate !== undefined ? cleanSpec.sizeRate : existingSj.sizeRate);
        if (effSizeRate !== undefined && effSizeRate !== null) {
          cleanSpec.sizeRate = Number(effSizeRate);
        }

        cleanSpec.budget = Number(incomingSj.budget !== undefined && incomingSj.budget !== "" ? incomingSj.budget : effTargetRate);
        const effDesignApproved = incomingSj.design_approved !== undefined
          ? Boolean(incomingSj.design_approved)
          : Boolean(existingSj.design_approved);

        const effDesignStatus =
          existingSj.design_approved && (!incomingSj.design_status || incomingSj.design_status === "pending")
            ? (existingSj.design_status || "approved")
            : (incomingSj.design_status || existingSj.design_status || "pending");

        const effApprovedOpt = incomingSj.approved_design_option !== undefined
          ? incomingSj.approved_design_option
          : (existingSj.approved_design_option ?? null);

        const effIsDesignUploaded = incomingSj.is_design_uploaded !== undefined
          ? Boolean(incomingSj.is_design_uploaded)
          : Boolean(existingSj.is_design_uploaded);

        const effDesignerFiles = (Array.isArray(incomingSj.designer_files) && incomingSj.designer_files.length > 0)
          ? incomingSj.designer_files
          : (existingSj.designer_files || []);

        return {
          ...(existingSj.toObject ? existingSj.toObject() : existingSj),
          ...incomingSj,
          spec: cleanSpec,
          colourQuantities: rawColours,
          colour: effColour || "",
          customFinishes: customs,
          sizeDimensions: rawDims,
          sizeRate: effSizeRate !== undefined ? Number(effSizeRate) : 0,
          bom_id: effBomId,
          budget: Number(incomingSj.budget !== undefined && incomingSj.budget !== "" ? incomingSj.budget : effTargetRate),
          target_rate: Number(Number(effTargetRate).toFixed(2)),
          unit_rate: Number(Number(effUnitRate).toFixed(2)),
          sample_rate: Number(Number(effSampleRate).toFixed(2)),
          artwork_charge: Number(Number(effArtworkCharge).toFixed(2)),
          costing_status: effCostingStatus,
          costing_requested_at: incomingSj.costing_requested_at || existingSj.costing_requested_at || null,
          costing_completed_at: isCostingDone ? (existingSj.costing_completed_at || new Date()) : null,
          quote_shared: incomingSj.quote_shared !== undefined ? incomingSj.quote_shared : (existingSj.quote_shared || false),
          quote_shared_at: incomingSj.quote_shared_at || existingSj.quote_shared_at || null,
          client_quote_decision:
            existingSj.client_quote_decision === "approved"
              ? (incomingSj.client_quote_decision && incomingSj.client_quote_decision !== "pending" ? incomingSj.client_quote_decision : "approved")
              : existingSj.client_quote_decision === "revision"
                ? (incomingSj.client_quote_decision && incomingSj.client_quote_decision !== "pending" ? incomingSj.client_quote_decision : "revision")
                : existingSj.client_quote_decision === "rejected"
                  ? (incomingSj.client_quote_decision && incomingSj.client_quote_decision !== "pending" ? incomingSj.client_quote_decision : "rejected")
                  : (incomingSj.client_quote_decision || existingSj.client_quote_decision || "pending"),
          client_quote_decision_at: incomingSj.client_quote_decision_at || existingSj.client_quote_decision_at || null,
          client_quote_decision_notes: incomingSj.client_quote_decision_notes || existingSj.client_quote_decision_notes || "",
          client_quote_communication: incomingSj.client_quote_communication || existingSj.client_quote_communication || "",
          proof_files: (incomingSj.proof_files && incomingSj.proof_files.length > 0) ? incomingSj.proof_files : (existingSj.proof_files || []),
          design_files: (incomingSj.design_files && incomingSj.design_files.length > 0) ? incomingSj.design_files : (existingSj.design_files || []),
          design_approved: effDesignApproved,
          design_status: effDesignStatus,
          design_approved_at: incomingSj.design_approved_at || existingSj.design_approved_at || null,
          approved_design_option: effApprovedOpt,
          approved_design_url: incomingSj.approved_design_url || existingSj.approved_design_url || null,
          approved_designs: (incomingSj.approved_designs && incomingSj.approved_designs.length > 0) ? incomingSj.approved_designs : (existingSj.approved_designs || []),
          product_feedback: incomingSj.product_feedback || existingSj.product_feedback || null,
          designer_files: effDesignerFiles,
          is_design_uploaded: effIsDesignUploaded,
        };
      });
    }

    if (!processedSubJobs && req.body.wizard_state?.e?.trophyGroups && Array.isArray(req.body.wizard_state.e.trophyGroups)) {
      processedSubJobs = mapTrophyGroupItemsToSubJobs({
        trophyGroups: req.body.wizard_state.e.trophyGroups,
        enquiry_no: existingJob.enquiry_no,
        effSize,
        effQty,
        existingJob,
        stage: req.body.stage || existingJob.stage || "enquiry",
      });
    }

    if (Array.isArray(processedSubJobs) && processedSubJobs.length > 0) {
      processedSubJobs.forEach((sj) => {
        if (!sj.size || sj.size === "undefined" || sj.size === "null") sj.size = effSize;
        if (!sj.quantity || sj.quantity === 0) sj.quantity = effQty;
        if (!sj.product_name) sj.product_name = existingJob?.the_ask?.product_name || "Custom Trophy";
        if (!sj.material) sj.material = existingJob?.the_ask?.material || "MDF";
      });
    }

    const effDesignerId =
      req.body.assigned_designer ||
      req.body.the_brief?.designer_id ||
      req.body.wizard_state?.e?.assignedDesigner ||
      req.body.wizard_state?.e?.designer_id ||
      existingJob?.assigned_designer ||
      existingJob?.the_brief?.designer_id ||
      null;

    const effDesignerName =
      req.body.assigned_designer_name ||
      req.body.the_brief?.designer_name ||
      req.body.wizard_state?.e?.assignedDesignerName ||
      req.body.wizard_state?.e?.designer_name ||
      existingJob?.assigned_designer_name ||
      existingJob?.the_brief?.designer_name ||
      null;

    let effTheBrief = undefined;
    const wizardE = req.body.wizard_state?.e || {};

    if (req.body.the_brief !== undefined) {
      effTheBrief = {
        ...(existingJob?.the_brief ? (existingJob.the_brief.toObject ? existingJob.the_brief.toObject() : existingJob.the_brief) : {}),
        ...req.body.the_brief,
      };
      if (effDesignerId && (!effTheBrief.designer_id || effTheBrief.designer_id === "")) {
        effTheBrief.designer_id = effDesignerId;
      }
      if (effDesignerName && (!effTheBrief.designer_name || effTheBrief.designer_name === "")) {
        effTheBrief.designer_name = effDesignerName;
      }
      if (wizardE.productBriefs) {
        effTheBrief.product_briefs = wizardE.productBriefs;
      }
      if ((!effTheBrief.signatures || effTheBrief.signatures.length === 0) && existingJob?.the_brief?.signatures?.length > 0) {
        effTheBrief.signatures = existingJob.the_brief.signatures;
      } else if ((!effTheBrief.signatures || effTheBrief.signatures.length === 0) && (wizardE.globalSignatures?.length > 0 || wizardE.signatures?.length > 0)) {
        effTheBrief.signatures = wizardE.globalSignatures || wizardE.signatures;
      }
      if ((!effTheBrief.client_logo || effTheBrief.client_logo.length === 0) && existingJob?.the_brief?.client_logo?.length > 0) {
        effTheBrief.client_logo = existingJob.the_brief.client_logo;
      } else if ((!effTheBrief.client_logo || effTheBrief.client_logo.length === 0) && (wizardE.globalLogos?.length > 0 || wizardE.clientLogo?.length > 0 || wizardE.clientLogos?.length > 0)) {
        effTheBrief.client_logo = wizardE.globalLogos || wizardE.clientLogo || wizardE.clientLogos;
      }
      if ((!effTheBrief.additional_files || effTheBrief.additional_files.length === 0) && existingJob?.the_brief?.additional_files?.length > 0) {
        effTheBrief.additional_files = existingJob.the_brief.additional_files;
      } else if ((!effTheBrief.additional_files || effTheBrief.additional_files.length === 0) && (wizardE.globalAdditionalFiles?.length > 0 || wizardE.additionalFiles?.length > 0 || wizardE.additional_files?.length > 0)) {
        effTheBrief.additional_files = wizardE.globalAdditionalFiles || wizardE.additionalFiles || wizardE.additional_files;
      }
    } else if (wizardE.showRDLogo !== undefined || wizardE.showRDContent !== undefined || wizardE.copyrightContent !== undefined) {
      effTheBrief = {
        ...(existingJob?.the_brief ? (existingJob.the_brief.toObject ? existingJob.the_brief.toObject() : existingJob.the_brief) : {}),
      };
    }

    if (effTheBrief) {
      if (wizardE.showRDLogo !== undefined) {
        effTheBrief.show_logo = Boolean(wizardE.showRDLogo);
      }
      if (wizardE.showRDContent !== undefined) {
        effTheBrief.show_content = Boolean(wizardE.showRDContent);
      }
      if (wizardE.copyrightContent || wizardE.copyright_content) {
        effTheBrief.copyright_content = wizardE.copyrightContent || wizardE.copyright_content;
      }
    }

    if (req.body.links_duration !== undefined || req.body.wizard_state?.e?.links_duration !== undefined) {
      if (!effTheBrief) {
        effTheBrief = {
          ...(existingJob?.the_brief ? (existingJob.the_brief.toObject ? existingJob.the_brief.toObject() : existingJob.the_brief) : {}),
        };
      }
      effTheBrief.links_duration = req.body.links_duration !== undefined
        ? req.body.links_duration
        : req.body.wizard_state?.e?.links_duration;
    }

    const effOptionsDueIn =
      req.body.options_due_in !== undefined
        ? Number(req.body.options_due_in)
        : req.body["the_brief.options_due_in"] !== undefined
          ? Number(req.body["the_brief.options_due_in"])
          : req.body.the_brief?.options_due_in !== undefined
            ? Number(req.body.the_brief.options_due_in)
            : wizardE?.optionsDueIn !== undefined
              ? Number(wizardE.optionsDueIn)
              : existingJob?.the_brief?.options_due_in !== undefined
                ? Number(existingJob.the_brief.options_due_in)
                : 24;

    const existingAssignedAt = existingJob?.the_brief?.designer_assigned_at;
    const isNewDesignerAssignment =
      effDesignerId &&
      (!existingJob?.the_brief?.designer_id || String(existingJob.the_brief.designer_id) !== String(effDesignerId));

    const effDesignerAssignedAt =
      req.body.designer_assigned_at ||
      req.body["the_brief.designer_assigned_at"] ||
      req.body.the_brief?.designer_assigned_at ||
      (isNewDesignerAssignment ? new Date() : existingAssignedAt || (effDesignerId ? new Date() : null));

    if (effTheBrief) {
      if (effOptionsDueIn !== undefined) effTheBrief.options_due_in = effOptionsDueIn;
      if (effDesignerAssignedAt) effTheBrief.designer_assigned_at = effDesignerAssignedAt;
    }

    if (Array.isArray(processedSubJobs) && processedSubJobs.length > 0) {
      processedSubJobs.forEach((sj) => {
        if (!sj.designer_id && !sj.assigned_designer && effDesignerId) {
          sj.designer_id = effDesignerId;
          sj.assigned_designer = effDesignerId;
        }
        if (!sj.designer_name && !sj.assigned_designer_name && effDesignerName) {
          sj.designer_name = effDesignerName;
          sj.assigned_designer_name = effDesignerName;
        }
      });
    }

    // Auto-request quotation on design approval:
    // As soon as design is approved, any active sub-job automatically receives costing_status='pending', quotation_status='requested'
    const isExplicitRework =
      req.body.the_brief?.design_status === "rework" ||
      req.body["the_brief.design_status"] === "rework" ||
      req.body.wizard_state?.designStatus === "rework";

    let candidateSubJobs = processedSubJobs || (existingJob.sub_jobs ? (existingJob.sub_jobs.toObject ? existingJob.sub_jobs.toObject() : existingJob.sub_jobs) : []);
    if (Array.isArray(candidateSubJobs) && candidateSubJobs.length > 0) {
      const nowDt = new Date();
      candidateSubJobs = candidateSubJobs.map((sj) => {
        if (!sj.is_dropped && !sj.is_on_hold) {
          const hasDesignerFiles = Array.isArray(sj.designer_files) && sj.designer_files.length > 0;
          const isDesignUploaded = sj.is_design_uploaded || hasDesignerFiles;
          const isSjApproved = Boolean(sj.design_approved === true || sj.design_status === "approved");
          return {
            ...sj,
            design_approved: isSjApproved,
            design_status: isSjApproved ? "approved" : (sj.design_status || "pending"),
            design_approved_at: isSjApproved ? (sj.design_approved_at || nowDt) : null,
            is_design_uploaded: isDesignUploaded,
            costing_status: (isSjApproved && isDesignUploaded) ? (sj.costing_status === "completed" ? "completed" : "pending") : (sj.costing_status || "not_requested"),
            quotation_status: (isSjApproved && isDesignUploaded) ? "requested" : (sj.quotation_status || "not_requested"),
            costing_requested_at: (isSjApproved && isDesignUploaded) ? (sj.costing_requested_at || nowDt) : null,
          };
        }
        return sj;
      });
      processedSubJobs = candidateSubJobs;
    }

    const activeCustomSubJobs = (candidateSubJobs || []).filter(
      (sj) => !sj.is_dropped && !sj.is_on_hold && sj.trophy_type !== "ready"
    );
    const allSubJobsApproved = activeCustomSubJobs.length > 0 && activeCustomSubJobs.every((sj) => sj.design_approved === true);

    if (allSubJobsApproved) {
      if (!effTheBrief) {
        effTheBrief = {
          ...(existingJob?.the_brief ? (existingJob.the_brief.toObject ? existingJob.the_brief.toObject() : existingJob.the_brief) : {}),
        };
      }
      effTheBrief.design_status = "approved";
      if (req.body.wizard_state) {
        req.body.wizard_state.designApproved = true;
        req.body.wizard_state.designStatus = "approved";
      }
    } else if (effTheBrief && effTheBrief.design_status === "approved") {
      effTheBrief.design_status = "pending";
      if (req.body.wizard_state) {
        req.body.wizard_state.designApproved = false;
        if (req.body.wizard_state.designStatus === "approved") {
          req.body.wizard_state.designStatus = "pending";
        }
      }
    }

    let effTheAsk = undefined;
    if (req.body.the_ask !== undefined) {
      effTheAsk = {
        ...(existingJob?.the_ask ? (existingJob.the_ask.toObject ? existingJob.the_ask.toObject() : existingJob.the_ask) : {}),
        ...req.body.the_ask,
        size: effSize,
        quantity: effQty,
        ...(effEventDate ? { event_date: effEventDate } : {}),
        ...(effNeededOrDeliveryDate ? { needed_by_date: effNeededOrDeliveryDate, delivery_date: effNeededOrDeliveryDate } : {}),
        ...(effJobCompletionDate ? { job_completion_date: effJobCompletionDate } : {}),
      };
    }

    let effDeliveryDetails = undefined;
    if (req.body.delivery_details !== undefined) {
      effDeliveryDetails = {
        ...(existingJob?.delivery_details ? (existingJob.delivery_details.toObject ? existingJob.delivery_details.toObject() : existingJob.delivery_details) : {}),
        ...req.body.delivery_details,
        quantity: effQty,
        ...(effNeededOrDeliveryDate ? { needed_by_date: effNeededOrDeliveryDate, delivery_date: effNeededOrDeliveryDate } : {}),
        ...(effJobCompletionDate ? { job_completion_date: effJobCompletionDate } : {}),
      };
    }

    // Build update payload with ONLY scalar/known fields to avoid BSON 16MB overflow.
    // DO NOT spread ...req.body here — wizard_state alone can be several MB.
    const updatePayload = {
      // Safe scalar fields from body
      ...(req.body.stage !== undefined ? { stage: req.body.stage } : {}),
      ...(req.body.step !== undefined ? { step: req.body.step } : {}),
      ...(existingJob?.enquiry_no
        ? { enquiry_no: existingJob.enquiry_no, seq: existingJob.seq, year: existingJob.year || getCurrentYearCode() }
        : {
          ...(req.body.enquiry_no !== undefined ? {
            enquiry_no: (!req.body.enquiry_no || !parseEnquiryNo(req.body.enquiry_no)?.year)
              ? formatEnquiryNo(req.body.seq || 1, req.body.year || getCurrentYearCode())
              : req.body.enquiry_no
          } : {}),
          ...(req.body.seq !== undefined ? { seq: req.body.seq } : {}),
        }),
      ...(resolvedCustomerId ? { customer_id: resolvedCustomerId } : {}),
      ...(req.body.ship_to_id !== undefined ? { ship_to_id: req.body.ship_to_id } : {}),
      ...(req.body.coordinator_name !== undefined ? { coordinator_name: req.body.coordinator_name } : {}),
      ...(req.body.log_track !== undefined ? { log_track: req.body.log_track } : {}),
      ...(req.body.order_mode !== undefined ? { order_mode: req.body.order_mode } : {}),
      ...(req.body.financials !== undefined ? { financials: req.body.financials } : {}),
      ...(req.body.delivery_charges !== undefined ? { delivery_charges: req.body.delivery_charges } : {}),
      ...(effTheBrief !== undefined ? { the_brief: effTheBrief } : {
        ...(req.body["the_brief.design_status"] !== undefined ? { "the_brief.design_status": req.body["the_brief.design_status"] } : {}),
        ...(req.body["the_brief.options_shared"] !== undefined ? { "the_brief.options_shared": req.body["the_brief.options_shared"] } : {}),
        ...(effOptionsDueIn !== undefined ? { "the_brief.options_due_in": effOptionsDueIn } : {}),
        ...(effDesignerAssignedAt ? { "the_brief.designer_assigned_at": effDesignerAssignedAt } : {}),
        ...(effDesignerId ? { "the_brief.designer_id": effDesignerId } : {}),
        ...(effDesignerName ? { "the_brief.designer_name": effDesignerName } : {}),
      }),
      ...(effDesignerId ? { assigned_designer: effDesignerId } : {}),
      ...(effDesignerName ? { assigned_designer_name: effDesignerName } : {}),
      ...(req.body.wizard_state === undefined ? {
        ...(req.body["wizard_state.designApproved"] !== undefined ? { "wizard_state.designApproved": req.body["wizard_state.designApproved"] } : {}),
        ...(req.body["wizard_state.designStatus"] !== undefined ? { "wizard_state.designStatus": req.body["wizard_state.designStatus"] } : {}),
        ...(req.body["wizard_state.productFeedback"] !== undefined ? { "wizard_state.productFeedback": req.body["wizard_state.productFeedback"] } : {}),
      } : {}),
      ...(req.body.sample_rates_approved !== undefined ? { sample_rates_approved: Boolean(req.body.sample_rates_approved) } : {}),
      ...(req.body.common_files !== undefined ? { common_files: req.body.common_files } : {}),
      ...(req.body.lead_date !== undefined ? { lead_date: req.body.lead_date } : {}),
      ...(req.body.origin !== undefined ? { origin: req.body.origin } : {}),
      ...(req.body.is_lost !== undefined ? { is_lost: req.body.is_lost } : {}),
      ...(req.body.lost_stage !== undefined ? { lost_stage: req.body.lost_stage } : {}),
      ...(req.body.lost_reason !== undefined ? { lost_reason: req.body.lost_reason } : {}),
      ...(req.body.lost_to_competitor !== undefined ? { lost_to_competitor: req.body.lost_to_competitor } : {}),

      // Resolved contact fields
      contact_id: resolvedContactId,
      ...(resolvedContactPerson ? { contact_person: resolvedContactPerson } : {}),
      ...(resolvedContactMobile ? { contact_mobile: resolvedContactMobile } : {}),
      ...(resolvedContactEmail ? { contact_email: resolvedContactEmail } : {}),

      ...(processedSubJobs ? { sub_jobs: processedSubJobs } : {}),
      ...(effEventDate ? { event_date: effEventDate } : {}),
      ...(effNeededOrDeliveryDate ? {
        needed_by_date: effNeededOrDeliveryDate,
        delivery_date: effNeededOrDeliveryDate,
      } : {}),
      ...(effJobCompletionDate ? {
        job_completion_date: effJobCompletionDate,
      } : {}),

      ...(effTheAsk ? { the_ask: effTheAsk } : {
        "the_ask.size": effSize,
        "the_ask.quantity": effQty,
        ...(effEventDate ? { "the_ask.event_date": effEventDate } : {}),
        ...(effNeededOrDeliveryDate ? {
          "the_ask.needed_by_date": effNeededOrDeliveryDate,
          "the_ask.delivery_date": effNeededOrDeliveryDate,
        } : {}),
        ...(effJobCompletionDate ? { "the_ask.job_completion_date": effJobCompletionDate } : {}),
      }),

      ...(effDeliveryDetails ? { delivery_details: effDeliveryDetails } : {
        "delivery_details.quantity": effQty,
        ...(effNeededOrDeliveryDate ? {
          "delivery_details.needed_by_date": effNeededOrDeliveryDate,
          "delivery_details.delivery_date": effNeededOrDeliveryDate,
        } : {}),
        ...(effJobCompletionDate ? { "delivery_details.job_completion_date": effJobCompletionDate } : {}),
      }),

      ...(updateAssignedTo !== undefined ? { assigned_to: updateAssignedTo } : {}),
      updated_by: req.user?.id || req.user?._id || null,
      $push: { history: historyEntry },
    };

    // wizard_state stored separately (can be large) — update only if explicitly sent
    if (req.body.wizard_state !== undefined) {
      updatePayload.wizard_state = sanitizeDepth(req.body.wizard_state);
      if (allSubJobsApproved && !isExplicitRework && updatePayload.wizard_state) {
        updatePayload.wizard_state.designApproved = true;
        updatePayload.wizard_state.designStatus = "approved";
      } else if (!allSubJobsApproved && updatePayload.wizard_state) {
        updatePayload.wizard_state.designApproved = false;
        if (updatePayload.wizard_state.designStatus === "approved") {
          updatePayload.wizard_state.designStatus = "pending";
        }
      }

      // Preserve quotation approval if previously approved in existingJob or in sub_jobs!
      const isQuoteApproved = Boolean(
        existingJob?.wizard_state?.quoteApproved === true ||
        existingJob?.wizard_state?.client_quote_decision === "approved" ||
        req.body.wizard_state?.quoteApproved === true ||
        req.body.wizard_state?.client_quote_decision === "approved" ||
        (Array.isArray(existingJob?.sub_jobs) && existingJob.sub_jobs.some((sj) => !sj.is_dropped && !sj.is_on_hold && sj.client_quote_decision === "approved")) ||
        (Array.isArray(processedSubJobs) && processedSubJobs.some((sj) => !sj.is_dropped && !sj.is_on_hold && sj.client_quote_decision === "approved"))
      );

      if (isQuoteApproved && updatePayload.wizard_state) {
        updatePayload.wizard_state.quoteApproved = true;
        updatePayload.wizard_state.client_quote_decision = "approved";
        if (!updatePayload.wizard_state.decision && existingJob?.wizard_state?.decision) {
          updatePayload.wizard_state.decision = existingJob.wizard_state.decision;
        }
      }

      // Preserve sample rates approval & sent state if previously approved in existingJob or client link
      const isSampleRatesApproved = Boolean(
        existingJob?.wizard_state?.ratesApproved || existingJob?.wizard_state?.sampleConfirmed ||
        existingJob?.wizard_state?.sampleRatesState === "approved" || existingJob?.sample_rates_approved ||
        existingJob?.wizard_state?.sampleDecision?.decision === "approved" || req.body.wizard_state?.ratesApproved ||
        req.body.wizard_state?.sampleConfirmed || req.body.wizard_state?.sampleRatesState === "approved" || req.body.sample_rates_approved
      );

      if (isSampleRatesApproved && updatePayload.wizard_state) {
        updatePayload.wizard_state.ratesApproved = true;
        updatePayload.wizard_state.sampleConfirmed = true;
        updatePayload.wizard_state.sampleRatesState = "approved";
        updatePayload.sample_rates_approved = true;
        if (!updatePayload.wizard_state.sampleRateOk && existingJob?.wizard_state?.sampleRateOk) {
          updatePayload.wizard_state.sampleRateOk = existingJob.wizard_state.sampleRateOk;
        }
        if (!updatePayload.wizard_state.ratesApprovalLog && existingJob?.wizard_state?.ratesApprovalLog) {
          updatePayload.wizard_state.ratesApprovalLog = existingJob.wizard_state.ratesApprovalLog;
        }
        if (!updatePayload.wizard_state.sampleDecision && existingJob?.wizard_state?.sampleDecision) {
          updatePayload.wizard_state.sampleDecision = existingJob.wizard_state.sampleDecision;
        }
      }

      const effSampleConfirmSent = req.body.wizard_state?.sampleConfirmSent || existingJob?.wizard_state?.sampleConfirmSent || (isSampleRatesApproved ? (existingJob?.wizard_state?.sampleConfirmSent || "Direct") : null);
      if (effSampleConfirmSent && updatePayload.wizard_state) {
        updatePayload.wizard_state.sampleConfirmSent = effSampleConfirmSent;
        updatePayload.wizard_state.sampleRatesSent = true;
      }
    }

    // Sanitize numerical fields to prevent cast errors
    if (effDeliveryDetails) {
      if (effDeliveryDetails.quantity !== undefined) effDeliveryDetails.quantity = Number(effDeliveryDetails.quantity) || 0;
      if (effDeliveryDetails.target_rate !== undefined) effDeliveryDetails.target_rate = Number(effDeliveryDetails.target_rate) || 0;
      if (effDeliveryDetails.delivery_cost !== undefined) effDeliveryDetails.delivery_cost = Number(effDeliveryDetails.delivery_cost) || 0;
    }
    if (updatePayload.financials) {
      updatePayload.financials.subtotal = Number(updatePayload.financials.subtotal) || 0;
      updatePayload.financials.gst_rate = Number(updatePayload.financials.gst_rate) || 18;
      updatePayload.financials.gst_amount = Number(updatePayload.financials.gst_amount) || 0;
      updatePayload.financials.total = Number(updatePayload.financials.total) || 0;
      updatePayload.financials.advance_percentage = Number(updatePayload.financials.advance_percentage) || 50;
      updatePayload.financials.advance_required = Number(updatePayload.financials.advance_required) || 0;
      updatePayload.financials.advance_received = Number(updatePayload.financials.advance_received) || 0;
      updatePayload.financials.balance = Number(updatePayload.financials.balance) || 0;
    }
    if (updatePayload.order_mode) {
      updatePayload.order_mode.sample_rate = Number(updatePayload.order_mode.sample_rate) || 0;
      updatePayload.order_mode.sample_qty = Number(updatePayload.order_mode.sample_qty) || 1;
    }

    let updatedJob = null;
    if (isNewUpsert) {
      const newJobPayload = { ...updatePayload };
      delete newJobPayload.$push;
      Object.keys(newJobPayload).forEach((k) => {
        if (k.includes(".")) delete newJobPayload[k];
      });

      const newJobId = mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : new mongoose.Types.ObjectId();
      const newJob = new EnquiryJob({
        _id: newJobId,
        enquiry_no: (!req.body.enquiry_no || !parseEnquiryNo(req.body.enquiry_no)?.year)
          ? formatEnquiryNo(req.body.seq || 1, req.body.year || getCurrentYearCode())
          : req.body.enquiry_no,
        seq: Number(req.body.seq) || 1,
        year: req.body.year || getCurrentYearCode(),
        customer_id: resolvedCustomerId || "c1",
        history: [historyEntry],
        the_ask: effTheAsk || {
          product_type: req.body.the_ask?.product_type || "Trophy",
          theme: req.body.the_ask?.theme || "Custom Trophy",
          ask_mode: req.body.the_ask?.ask_mode || "custom",
          sku: req.body.the_ask?.sku,
          product_name: req.body.the_ask?.product_name || "Custom Trophy",
          size: effSize, material: req.body.the_ask?.material || "MDF",
          quantity: effQty, approx_budget: req.body.the_ask?.approx_budget,
          budget_none: req.body.the_ask?.budget_none || false,
          occasion: req.body.the_ask?.occasion || "Annual awards", scope: req.body.the_ask?.scope || "local",
          destination_city: req.body.the_ask?.destination_city, destination_country: req.body.the_ask?.destination_country,
          event_date: effEventDate, delivery_date: effNeededOrDeliveryDate, needed_by_date: effNeededOrDeliveryDate, job_completion_date: effJobCompletionDate,
        },
        delivery_details: effDeliveryDetails || {
          quantity: effQty, delivery_date: effNeededOrDeliveryDate, needed_by_date: effNeededOrDeliveryDate, job_completion_date: effJobCompletionDate, ...(req.body.delivery_details || {}),
        },
        ...newJobPayload,
      });
      try {
        updatedJob = await newJob.save();
      } catch (saveErr) {
        if (saveErr.code === 11000 || saveErr.name === "MongoServerError") {
          const targetEnquiryNo = req.body.enquiry_no || (req.body.seq ? `RD${req.body.seq}` : null);
          if (targetEnquiryNo) {
            updatedJob = await EnquiryJob.findOneAndUpdate({ enquiry_no: targetEnquiryNo }, updatePayload, { new: true });
          } else {
            throw saveErr;
          }
        } else {
          throw saveErr;
        }
      }
    } else {
      updatedJob = await EnquiryJob.findByIdAndUpdate(existingJob._id, updatePayload, {
        new: true,
      });
    }
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
    console.error("Error updating Enquiry Job (integration):", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message, stack: error.stack });
  }
};

