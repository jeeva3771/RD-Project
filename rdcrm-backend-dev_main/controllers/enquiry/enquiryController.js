import mongoose from "mongoose";
import { nanoid } from "nanoid";
import enquiryModel from "../../models/enquiry/enquiryModel.js";
import customerModel from "../../models/masters/customerModel.js";
import { getCurrentDate } from "../../helpers/dateTime.js";
import { deleteFromR2, downloadFromR2, generateSignedUrl, uploadToR2 } from "../../helpers/r2helper.js";
import userModel from "../../models/users/userModel.js";
import { generateEmailTemplate, sendMailWithUser } from "../../helpers/mail.js";
import { addWatermarkToImage } from "../../helpers/watermarkImage.js"
import salesorderlistModel from "../../models/sales_orders/sales_order_list_Model.js";
import salesorderformModel from "../../models/sales_orders/sales_order_form_Model.js";
import dtpStudioModel from "../../models/dtp_studio/dtpStudioModel.js";
import dtpGroupModel from "../../models/dtp_studio/dtpGroupModel.js";
import bomModel from "../../models/bom/bomModel.js";
import shopFloorJobModel from "../../models/shopfloor/shopFloorJobModel.js";
import mime from "mime-types";
import { URL } from "url";
import fetch from "node-fetch";
    // eslint-disable-next-line no-unused-vars
import jwt from "jsonwebtoken";
import { getAuthUserFromReq } from "../../helpers/auth.js";
import CtPack from "../../models/controltower/ctPackModel.js";




export const getAllEnquiries = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page)) || 1;
    const limit = Math.min(10000, Math.max(1, parseInt(req.query.limit))) || 6;
    const skip = (page - 1) * limit;
    const countOnly = req.query.countOnly === "true";

    const search = req.query.search?.trim() || "";
    const status = req.query.status?.trim();
    const is_design_processing = req.query.is_design_processing?.trim();
    const submit_button = req.query.submit_button !== undefined ? String(req.query.submit_button).trim() : undefined;
    const design_complete = req.query.design_complete !== undefined ? String(req.query.design_complete).trim() : undefined;
    const quatation_purpose_only = req.query.quatation_purpose_only !== undefined ? String(req.query.quatation_purpose_only).trim() : undefined;

    const designerneeded = req.query.designerneeded;

    const is_client_design = req.query.is_client_design;



    const designerId = req.query.designerId;
    const createdById = req.query.createdById;

    const redo = req.query.redo;
    const designerallocation = req.query.designerallocation;
    const rework = req.query.rework;



    const role = req.user?.role.toLowerCase();
    const username = req.user?.username;
    const person_id = req.user?._id;
    const permission = req.user?.permission;
    const is_head = req.user?.is_head;


    console.log("person_id", person_id)

    const query = {};

    if (search) {
      const searchRegex = { $regex: search, $options: "i" };
      const orConditions = [
        { name: searchRegex },
        { job_no: searchRegex },
        { product_name: searchRegex },
        { reference_no: searchRegex },
        { referenceNo: searchRegex },
        { reference_number: searchRegex },
        { id: searchRegex },
      ];

      // Handle numeric search terms for potential numeric fields in DB
      if (!isNaN(search) && search.trim() !== "") {
        const searchNum = Number(search);
        orConditions.push({ reference_no: searchNum });
        orConditions.push({ referenceNo: searchNum });
        orConditions.push({ reference_number: searchNum });
      }

      query.$or = orConditions;
    }

    // Apply status filters even during search so results remain within the active tab
    {
      if (status) {
        query.status = status;
      }

      if (status === "on_hold" || req.query.is_on_hold === "true" || req.query.is_on_hold === true) {
        query.is_on_hold = true;
        delete query.status;
      }

      if (status === "abandon" || req.query.is_cancelled === "true" || req.query.is_cancelled === true) {
        const abandonOr = [{ status: "abandon" }, { is_cancelled: true }];
        if (query.$or) {
          query.$and = query.$and || [];
          query.$and.push({ $or: query.$or });
          query.$and.push({ $or: abandonOr });
          delete query.$or;
        } else if (query.$and) {
          query.$and.push({ $or: abandonOr });
        } else {
          query.$or = abandonOr;
        }
        delete query.status;
      }

      if (status === "enquiry") {
        query.is_completed = false;
        query.quatation_purpose_only = false;
      }

      if (typeof is_client_design !== "undefined" && is_client_design !== "") {
        query.is_client_design = is_client_design === "true" || is_client_design === true;
      }

      if (typeof designerneeded !== "undefined" && designerneeded !== "") {
        query.is_designer_needed = designerneeded === "true" || designerneeded === true;
      }

      if (submit_button === "true" || submit_button === true) {
        query.submit_button = true;
        query.is_completed = false;
      }

      if (redo === "true" || redo === true) {
        query.is_redo = "true";
      }

      if (rework === "true" || rework === true) {
        query.is_rework = true;
      }

      if (designerallocation === "true" || designerallocation === true) {
        query.is_designer_allocated = false;
        query.is_designer_needed = true;
        if (is_client_design) {
          delete query.is_designer_needed;
        }
      }

      if (design_complete === "true" || design_complete === true) {
        query.is_completed = true;
        query.is_cancelled = false;
      } else if (status === "design") {
        query.is_completed = { $ne: true };
      }

      if (typeof is_design_processing !== "undefined") {
        if (is_design_processing === "true") {
          query.is_design_processing = true;
        }
        if (is_design_processing === "false") {
          query.is_designer_completed = false;
          query.is_design_processing = false;
        }
      }

      if (quatation_purpose_only === "true" || quatation_purpose_only === true) {
        query.quatation_purpose_only = true;
      }
    }

    console.log("permission", permission)


    const DesignRole = role.includes("design");
    console.log("DesignRole", DesignRole)

    //sales user wise view
    const userRoleLower = role || "";
    if (userRoleLower.includes("client servicing executive") && !userRoleLower.includes("client servicing manager")) {
      query.$or = [{ created_by: person_id }, { cordinator: person_id }];
    } else if (userRoleLower.includes("client servicing manager") || userRoleLower.includes("admin executive")) {
      // Managers and Admins see all enquiries
    } else {
      if (role !== "admin executive" && permission.includes(9) && is_head === true) {
        console.log("11111111111", 111111111111)
      } else if (role !== "admin executive" && permission.includes(9)) {
        console.log("2222222222", 222222222222)
        query.created_by = person_id
      }
    }



    if (role !== "admin executive" && !permission.includes(10) && !permission.includes(9) && DesignRole && !is_head === true) {
      console.log("44444444444444", 44444444444)

      query["designer_person.user"] = person_id;
      console.log("Query object:", query);


    }



    console.log("Role:", role);
    console.log("Username:", username);

    if (designerId) {
      query["designer_person.user"] = designerId;
    }

    if (createdById) {
      query.created_by = createdById;
    }



    console.log("query", query)

    const total = await enquiryModel.countDocuments(query);

    if (countOnly) {
      return res.status(200).json({
        success: true,
        total,
      });
    }

    const enquiries = await enquiryModel
      .find(query)
      .populate("cordinator", "name")
      .populate("marketing_cordinator", "name")
      .populate("created_by", "name")
      .populate("updated_by.user", "name")
      .populate("designer_person.user", "name username")
      .populate("is_cancelled_by.user", "name")
      .populate("hold_history.hold_by", "name")
      .populate("hold_history.unhold_by", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const enquiriesWithSignedUrls = enquiries.map((enquiry) => {
      const signedImages = (enquiry.images || []).map((img) => {
        try {
          const signedUrl = img.url ? generateSignedUrl(img.url) : null;

          const attachmentsUrl = Array.isArray(img.additional_files)
            ? img.additional_files.map((file) => generateSignedUrl(file))
            : [];

          return {
            _id: img._id,
            url: signedUrl,
            imageunit: img.imageunit || "",
            image_product_size: img.image_product_size,
            starttime: img.starttime,
            endtime: img.endtime,
            designer_person: img.designer_person,
            pause_time: img.pause_time,
            pause_notes: img.pause_notes,
            resume_time: img.resume_time,
            is_accepted: img.is_accepted,
            feedback: img.feedback,
            accepted_date_time: img.accepted_date_time,
            watermark_image_url: img.watermark_image_url,
            image_to_sample: img.image_to_sample,
            image_to_production: img.image_to_production,
            image_rework: img.image_rework,
            additional_files: attachmentsUrl,
          };
        } catch (err) {
          console.error("Error generating signed URL for image:", img.url, err);

          return {
            _id: img._id,
            url: img.url,
            imageunit: img.imageunit || "",
            image_product_size: img.image_product_size,
            starttime: img.starttime,
            endtime: img.endtime,
            designer_person: img.designer_person,
            pause_time: img.pause_time,
            pause_notes: img.pause_notes,
            resume_time: img.resume_time,
            is_accepted: img.is_accepted,
            feedback: img.feedback,
            accepted_date_time: img.accepted_date_time,
            watermark_image_url: img.watermark_image_url,
            image_to_sample: img.image_to_sample,
            image_to_production: img.image_to_production,
            image_rework: img.image_rework,
            additional_files: img.additional_files,

          };
        }
      });

      const signedAdditionalAttachments = Array.isArray(enquiry.additional_attachments)
        ? enquiry.additional_attachments.map((file) => generateSignedUrl(file))
        : [];


      const signedclient_design_files = Array.isArray(enquiry.client_design_files)
        ? enquiry.client_design_files.map((file) => generateSignedUrl(file))
        : [];

      const signedreference_images = Array.isArray(enquiry.reference_images)
        ? enquiry.reference_images.map((file) => generateSignedUrl(file))
        : [];


      return {
        ...enquiry.toObject(),
        images: signedImages,
        additional_attachments: signedAdditionalAttachments,
        client_design_files: signedclient_design_files,
        reference_images: signedreference_images,
      };
    });




    res.status(200).json({
      success: true,
      count: enquiries.length,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: enquiriesWithSignedUrls,
    });
  } catch (error) {
    console.error("Error fetching enquiries:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const getEnquiryById = async (req, res) => {
  try {
    const { id } = req.params;

    const query = mongoose.Types.ObjectId.isValid(id)
      ? { $or: [{ id }, { _id: id }] }
      : { id };

    const enquiry = await enquiryModel
      .findOne(query)
      .populate("cordinator", "name")
      .populate("marketing_cordinator", "name")
      .populate("created_by", "name")
      .populate("updated_by.user", "name")


    if (!enquiry) {
      return res.status(404).json({ success: false, message: "Enquiry not found" });
    }


    const signedImages = (enquiry.images || []).map((img) => {
      let signedUrl = img.url;

      try {
        if (img.url) {
          signedUrl = generateSignedUrl(img.url);
        }
      } catch (err) {
        console.error("Error generating signed URL for image:", img.url, err);
      }


      const attachmentsUrl = Array.isArray(img.additional_files)
        ? img.additional_files.map((file) => generateSignedUrl(file))
        : [];

      return {
        _id: img._id,
        url: signedUrl,
        imageunit: img.imageunit || "",
        image_product_size: img.image_product_size,
        starttime: img.starttime,
        endtime: img.endtime,
        designer_person: img.designer_person,
        pause_time: img.pause_time,
        pause_notes: img.pause_notes,
        resume_time: img.resume_time,
        is_accepted: img.is_accepted,
        feedback: img.feedback,
        accepted_date_time: img.accepted_date_time,
        watermark_image_url: img.watermark_image_url,
        image_to_sample: img.image_to_sample,
        image_to_production: img.image_to_production,
        image_rework: img.image_rework,
        additional_files: attachmentsUrl,

      };
    });


    const signedAdditionalAttachments = Array.isArray(enquiry.additional_attachments)
      ? enquiry.additional_attachments.map((file) => generateSignedUrl(file))
      : [];


    const signedclient_design_files = Array.isArray(enquiry.client_design_files)
      ? enquiry.client_design_files.map((file) => generateSignedUrl(file))
      : [];

    const signedreference_images = Array.isArray(enquiry.reference_images)
      ? enquiry.reference_images.map((file) => generateSignedUrl(file))
      : [];

    const storage_keys = Array.isArray(enquiry.reference_images)
      ? enquiry.reference_images
      : [];

    const attachment_keys = Array.isArray(enquiry.additional_attachments)
      ? enquiry.additional_attachments
      : [];



    const enquiryWithSignedUrls = {
      ...enquiry.toObject(),
      images: signedImages,
      additional_attachments: signedAdditionalAttachments,
      client_design_files: signedclient_design_files,
      reference_images: signedreference_images,
      storage_keys: storage_keys,
      attachment_keys: attachment_keys
    };




    res.status(200).json({ success: true, data: enquiryWithSignedUrls });
  } catch (error) {
    console.error("Error fetching enquiry:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const createEnquiry = async (req, res) => {
  try {
    const {
      name,
      mobile_no,
      email = [],
      enquiry_origin,
      no_of_options,
      product_name,
      product_quantity,
      budget,
      budget_to,
      preferred_material,
      product_description,
      delivery_date,
      delivery_type,
      delivery_location,
      delivery_mode,
      briefing,
      payment_terms,
      cordinator,
      marketing_cordinator,
      cordinator_remarks,
      category = "a",
      subcategory = "b",
      designer_remarks = '',
      is_redo = '',
      who_will_pay,
      unit,
      wp_number = [],
      show_logo,
      show_content,
      copyright_content,
      links_duration,
      is_designer_needed,
      quatation_purpose_only,
      is_client_design,
      cloned_from,
      reference_no,
      status = "enquiry",
    } = req.body;

    let final_reference_no = "";
    if (reference_no && reference_no.trim() !== "") {
      final_reference_no = reference_no;
    }





    let parsedProductSize = [];

    if (req.body.product_size) {
      try {
        parsedProductSize = JSON.parse(req.body.product_size);
      } catch (err) {
        console.error("Invalid product_size JSON:", req.body.product_size, err);
        parsedProductSize = [];
      }
    }


    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const lastEnquiry = await enquiryModel
      .findOne({ job_no: { $regex: /^RD\d+$/ } })
      .sort({ createdAt: -1 })
      .select("job_no");

    let nextJobNoNumber = 21001;
    if (lastEnquiry?.job_no) {
      const match = lastEnquiry.job_no.match(/RD(\d+)/);
      if (match) {
        nextJobNoNumber = parseInt(match[1], 10) + 1;
      }
    }

    const job_no = `RD${nextJobNoNumber.toString().padStart(5, "0")}`;


    // let imageObjs = [];
    // if (req.files?.length > 0) {
    //   for (const file of req.files) {
    //     const url = await uploadToR2(`${category}/${subcategory}/${job_no}/designs`, file.buffer, file.originalname, file.mimetype);
    //     imageObjs.push({
    //       url,
    //       starttime: getCurrentDate(),
    //       endtime: getCurrentDate(),
    //       //newly added
    //       imageunit: unit,
    //       image_product_size: parsedProductSize,
    //       designer_person: username
    //     });
    //   }
    // }

    // Process images
    let imageObjs = [];
    // if (req.files?.images?.length > 0) {
    //   for (const file of req.files.images) {
    //     const url = await uploadToR2(
    //       `${category}/${subcategory}/${job_no}/designs`,
    //       file.buffer,
    //       file.originalname,
    //       file.mimetype
    //     );
    //     imageObjs.push({
    //       url,
    //       starttime: getCurrentDate(),
    //       endtime: getCurrentDate(),
    //       imageunit: unit,
    //       image_product_size: parsedProductSize,
    //       designer_person: username,
    //     });
    //   }
    // }



    // ref images
    let reference_image = [];
    if (req.files?.images?.length > 0) {
      for (const file of req.files.images) {
        const url = await uploadToR2(
          `${category}/${subcategory}/${job_no}/reference_images`,
          file.buffer,
          file.originalname,
          file.mimetype
        );
        reference_image.push(url);
      }
    }




    if (req.body.clone_image_keys) {
      const keys = JSON.parse(req.body.clone_image_keys); // array of existing image keys
      console.log("Cloning the following image keys:", keys);



      const clonedReferenceImages = [];

      for (const key of keys) {
        try {
          console.log("Fetching file for key:", key);

          // Use the existing downloadFromR2 function
          const fileBuffer = await downloadFromR2(key);

          console.log("File buffer received:", fileBuffer?.byteLength || 0, "bytes");

          const parts = key.split("/");
          const originalName = parts[parts.length - 1];
          console.log("Original file name:", originalName);

          const mimeType = mime.lookup(originalName) || "application/octet-stream";

          console.log("MIME type inferred:", mimeType);

          const url = await uploadToR2(
            `${category}/${subcategory}/${job_no}/reference_images`,
            fileBuffer,
            originalName,
            mimeType
          );

          clonedReferenceImages.push(url);

        } catch (err) {
          console.error("Error cloning image from key:", key, err);
        }
      }

      console.log("All cloned reference images:", clonedReferenceImages);

      // Merge with any already uploaded reference images
      reference_image = [...(reference_image || []), ...clonedReferenceImages];
      console.log("Final reference_image array:", reference_image);
    }
    // Process attachments
    let attachmentUrls = [];
    if (req.files?.attachments?.length > 0) {
      for (const file of req.files.attachments) {
        const url = await uploadToR2(
          `${category}/${subcategory}/${job_no}/attachments`,
          file.buffer,
          file.originalname,
          file.mimetype
        );
        attachmentUrls.push(url);
      }
    }


    if (req.body.clone_attachment_keys) {
      const keys = JSON.parse(req.body.clone_attachment_keys);
      console.log("Cloning the following image keys:", keys);

      const clonedReferenceAttachments = [];

      for (const key of keys) {
        try {
          console.log("Fetching file for key:", key);

          // Use the existing downloadFromR2 function
          const fileBuffer = await downloadFromR2(key);

          console.log("File buffer received:", fileBuffer?.byteLength || 0, "bytes");

          const parts = key.split("/");
          const originalName = parts[parts.length - 1];
          console.log("Original file name:", originalName);

          const mimeType = mime.lookup(originalName) || "application/octet-stream";

          console.log("MIME type inferred:", mimeType);

          const url = await uploadToR2(
            `${category}/${subcategory}/${job_no}/attachments`,
            fileBuffer,
            originalName,
            mimeType
          );

          clonedReferenceAttachments.push(url);

        } catch (err) {
          console.error("Error cloning image from key:", key, err);
        }
      }

      console.log("All cloned reference images:", clonedReferenceAttachments);

      // Merge with any already uploaded reference images
      attachmentUrls = [...(attachmentUrls || []), ...clonedReferenceAttachments];
      console.log("Final attachmentUrls array:", attachmentUrls);
    }

    // Process attachments
    let DesignfilesattachmentUrls = [];
    if (req.files?.client_design_files?.length > 0) {
      for (const file of req.files.client_design_files) {
        const url = await uploadToR2(
          `${category}/${subcategory}/${job_no}/designs/additional_files`,
          file.buffer,
          file.originalname,
          file.mimetype
        );
        DesignfilesattachmentUrls.push(url);
      }
    }




    let is_completed = false;


    if (is_designer_needed) {
      if (Number(no_of_options) === Number(req.files?.images?.length)) {
        is_completed = true;
      }
    }

    console.log("is_completed:", is_completed);

    let designer_person;

    console.log("designer_person", req.body.designer_person)

    if (req.body.designer_person) {
      try {

        designer_person = Array.isArray(req.body.designer_person)
          ? req.body.designer_person
          : [req.body.designer_person];

      } catch (err) {
        console.error("Invalid designer_person JSON", err);
      }
    }



    const enquiryData = {
      id: nanoid(16),
      job_no,
      name,
      mobile_no: (mobile_no !== undefined && mobile_no !== null && mobile_no !== "") ? Number(mobile_no) : undefined,
      email,
      enquiry_origin,
      no_of_options,
      reference_images: reference_image,
      images: imageObjs,
      additional_attachments: attachmentUrls,
      product_name,
      product_quantity,
      product_size: parsedProductSize,
      budget,
      budget_to: budget_to ?? "",
      preferred_material,
      product_description,
      delivery_date,
      delivery_type,
      delivery_location,
      delivery_mode,
      briefing,
      payment_terms,
      cordinator,
      marketing_cordinator,
      cordinator_remarks,
      is_active: true,
      created_by: userId,
      created_at: getCurrentDate(),
      updated_by: [],
      updated_at: null,
      status,
      category,
      subcategory,
      designer_remarks,
      is_redo,
      who_will_pay,
      unit,
      wp_number,
      show_logo,
      show_content,
      copyright_content,
      links_duration,
      is_designer_needed,
      is_completed,
      quatation_purpose_only,
      is_client_design,
      client_design_files: DesignfilesattachmentUrls,
      cloned_from,
      reference_no: final_reference_no
    };


    if (designer_person && designer_person.length > 0) {
      enquiryData.designer_person = designer_person.map(userId => ({
        user: userId,
        completed: false
      }));

      enquiryData.is_designer_allocated = true;
      enquiryData.is_design_processing = false;
    }


    const newEnquiry = new enquiryModel(enquiryData);
    const saved = await newEnquiry.save();

    res.status(201).json({ success: true, message: "Enquiry created successfully", data: saved });
  } catch (error) {
    console.error("Error creating enquiry:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const updateEnquiry = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    if (Object.prototype.hasOwnProperty.call(updates, "mobile_no")) {
      if (updates.mobile_no === "" || updates.mobile_no === null || updates.mobile_no === undefined) {
        updates.mobile_no = null;
      } else {
        updates.mobile_no = Number(updates.mobile_no);
      }
    }
    const userId = req.user?._id;
    const username = req.user?.name;
    const inside_images_id = req.query.inside_images_id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const existingEnquiry = await enquiryModel.findOne({ id });

    if (!existingEnquiry) {
      return res.status(404).json({ success: false, message: "Enquiry not found" });
    }

    ///Abondon
    if (updates?.is_cancelled) {
      updates.status = "abandon"
      updates.is_cancelled_by = {
        ...updates.is_cancelled_by,
        user: userId,
        date: getCurrentDate(),
      };
    }

    //is_completed logic
    if (updates?.is_completed) {
      updates.is_rework = false;
    }

    //product size

    // Hold/Unhold Logic
    if (updates.is_on_hold !== undefined) {
      if (updates.is_on_hold === true || updates.is_on_hold === "true") {
        updates.is_on_hold = true;
        // Putting on Hold
        updates.hold_history = [
          ...(existingEnquiry.hold_history || []),
          {
            reason: updates.hold_reason,
            start_time: getCurrentDate(),
            hold_by: userId,
          }
        ];
      } else {
        // Unholding
        updates.is_on_hold = false;
        const history = existingEnquiry.hold_history || [];
        if (history.length > 0) {
          const lastHold = history[history.length - 1];
          lastHold.end_time = getCurrentDate();
          lastHold.unhold_by = userId;
          updates.hold_history = history;
        }

        // Update delivery date if provided
        if (updates.delivery_date) {
          existingEnquiry.delivery_date = updates.delivery_date
        }
      }

      // Cascade to sub-jobs (Always enforce for HOLD, per requirements)
      // "When a parent enquiry is set to hold, all associated sub-jobs must also be marked as hold."
      if (updates.is_on_hold === true) {
        // Putting all sub-jobs on hold
        const subJobs = await salesorderlistModel.find({ enquiry_id: existingEnquiry._id });
        for (const sj of subJobs) {
          if (!sj.is_on_hold) {
            sj.is_on_hold = true;
            sj.hold_history = [
              ...(sj.hold_history || []),
              {
                reason: updates.hold_reason || "Parent enquiry put on hold",
                start_time: getCurrentDate(),
                hold_by: userId,
              }
            ];
            await sj.save();
          }
        }

        // Putting all DTP sub-jobs on hold
        const dtpJobs = await dtpStudioModel.find({ enquiry_id: existingEnquiry._id });
        for (const dj of dtpJobs) {
          if (!dj.is_on_hold) {
            dj.is_on_hold = true;
            dj.hold_history = [
              ...(dj.hold_history || []),
              {
                reason: updates.hold_reason || "Parent enquiry put on hold",
                start_time: getCurrentDate(),
                hold_by: userId,
              }
            ];
            await dj.save();
          }
        }

        // Putting all DTP groups on hold
        const dtpGroups = await dtpGroupModel.find({ enquiry_id: existingEnquiry._id });
        for (const dg of dtpGroups) {
          if (!dg.is_on_hold) {
            dg.is_on_hold = true;
            dg.hold_history = [
              ...(dg.hold_history || []),
              {
                reason: updates.hold_reason || "Parent enquiry put on hold",
                start_time: getCurrentDate(),
                hold_by: userId,
              }
            ];
            await dg.save();
          }
        }
      }


      // For UNHOLD, if the user explicitly requested to hold all sub-jobs (maybe via a checkbox in UI which might send hold_all_sub_jobs), we respect it.
      // But for now I will strictly follow "parent hold -> sub jobs hold".

      else if (updates.is_on_hold === false && (updates.hold_all_sub_jobs === true || updates.hold_all_sub_jobs === 'true')) {
        // Unholding all sub-jobs if explicitly requested (preserving existing capability)
        const subJobs = await salesorderlistModel.find({ enquiry_id: existingEnquiry._id });
        for (const sj of subJobs) {
          if (sj.is_on_hold) {
            sj.is_on_hold = false;
            const history = sj.hold_history || [];
            if (history.length > 0) {
              const lastHold = history[history.length - 1];
              if (!lastHold.end_time) {
                lastHold.end_time = getCurrentDate();
                lastHold.unhold_by = userId;
                sj.hold_history = history;
              }
            }
            await sj.save();
          }
        }

        // Unholding all DTP sub-jobs
        const dtpJobs = await dtpStudioModel.find({ enquiry_id: existingEnquiry._id });
        for (const dj of dtpJobs) {
          if (dj.is_on_hold) {
            dj.is_on_hold = false;
            const history = dj.hold_history || [];
            if (history.length > 0) {
              const lastHold = history[history.length - 1];
              if (!lastHold.end_time) {
                lastHold.end_time = getCurrentDate();
                lastHold.unhold_by = userId;
                dj.hold_history = history;
              }
            }
            await dj.save();
          }
        }

        // Unholding all DTP groups
        const dtpGroups = await dtpGroupModel.find({ enquiry_id: existingEnquiry._id });
        for (const dg of dtpGroups) {
          if (dg.is_on_hold) {
            dg.is_on_hold = false;
            const history = dg.hold_history || [];
            if (history.length > 0) {
              const lastHold = history[history.length - 1];
              if (!lastHold.end_time) {
                lastHold.end_time = getCurrentDate();
                lastHold.unhold_by = userId;
                dg.hold_history = history;
              }
            }
            await dg.save();
          }
        }
      }
      if (updates.hold_all_sub_jobs) delete updates.hold_all_sub_jobs;
    }

    if (req.body.product_size) {
      let parsedProductSize = [];

      try {
        parsedProductSize = JSON.parse(req.body.product_size);
      } catch (err) {
        console.error("Invalid product_size JSON:", req.body.product_size, err);
        parsedProductSize = [];
      }
      updates.product_size = parsedProductSize;

    }


    console.log("existingEnquiry", existingEnquiry)

    if (updates.product_size && Array.isArray(updates.product_size)) {
      existingEnquiry.product_size = [...existingEnquiry.product_size, ...updates.product_size];
      delete updates.product_size;
    }


    // if (updates?.designer_person && Array.isArray(updates?.designer_person) && updates?.designer_person.length > 0) {
    //   updates.is_designer_allocated = true;
    // }


    //designer check
    if (
      updates?.designer_person &&
      Array.isArray(updates.designer_person) &&
      updates.designer_person.length > 0
    ) {

      if (updates?.designerreassign) {

        updates.designer_person = [...updates.designer_person];
        updates.is_designer_allocated = true;
        updates.is_design_processing = false;

      } else {
        const hasIncompleteDesigner = existingEnquiry.designer_person?.some(
          dp => dp.completed === false
        );

        if (hasIncompleteDesigner) {
          return res.status(400).json({
            success: false,
            message: "Cannot assign a new designer while an existing one hasn't completed their task.",
          });
        }

        // new logic for client designer
        //  if(!existingEnquiry.is_client_design){

        //          const hasIncompleteDesigner = existingEnquiry.designer_person?.some(
        //             dp => dp.completed === false
        //           );

        //           if (hasIncompleteDesigner) {
        //             return res.status(400).json({
        //               success: false,
        //               message: "Cannot assign a new designer while an existing one hasn't completed their task.",
        //             });
        //           }
        //         }


        updates.designer_person = [...existingEnquiry.designer_person, ...updates.designer_person];
        updates.is_designer_allocated = true;
        updates.is_design_processing = false;

        // is_client_design flow
        //    if(!existingEnquiry.is_client_design){
        //       updates.is_design_processing = false;
        //    }

        //    if(existingEnquiry.is_client_design){
        //     // merge designers
        // updates.designer_person = [
        //   ...existingEnquiry.designer_person,
        //   ...updates.designer_person,
        // ];

        // // updates.is_designer_allocated = true;

        // if (existingEnquiry.is_client_design) {
        //   updates.designer_person = updates.designer_person.map(dp => ({
        //     ...dp,
        //     completed: true,
        //   }));
        // }
        //       updates.is_completed = true;
        //       updates.accept_button = true;
        //     updates.submit_button = true;
        //    }



      }
    }




    let existingImages = existingEnquiry.images || [];

    //for accept images 
    if (updates?.accept_image) {


      // designer only upload logic
      // if(!permission.includes(10) && !permission.includes(9)){


      // if (!isDesignerAssigned) {
      //   return res.status(403).json({
      //     success: false,
      //     message: "Only assigned designers can accept the image.",
      //   });
      // }


      // }
      //


      const openSessionExists = existingImages.some(img => img.url === null && img.endtime === null);

      if (openSessionExists) {
        return res.status(400).json({
          success: false,
          message: "An open session already exists. Please upload files or close the current session before accepting again."
        });
      }

      const unacceptedImagesCount = existingImages.filter(img => img.is_accepted === true || img.is_accepted === "" || img.is_accepted === null || img.is_accepted === undefined).length;

      console.log("unacceptedImagesCount", unacceptedImagesCount)
      console.log("existingImages.length", existingImages.length)

      if (unacceptedImagesCount >= existingEnquiry.no_of_options) {
        return res.status(400).json({
          success: false,
          message: `You have already reached the maximum allowed number of options (${existingEnquiry.no_of_options}).`
        });
      }


      const newImageEntry = {
        url: null,
        starttime: getCurrentDate(),
        endtime: null,
        designer_person: username,
        pause_time: null,
        pause_notes: null,
        resume_time: null,
        is_accepted: "",
      };

      existingImages.push(newImageEntry);


      updates.is_accept = true;
      updates.is_design_processing = true;
    }



    if (!existingEnquiry.is_accept && req.files?.images?.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Please accept first before uploading images.",
      });
    }


    ///upload images
    if (req.files?.images?.length > 0 && inside_images_id) {
      const file = req.files?.images[0];
      console.log("file", file)

      try {
        // const url = await uploadToR2("designs", file.buffer, file.originalname, file.mimetype);
        const url = await uploadToR2(`${existingEnquiry.category}/${existingEnquiry.subcategory}/${existingEnquiry.job_no}/designs`, file.buffer, file.originalname, file.mimetype);

        const endtime = getCurrentDate();

        const updateResult = await enquiryModel.updateOne(
          { id, "images._id": inside_images_id },
          {
            $set: {
              "images.$.url": url,
              "images.$.designer_person": username,
              "images.$.endtime": endtime,
              is_accept: false,
              // is_rework: false,
              updated_at: getCurrentDate(),
              updated_by: {
                user: userId,
                date: getCurrentDate(),
              },
            },
          }
        );

        if (updateResult.modifiedCount === 0) {
          return res.status(404).json({
            success: false,
            message: "Image session not found or no updates applied.",
          });
        }

        await evaluateCompletionStatus(id, username, userId);

        const updatedEnquiry = await enquiryModel
          .findOne({ id })
          .populate("cordinator", "name")
          .populate("marketing_cordinator", "name")
          .populate("created_by", "name")
          .populate("updated_by.user", "name");

        const signedImages = (updatedEnquiry?.images || []).map((img) => ({
          ...(img.toObject ? img.toObject() : img),
          url: img.url ? generateSignedUrl(img.url) : null,
          additional_files: Array.isArray(img.additional_files)
            ? img.additional_files.map((file) => generateSignedUrl(file))
            : [],
        }));

        const signedAdditionalAttachments = Array.isArray(updatedEnquiry?.additional_attachments)
          ? updatedEnquiry.additional_attachments.map((file) => generateSignedUrl(file))
          : [];

        const signedclient_design_files = Array.isArray(updatedEnquiry?.client_design_files)
          ? updatedEnquiry.client_design_files.map((file) => generateSignedUrl(file))
          : [];

        const signedreference_images = Array.isArray(updatedEnquiry?.reference_images)
          ? updatedEnquiry.reference_images.map((file) => generateSignedUrl(file))
          : [];

        const enquiryWithSignedUrls = {
          ...updatedEnquiry.toObject(),
          images: signedImages,
          additional_attachments: signedAdditionalAttachments,
          client_design_files: signedclient_design_files,
          reference_images: signedreference_images,
        };

        return res.status(200).json({
          success: true,
          message: "Image uploaded and session updated successfully",
          data: enquiryWithSignedUrls,
        });

      } catch (uploadError) {
        console.error("Upload error:", uploadError);
        return res.status(500).json({
          success: false,
          message: "Failed to upload file.",
          error: uploadError.message,
        });
      }
    }

    //inside images array values
    if (inside_images_id) {
      const updateFields = {};
      if (updates?.imageunit) updateFields["images.$.imageunit"] = updates.imageunit;

      if (updates?.image_product_size) {
        let imageparsedProductSize = [];

        try {
          imageparsedProductSize = JSON.parse(updates?.image_product_size);
        } catch (err) {
          console.error("Invalid product_size JSON:", updates?.image_product_size, err);
          imageparsedProductSize = [];
        }

        updateFields["images.$.image_product_size"] = imageparsedProductSize;
      }

      if (updates?.pause_time) updateFields["images.$.pause_time"] = getCurrentDate();
      if (updates?.pause_notes) updateFields["images.$.pause_notes"] = updates.pause_notes;
      if (updates?.resume_time) updateFields["images.$.resume_time"] = getCurrentDate();

      if (updates?.is_accepted === true || updates?.is_accepted === false) {
        updateFields["images.$.is_accepted"] = updates.is_accepted;
        console.log("updates.is_accepted", updates.is_accepted)

        if (updates.is_accepted === false) {
          await enquiryModel.updateOne(
            { id },
            {
              $set: {
                is_design_rejected: false,
                // is_designer_allocated: false,
                updated_at: getCurrentDate(),
                updated_by: {
                  user: userId,
                  date: getCurrentDate(),
                },
              },
            }
          );
        }
      }


      const updateResult = await enquiryModel.updateOne(
        { id, "images._id": inside_images_id },
        {
          $set: {
            ...updateFields,
            updated_at: getCurrentDate(),
            updated_by: {
              user: userId,
              date: getCurrentDate(),
            },
          },
        }
      );

      if (updateResult.modifiedCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Image session not found or no updates applied.",
        });
      }

      const updatedEnquiry = await enquiryModel
        .findOne({ id })
        .populate("cordinator", "name")
        .populate("marketing_cordinator", "name")
        .populate("created_by", "name")
        .populate("updated_by.user", "name");

      return res.status(200).json({
        success: true,
        message: "Image session data updated successfully",
        data: updatedEnquiry,
      });
    }

    // no of options
    console.log("updates?.no_of_options", updates?.no_of_options)
    if (updates?.no_of_options !== undefined) {
      const oldOptions = existingEnquiry.no_of_options || 0;
      const newOptions = Number(updates.no_of_options);

      if (isNaN(newOptions)) {
        return res.status(400).json({
          success: false,
          message: "no_of_options must be a number",
        });
      }


      if (existingEnquiry.images.length >= 1) {

        if (newOptions <= oldOptions) {
          return res.status(400).json({
            success: false,
            message: `New number of options (${newOptions}) must be greater than existing value (${oldOptions}).`,
          });
        }


        updates.is_completed = false;
        updates.is_designer_completed = false;
        updates.is_design_processing = true;
        updates.accept_button = false;
        updates.submit_button = false;

        if (existingEnquiry.designer_person?.length > 0) {
          const lastIndex = existingEnquiry.designer_person.length - 1;
          existingEnquiry.designer_person[lastIndex].completed = false;
        }

        updates.designer_person = existingEnquiry.designer_person;
      }
    }


    //redo
    if (updates?.redo === true) {
      updates.is_completed = false;
      updates.is_designer_completed = false;
      updates.is_design_processing = '';
      updates.accept_button = false;
      updates.submit_button = false;
      updates.is_redo = true;
      updates.is_designer_allocated = false;
      updates.is_design_rejected = true;
    }




    const finalUpdateResult = await enquiryModel.updateOne(
      { id },
      {
        $set: {
          ...updates,
          updated_at: getCurrentDate(),
          images: existingImages,
          updated_by: {
            user: userId,
            date: getCurrentDate(),
          },
        },
      }
    );

    if (finalUpdateResult.modifiedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "No changes applied to the enquiry.",
      });
    }


    const updatedEnquiry = await enquiryModel
      .findOne({ id })
      .populate("cordinator", "name")
      .populate("marketing_cordinator", "name")
      .populate("created_by", "name")
      .populate("updated_by.user", "name");

    return res.status(200).json({
      success: true,
      message: "Enquiry updated successfully",
      data: updatedEnquiry,
    });

  } catch (error) {
    console.error("Error updating enquiry:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

//
async function evaluateCompletionStatus(id) {
  const enquiry = await enquiryModel.findOne({ id });
  if (!enquiry) return;

  console.log("Fetched enquiry for evaluation:", enquiry);

  const images = enquiry.images || [];
  console.log("All images:", images);

  const totalValidUrls = images.filter(img => img.url).length;
  console.log("Total uploaded images:", totalValidUrls);

  const hasRejected = images.some(img => img.is_accepted === false && img.image_rework === false);
  console.log("Any image rejected:", hasRejected);

  const rejectedCount = images.filter(img => img.is_accepted === false && img.image_rework === false).length;
  console.log("Number of rejected images:", rejectedCount);

  const reworkCount = images.filter(img => img.is_accepted === false && img.image_rework === true).length;
  console.log("Number of rejected images:", reworkCount);


  const isCompleted = totalValidUrls === enquiry.no_of_options && !hasRejected;
  console.log("Enquiry is_completed status:", isCompleted);

  // await enquiryModel.updateOne(
  //   { id },
  //   {
  //     $set: {
  //       is_completed: isCompleted,
  //     }
  //   }
  // );
  // console.log("Updated enquiry is_completed in DB.");

  const assignedImages = images.filter(img =>
    // !img.designer_person || img.designer_person === username
    !img.designer_person || img.designer_person

  );

  console.log("Images assigned to this designer:", assignedImages.length);

  const uploadedImages = assignedImages.filter(img => img.url);
  console.log("Designer uploaded images:", uploadedImages.length);

  const adjustedUploadedCount = uploadedImages.length - reworkCount;
  console.log("Adjusted uploaded count (after removing rejected):", adjustedUploadedCount);




  // new logic
  // const designerCompleted =
  // adjustedUploadedCount === enquiry.no_of_options && assignedImages.length > 0;

  // const designerCompleted = uploadedImages.length === enquiry.no_of_options && assignedImages.length > 0;

  //latest change production

  const designerCompleted = adjustedUploadedCount === enquiry.no_of_options && assignedImages.length > 0;
  console.log("enquiry.no_of_options", enquiry.no_of_options)
  console.log("Designer completed all uploads:", designerCompleted);

  const existingDesigner = enquiry.designer_person?.find(dp => dp.completed === false);

  if (existingDesigner) {
    await enquiryModel.updateOne(
      {
        id,
        "designer_person._id": existingDesigner._id,
      },
      {
        $set: {
          "accept_button": designerCompleted,
          "submit_button": designerCompleted,
          "is_completed": designerCompleted,
          "is_design_processing": designerCompleted ? false : true,
          "designer_person.$.completed": designerCompleted,
          "is_designer_completed": designerCompleted,
          "is_redo": designerCompleted ? false : '',
        }
      }
    );

    console.log(`Updated designer (_id: ${existingDesigner._id}) completed flag to:`, designerCompleted);
  } else {
    console.log("No designer with completed: false found. Skipping update.");
  }
};
//
export const deleteEnquiry = async (req, res) => {
  try {
    const { id } = req.params;
    const enquiry = await enquiryModel.findOne({ id });

    if (!enquiry) {
      return res.status(404).json({ success: false, message: "Enquiry not found" });
    }
    const images = enquiry.images || [];
    await Promise.all(
      images.map(async (img) => {
        try {
          await deleteFromR2(img.url);
        } catch (err) {
          console.error("Failed to delete image from R2:", img.url, err);
        }
      })
    );

    await enquiryModel.deleteOne({ id });

    res.status(200).json({ success: true, message: "Enquiry deleted successfully" });
  } catch (error) {
    console.error("Error deleting enquiry:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};


export const getDesignerSummary = async (req, res) => {
  try {
    const summary = await enquiryModel.aggregate([
      { $unwind: "$designer_person" },
      {
        $group: {
          _id: "$designer_person.user",
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ["$designer_person.completed", true] }, 1, 0] },
          },
          pending: {
            $sum: { $cond: [{ $eq: ["$designer_person.completed", false] }, 1, 0] },
          },
          completed_job_numbers: {
            $push: {
              $cond: [{ $eq: ["$designer_person.completed", true] }, "$job_no", "$$REMOVE"],
            },
          },
          pending_job_numbers: {
            $push: {
              $cond: [{ $eq: ["$designer_person.completed", false] }, "$job_no", "$$REMOVE"],
            },
          },
        },
      },
      { $sort: { total: -1 } },
    ]);

    const userIds = summary.map((s) => s._id);
    const users = await userModel.find({ _id: { $in: userIds } }, "name");
    const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), u.name]));

    const designerSummary = summary.map((item) => ({
      user: item._id,
      name: userMap[item._id.toString()] || "Unknown",
      total: item.total,
      completed: item.completed,
      pending: item.pending,
      completed_job_numbers: item.completed_job_numbers,
      pending_job_numbers: item.pending_job_numbers,
    }));

    res.status(200).json({
      success: true,
      count: designerSummary.length,
      data: designerSummary,
    });
  } catch (error) {
    console.error("Error generating designer summary:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};




export const sendDesignEmailById = async (req, res) => {
  try {
    const { id } = req.params;

    const enquiry = await enquiryModel.findOne({ id });
    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: "Enquiry not found",
      });
    }

    const expiresInSeconds = (enquiry.links_duration || 0) * 60 * 60;

    const emailHTML = await generateEmailTemplate(enquiry, expiresInSeconds);

    const enqTheme = enquiry.the_ask?.theme || enquiry.theme || enquiry.product_name || "Product";
    await sendMailWithUser(req.user, {
      to: Array.isArray(enquiry.email) ? enquiry.email.join(",") : enquiry.email,
      subject: `Designs for ${enqTheme ? enqTheme.charAt(0).toUpperCase() + enqTheme.slice(1) : "Product"}`,
      html: emailHTML,
    });

    res.status(200).json({
      success: true,
      message: "Design email sent successfully",
      enquiryId: id,
    });
  } catch (error) {
    console.error("Error sending design email:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};




///clients access


export const updateenquiryimageApprovalforclient = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const inside_images_id = req.query.inside_images_id;

    const actor = await getAuthUserFromReq(req);
    const action_by_type = actor ? "Internal User" : "Client";
    const action_by_user = actor ? actor._id : null;
    const action_by_name = actor ? actor.name : "Client";
    const action_by_role = actor ? actor.role : "Client";

    const existingEnquiry = await enquiryModel.findOne({ id });
    if (!existingEnquiry) {
      return res.status(404).json({ success: false, message: "Enquiry not found" });
    }

    const enquiryUpdateFields = {};
    const imageUpdateFields = {};

    // DTP File Updates - Handling Master Template and Content Proofing approvals
    if (updates.dtp_file_update) {
      if (!updates.dtp_id || !updates.file_id || !updates.file_type || !updates.status) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields for DTP update (dtp_id, file_id, file_type, status)."
        });
      }

      const { dtp_id, file_id, file_type, status, rejection_reason } = updates;

      const dtpJob = await dtpStudioModel.findById(dtp_id);
      if (!dtpJob) {
        return res.status(404).json({ success: false, message: "DTP Job not found." });
      }

      let arrayToUpdate = "";
      if (file_type === "master") {
        arrayToUpdate = "master_template_files";
      } else if (file_type === "proofing") {
        arrayToUpdate = "content_proofing_files";
      } else {
        return res.status(400).json({ success: false, message: "Invalid file_type." });
      }

      // Find subdocument
      const fileSubDoc = dtpJob[arrayToUpdate].id(file_id);
      if (!fileSubDoc) {
        return res.status(404).json({ success: false, message: "File record not found in DTP job." });
      }

      // Update status & action tracking
      fileSubDoc.status = status;
      fileSubDoc.action_by_type = action_by_type;
      fileSubDoc.action_by_user = action_by_user;
      fileSubDoc.action_by_name = action_by_name;
      fileSubDoc.action_by_role = action_by_role;

      const nowDt = getCurrentDate();
      if (status === "Rejected") {
        fileSubDoc.rejected_date_time = nowDt;
        fileSubDoc.rejected_at = nowDt;
        fileSubDoc.rejected_by = action_by_user || undefined;
        fileSubDoc.rejected_by_name = action_by_name;
        fileSubDoc.rejection_reason = rejection_reason || "";

        // Reset approval fields
        fileSubDoc.approved_date_time = undefined;
        fileSubDoc.approved_at = undefined;
        fileSubDoc.approved_by = undefined;
        fileSubDoc.approved_by_name = undefined;

        // Handle Rejection Reference File Upload
        if (req.files && req.files['rejection_reference_file']) {
          const refFile = req.files['rejection_reference_file'][0];
          const fileKey = `${existingEnquiry.category}/${existingEnquiry.subcategory}/${existingEnquiry.job_no}/dtp/rejection_reference/${Date.now()}_${refFile.originalname}`;

          const refUrl = await uploadToR2(
            fileKey,
            refFile.buffer,
            refFile.originalname,
            refFile.mimetype
          );

          fileSubDoc.rejection_reference_file = refUrl;
        }

      } else if (status === "Approved") {
        fileSubDoc.approved_date_time = nowDt;
        fileSubDoc.approved_at = nowDt;
        fileSubDoc.approved_by = action_by_user || undefined;
        fileSubDoc.approved_by_name = action_by_name;
        fileSubDoc.rejection_reason = ""; // Clear reason if approved
        fileSubDoc.rejection_reference_file = ""; // Clear reference file

        // Reset rejection fields
        fileSubDoc.rejected_date_time = undefined;
        fileSubDoc.rejected_at = undefined;
        fileSubDoc.rejected_by = undefined;
        fileSubDoc.rejected_by_name = undefined;
      }


      // Add to history
      const historyDescription = status === 'Rejected'
        ? `${action_by_name} (${action_by_role}) Rejected ${file_type === 'master' ? 'master' : 'content'} proof. Reason: ${rejection_reason}`
        : `${action_by_name} (${action_by_role}) Approved ${file_type === 'master' ? 'master' : 'content'} proof`;

      dtpJob.history.push({
        action: `${file_type === 'master' ? 'Master' : 'Content'} Proof Client Update`,
        description: historyDescription,
        user: action_by_user,
        is_client_approval: !actor,
        date: nowDt
      });

      await dtpJob.save();

      // Auto-stage transition: if all files in this stage are Approved → move to next stage
      if (status === "Approved") {
        const allApproved = dtpJob[arrayToUpdate].length > 0 &&
          dtpJob[arrayToUpdate].every(f => f.status === "Approved");

        if (allApproved) {
          let nextStage = null;

          if (file_type === "master" && dtpJob.status === "Master Template") {
            nextStage = "Content Proofing";
          } else if (file_type === "proofing" && dtpJob.status === "Content Proofing") {
            nextStage = "Final Prep";
          }

          if (nextStage) {
            dtpJob.status = nextStage;
            dtpJob.history.push({
              action: "Stage Advanced",
              description: `All ${file_type === 'master' ? 'master template' : 'content proofing'} files approved by client. Auto-advanced to ${nextStage}.`,
              user: action_by_user,
              is_client_approval: !actor,
              date: nowDt
            });
            dtpJob.updated_at = nowDt;
            await dtpJob.save();
          }
        }
      }

      return res.status(200).json({
        success: true,
        message: "File status updated successfully."
      });
    }

    // Enquiry-level updates
    if (typeof updates?.to_sample === "boolean") {
      enquiryUpdateFields.to_sample = updates.to_sample;
    }
    if (typeof updates?.to_production === "boolean") {
      enquiryUpdateFields.to_production = updates.to_production;
    }



    if (updates?.rework === true || updates?.rework === "true") {
      enquiryUpdateFields.is_completed = false;
      enquiryUpdateFields.is_designer_completed = false;
      enquiryUpdateFields.is_design_processing = true;
      enquiryUpdateFields.accept_button = false;
      enquiryUpdateFields.submit_button = false;
      // updates.is_redo = true;
      // updates.is_designer_allocated = false;
      enquiryUpdateFields.is_design_rejected = true;
      enquiryUpdateFields.is_rework = true

      // Access and update the last designer's completed field
      if (existingEnquiry.designer_person && existingEnquiry.designer_person.length > 0) {
        const lastDesignerId = existingEnquiry.designer_person[existingEnquiry.designer_person.length - 1]._id;

        // Update the last designer's completed field in the database
        await enquiryModel.updateOne(
          { "designer_person._id": lastDesignerId },
          { $set: { "designer_person.$.completed": false } }
        );
      }
    }

    // Image-level updates (only if inside_images_id is provided)
    if (inside_images_id) {

      //additiaonl attachments
      let attachmentUrls = [];
      if (req.files?.additional_files?.length > 0) {
        for (const file of req.files.additional_files) {
          const url = await uploadToR2(
            `${existingEnquiry.category}/${existingEnquiry.subcategory}/${existingEnquiry.job_no}/designs/additional_files`,
            file.buffer,
            file.originalname,
            file.mimetype
          );
          attachmentUrls?.push(url);
        }
      }

      console.log("attachmentUrls", attachmentUrls)

      if (attachmentUrls.length > 0) {
        imageUpdateFields["images.$.additional_files"] = attachmentUrls;
      }


      ///
      if (updates?.feedback) {
        imageUpdateFields["images.$.feedback"] = updates.feedback;
      }

      if (typeof updates?.is_accepted === "boolean" || updates?.is_accepted) {
        console.log("asdasdasdadss")
        imageUpdateFields["images.$.is_accepted"] = updates.is_accepted;
        imageUpdateFields["images.$.accepted_date_time"] = getCurrentDate();

        if (updates.is_accepted === false) {
          enquiryUpdateFields.is_design_rejected = false;
        }
      }

      if (updates?.image_to_production !== undefined && typeof updates?.image_to_production === "boolean") {
        imageUpdateFields["images.$.image_to_production"] = updates.image_to_production;

        // If image_to_production = true
        if (updates?.image_to_production === true) {

          const selectedImage = existingEnquiry.images.find(
            (img) => img._id.toString() === inside_images_id
          );


          if (!selectedImage) {
            return res.status(404).json({
              success: false,
              message: "Image not found for sample creation."
            });
          }

          const lastSample = await salesorderlistModel
            .findOne({ enquiry_id: existingEnquiry._id })
            .sort({ createdAt: -1 });

          let job_no, sub_job_no;

          if (!lastSample) {
            job_no = existingEnquiry.job_no;
            sub_job_no = existingEnquiry.job_no + 'a';
          } else {
            console.log("222")
            job_no = lastSample.job_no;

            const lastChar = lastSample.sub_job_no.slice(-1).toLowerCase();
            sub_job_no = job_no + String.fromCharCode(lastChar.charCodeAt(0) + 1);

          }

          const lastDesigner = existingEnquiry.designer_person?.length
            ? existingEnquiry.designer_person[existingEnquiry.designer_person.length - 1].user
            : null;


          // Create Sample Order
          const newSampleOrder = new salesorderlistModel({
            id: nanoid(16),
            enquiry_id: existingEnquiry._id,
            job_no,
            sub_job_no,
            status: "pending",
            image: selectedImage.url,
            is_sales_order_filled: false,
            designer_person: lastDesigner,
            type: "production",
            // is_design_uploaded: existingEnquiry.is_client_design,
            is_client_design: existingEnquiry.is_client_design,
            // designer_files: existingEnquiry.client_design_files,
            created_by: req.user?._id || existingEnquiry.created_by,
            created_at: getCurrentDate(),
          });

          await newSampleOrder.save();

          // Create Sample Order
          const newSamplesalesOrder = new salesorderformModel({
            id: nanoid(16),
            enquiry_id: existingEnquiry._id,
            job_no,
            sub_job_no,
            sample_order_nanoid: newSampleOrder.id,
            sample__order_id: newSampleOrder._id,
            image: selectedImage.url,
            type: "production",
            created_by: req.user?._id || existingEnquiry.created_by,
            created_at: getCurrentDate(),
          });

          await newSamplesalesOrder.save();
        }


      }

      if (updates?.image_to_sample !== undefined && typeof updates?.image_to_sample === "boolean") {
        imageUpdateFields["images.$.image_to_sample"] = updates.image_to_sample;

        // If image_to_sample = true
        if (updates?.image_to_sample === true) {

          const selectedImage = existingEnquiry.images.find(
            (img) => img._id.toString() === inside_images_id
          );


          if (!selectedImage) {
            return res.status(404).json({
              success: false,
              message: "Image not found for sample creation."
            });
          }

          const lastSample = await salesorderlistModel
            .findOne({ enquiry_id: existingEnquiry._id })
            .sort({ createdAt: -1 });

          let job_no, sub_job_no;

          if (!lastSample) {
            job_no = existingEnquiry.job_no;
            sub_job_no = existingEnquiry.job_no + 'a';
          } else {
            console.log("222")
            job_no = lastSample.job_no;

            const lastChar = lastSample.sub_job_no.slice(-1).toLowerCase();
            sub_job_no = job_no + String.fromCharCode(lastChar.charCodeAt(0) + 1);

          }

          const lastDesigner = existingEnquiry.designer_person?.length
            ? existingEnquiry.designer_person[existingEnquiry.designer_person.length - 1].user
            : null;



          // Create Sample Order
          const newSampleOrder = new salesorderlistModel({
            id: nanoid(16),
            enquiry_id: existingEnquiry._id,
            job_no,
            sub_job_no,
            status: "pending",
            type: "sample",
            image: selectedImage.url,
            designer_person: lastDesigner,
            is_sales_order_filled: false,
            // is_design_uploaded: existingEnquiry.is_client_design,
            is_client_design: existingEnquiry.is_client_design,
            // designer_files: existingEnquiry.client_design_files,
            created_by: req.user?._id || existingEnquiry.created_by,
            created_at: getCurrentDate(),
          });

          await newSampleOrder.save();

          // Create Sample Order
          const newSamplesalesOrder = new salesorderformModel({
            id: nanoid(16),
            enquiry_id: existingEnquiry._id,
            job_no,
            sub_job_no,
            sample_order_nanoid: newSampleOrder.id,
            sample__order_id: newSampleOrder._id,
            image: selectedImage.url,
            type: "sample",
            created_by: req.user?._id || existingEnquiry.created_by,
            created_at: getCurrentDate(),
          });

          await newSamplesalesOrder.save();
        }

      }

      console.log("+___________________")
      console.log("___________________ rewok", updates?.rework)
      console.log(typeof updates?.rework);

      if (updates?.rework !== undefined || updates?.rework != null && updates?.rework === true || updates?.rework === "true") {
        console.log("rework32234234234234", updates?.rework)
        imageUpdateFields["images.$.image_rework"] = updates.rework;
      }



    }

    // First, update enquiry-level fields
    if (Object.keys(enquiryUpdateFields).length > 0) {
      await enquiryModel.updateOne({ id }, { $set: enquiryUpdateFields });
    }

    // Then, update image-level fields if applicable
    if (inside_images_id && Object.keys(imageUpdateFields).length > 0) {
      const updateResult = await enquiryModel.updateOne(
        { id, "images._id": inside_images_id },
        { $set: imageUpdateFields }
      );

      if (updateResult.modifiedCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Image session not found or no updates applied.",
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Design Approval updated successfully",
    });
  } catch (error) {
    console.error("Error updating Design Approval:", error);
    return res.status(500).json({
      success: false,
      message: "Error updating Design Approval",
      error: error.message,
    });
  }
};



// export const getEnquiryByIdforclient = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const enquiry = await enquiryModel
//       .findOne({ id })
//       .populate("cordinator", "name")
//       .populate("marketing_cordinator", "name")
//       .populate("created_by", "name")
//       .populate("updated_by.user", "name")


//     if (!enquiry) {
//       return res.status(404).json({ success: false, message: "Enquiry not found" });
//     }


//     const expiresInSeconds = (enquiry.links_duration || 0) * 60 * 60;

//     // Determine if watermark is needed
//     const needsWatermark = enquiry.show_logo || enquiry.show_content;
//     const logoUrl = enquiry.show_logo ? LOGO_URL : null;
//     const copyrightText = enquiry.show_content ? enquiry.copyright_content : null;

//     const signedImages = (enquiry.images || []).map(async (img) => {
//       let signedUrl = img.url;
//       let watermarkedUrl = img.client_watermark_image || null;

//       if (img.url && needsWatermark && !watermarkedUrl) {
//         try {
//           console.log(`Creating watermark for image: ${img._id}`);

//           // Add watermark to image
//           const watermarkedBuffer = await addWatermarkToImage(
//             img.url,
//             logoUrl,
//             copyrightText
//           );

//           // Generate filename for watermarked image
//           const urlParts = img.url.split('/');
//           const originalFilename = urlParts[urlParts.length - 1];
//           const fileExtension = originalFilename.split('.').pop();
//           const timestamp = Date.now();
//           const watermarkedFilename = `watermarked_${timestamp}.${fileExtension}`;

//           // Construct R2 path: category/subcategory/job_no/temp/filename
//           const watermarkedKey = `${enquiry.category}/${enquiry.subcategory}/${enquiry.job_no}/temp/${watermarkedFilename}`;

//           // Upload watermarked image to R2
//           watermarkedUrl = await uploadToR2(
//             watermarkedBuffer,
//             watermarkedKey,
//             `image/${fileExtension}`
//           );

//           // Update database with watermarked image URL
//           await enquiryModel.updateOne(
//             { id: enquiry.id, "images._id": img._id },
//             {
//               $set: {
//                 "images.$.client_watermark_image": watermarkedUrl
//               }
//             }
//           );

//           console.log(`Watermarked image created and saved: ${watermarkedUrl}`);
//         } catch (watermarkError) {
//           console.error(
//             `Failed to create watermark for image ${img._id}:`,
//             watermarkError.message
//           );
//           // Continue with original image if watermarking fails
//           watermarkedUrl = null;
//         }
//       }

//       const imageUrl = needsWatermark && watermarkedUrl ? watermarkedUrl : img.url;

//       try {
//         if (imageUrl) {
//           signedUrl = generateSignedUrl(imageUrl, expiresInSeconds);
//         }
//       } catch (err) {
//         console.error("Error generating signed URL for image:", imageUrl, err);
//       }

//       return {
//         _id: img._id,
//         url: signedUrl,
//         imageunit: img.imageunit || "",
//         image_product_size: img.image_product_size,
//         starttime: img.starttime,
//         endtime: img.endtime,
//         designer_person: img.designer_person,
//         pause_time: img.pause_time,
//         pause_notes: img.pause_notes,
//         resume_time: img.resume_time,
//         is_accepted: img.is_accepted,
//         feedback: img.feedback,
//         accepted_date_time: img.accepted_date_time,
//       };
//     });

//     // const enquiryWithSignedUrls = {
//     //   ...enquiry.toObject(),
//     //   images: signedImages,
//     // };


//     const filteredResponse = {
//       name: enquiry.name,
//       id: enquiry.id,
//       product_name: enquiry.product_name,
//       job_no: enquiry.job_no,
//       images: signedImages,
//       to_production: enquiry.to_production,
//       to_sample: enquiry.to_sample
//     };




//     res.status(200).json({ success: true, data: filteredResponse });
//   } catch (error) {
//     console.error("Error fetching enquiry:", error);
//     res.status(500).json({ success: false, message: "Server error", error: error.message });
//   }
// };


export const getEnquiryDetailForImposedImage = async (enquiry) => {
  const LOGO_URL = process.env.LOGO_IMG_URL;

  const needsWatermark = enquiry.show_logo || enquiry.show_content;
  const logoUrl = enquiry.show_logo ? LOGO_URL : null;
  const copyrightText = enquiry.show_content ? enquiry.copyright_content : null;

  // Prepare enquiry details for watermark
  const enquiryDetails = {
    job_no: enquiry.job_no,
    category: enquiry.category,
    subcategory: enquiry.subcategory
  };

  return {
    needsWatermark,
    logoUrl,
    copyrightText,
    enquiryDetails
  }
}

export const getSignedImageUrl = async ({
  img,
  enquiry,
  expiresInSeconds,
  needsWatermark,
  logoUrl,
  copyrightText,
  enquiryDetails }) => {

  console.log("export image", img)

  let signedUrl = img.url;
  let watermarkedUrl = img.watermark_image_url || null;
  // If the stored watermark URL is an old temp URL, treat it as null so we regenerate it permanently
  if (watermarkedUrl && (watermarkedUrl.includes('/temp/') || watermarkedUrl.includes('//temp/'))) {
    watermarkedUrl = null;
  }
  if (img.url) {
    console.log(`Creating signed image: ${img._id}`);

    // Format product size from array
    let formattedProductSize = null;
    if (img.image_product_size && img.image_product_size.length > 0) {
      const size = img.image_product_size[0];
      const parts = [];

      for (const key in size) {
        const value = size[key];
        if (value) {
          const formattedKey = key.charAt(0).toUpperCase(); // Capitalize first letter
          parts.push(`${formattedKey}:${value}` + (img.imageunit ? ` ${img.imageunit}` : ""));
        }
      }

      if (parts.length > 0) {
        formattedProductSize = parts.join(" | ");
      }
    }

    enquiryDetails = {
      ...enquiryDetails,
      designer_code: img.designer_person,
      product_size: formattedProductSize
    }

    if (needsWatermark && !watermarkedUrl) {
      try {
        console.log(`Creating fresh watermark for image: ${img._id}`);

        // Add watermark to the original image
        const watermarkedBuffer = await addWatermarkToImage(
          img.url,
          logoUrl,
          copyrightText,
          enquiryDetails
        );

        // Generate unique filename
        const urlParts = img.url.split('/');
        const originalFilename = urlParts[urlParts.length - 1];
        const fileExtension = originalFilename.split('.').pop();
        const timestamp = Date.now();
        const watermarkedFilename = `watermarked_${timestamp}.${fileExtension}`;

        // Construct R2 path dynamically from the original image URL so it is stored permanently
        let watermarkedPath = `temp`;
        try {
          const urlObj = new URL(img.url);
          const decodedPath = decodeURIComponent(urlObj.pathname);
          const pathParts = decodedPath.split('/');
          pathParts.pop(); // remove filename
          watermarkedPath = pathParts.filter(Boolean).join('/');
        } catch (e) {
          console.error("Error parsing original image url path:", e);
        }

        // Upload watermarked image to R2
        // Based on your code pattern: uploadToR2(path, buffer, filename, mimetype)
        watermarkedUrl = await uploadToR2(
          watermarkedPath,
          watermarkedBuffer,
          watermarkedFilename,
          `image/${fileExtension}`
        );

        // Update database
        await enquiryModel.updateOne(
          { id: enquiry.id, "images._id": img._id },
          {
            $set: {
              "images.$.watermark_image_url": watermarkedUrl
            }
          }
        );

        console.log(`Watermarked image created and saved: ${watermarkedUrl}`);

        // Generate signed URL for watermarked image
        signedUrl = generateSignedUrl(watermarkedUrl, expiresInSeconds);

      } catch (watermarkError) {
        console.error(
          `Failed to create watermark for image ${img._id}:`,
          watermarkError.message
        );

        // Fallback to original image
        try {
          signedUrl = generateSignedUrl(img.url, expiresInSeconds);
        } catch (err) {
          console.error("Error generating signed URL for original image:", err);
        }
      }
    } else {
      // No watermark needed
      try {
        signedUrl = needsWatermark ? generateSignedUrl(watermarkedUrl, expiresInSeconds) : generateSignedUrl(img.url, expiresInSeconds);
      } catch (err) {
        console.error("Error generating signed URL for image:", img.url, err);
      }
    }
  }

  return signedUrl
}

// export const getEnquiryDetailForImposedImage = async (enquiry) => {
//   const LOGO_URL = process.env.LOGO_IMG_URL;

//   const needsWatermark = enquiry.show_logo || enquiry.show_content;
//   const logoUrl = enquiry.show_logo ? LOGO_URL : null;
//   const copyrightText = enquiry.show_content ? enquiry.copyright_content : null;

//   // Extract designer ID/code from designer_person array
//   let designerName = null;
//   if (enquiry.designer_person && enquiry.designer_person.length > 0) {
//     const designer = enquiry.designer_person[0].user;
//     if (designer) {
//       // Try to get designer_id or employee_id or _id as fallback
//       const users = await userModel.find({ _id: { $in: designer } });
//       designerName = users[0].username || null;
//     }
//   }

//   // Format product size from array
//   let formattedProductSize = null;
//   if (enquiry.product_size && enquiry.product_size.length > 0) {
//     const size = enquiry.product_size[0];
//     const parts = [];

//     for (const key in size) {
//       const value = size[key];
//       if (value) {
//         const formattedKey = key.charAt(0).toUpperCase(); // Capitalize first letter
//         parts.push(`${formattedKey}:${value}` + (enquiry.unit ? ` ${enquiry.unit}` : ""));
//       }
//     }

//     if (parts.length > 0) {
//       formattedProductSize = parts.join(" | ");
//     }
//   }

//   // Prepare enquiry details for watermark
//   const enquiryDetails = {
//     job_no: enquiry.job_no,
//     category: enquiry.category,
//     subcategory: enquiry.subcategory,
//     product_size: formattedProductSize,
//     designer_code: designerName
//   };

//   return {
//     needsWatermark,
//     logoUrl,
//     copyrightText,
//     enquiryDetails
//   }
// }

// export const getSignedImageUrl = async ({
//   img,
//   enquiry,
//   expiresInSeconds,
//   needsWatermark,
//   logoUrl,
//   copyrightText,
//   enquiryDetails }) => {

//   console.log("export image", img)

//   let signedUrl = img.url;
//   let watermarkedUrl = img.watermark_image_url || null;
//   if (img.url) {
//     console.log(`Creating signed image: ${img._id}`);

//     if (needsWatermark && !watermarkedUrl) {
//       try {
//         console.log(`Creating fresh watermark for image: ${img._id}`);

//         // Add watermark to the original image
//         const watermarkedBuffer = await addWatermarkToImage(
//           img.url,
//           logoUrl,
//           copyrightText,
//           enquiryDetails
//         );

//         // Generate unique filename
//         const urlParts = img.url.split('/');
//         const originalFilename = urlParts[urlParts.length - 1];
//         const fileExtension = originalFilename.split('.').pop();
//         const timestamp = Date.now();
//         const watermarkedFilename = `watermarked_${timestamp}.${fileExtension}`;

//         // Construct R2 path
//         const watermarkedPath = `/temp`;

//         // Upload watermarked image to R2
//         // Based on your code pattern: uploadToR2(path, buffer, filename, mimetype)
//         watermarkedUrl = await uploadToR2(
//           watermarkedPath,
//           watermarkedBuffer,
//           watermarkedFilename,
//           `image/${fileExtension}`
//         );

//         // Update database
//         await enquiryModel.updateOne(
//           { id: enquiry.id, "images._id": img._id },
//           {
//             $set: {
//               "images.$.watermark_image_url": watermarkedUrl
//             }
//           }
//         );

//         console.log(`Watermarked image created and saved: ${watermarkedUrl}`);

//         // Generate signed URL for watermarked image
//         signedUrl = generateSignedUrl(watermarkedUrl, expiresInSeconds);

//       } catch (watermarkError) {
//         console.error(
//           `Failed to create watermark for image ${img._id}:`,
//           watermarkError.message
//         );

//         // Fallback to original image
//         try {
//           signedUrl = generateSignedUrl(img.url, expiresInSeconds);
//         } catch (err) {
//           console.error("Error generating signed URL for original image:", err);
//         }
//       }
//     } else {
//       // No watermark needed
//       try {
//         signedUrl = needsWatermark ? generateSignedUrl(watermarkedUrl, expiresInSeconds) : generateSignedUrl(img.url, expiresInSeconds);
//       } catch (err) {
//         console.error("Error generating signed URL for image:", img.url, err);
//       }
//     }
//   }

//   return signedUrl
// }

/**
 * Get enquiry by ID for client with watermarked images
 * This API endpoint fetches enquiry details and returns images with watermarks
 * based on show_logo and show_content flags
 */


export const getEnquiryByIdforclient = async (req, res) => {
  try {
    const { id } = req.params;
    const salesorderid = req.query.salesid;

    // Bridge lookup via shopFloorJobModel using enquiry_id, sales_order_id, job_no, or sub_job_no
    let sfJob = null;
    try {
      if (mongoose.Types.ObjectId.isValid(id)) {
        sfJob = await shopFloorJobModel.findOne({ $or: [{ enquiry_id: id }, { sales_order_id: id }, { _id: id }] });
      }
      if (!sfJob && salesorderid && mongoose.Types.ObjectId.isValid(salesorderid)) {
        sfJob = await shopFloorJobModel.findOne({ $or: [{ sales_order_id: salesorderid }, { enquiry_id: salesorderid }] });
      }
      if (!sfJob) {
        sfJob = await shopFloorJobModel.findOne({ $or: [{ job_no: id }, { sub_job_no: id }] });
      }
    } catch (sfErr) {
      console.error("shopFloorJobModel lookup error in getEnquiryByIdforclient:", sfErr);
    }

    let enquiry = null;

    if (sfJob && sfJob.enquiry_id) {
      enquiry = await enquiryModel
        .findById(sfJob.enquiry_id)
        .populate("cordinator", "name")
        .populate("marketing_cordinator", "name")
        .populate("created_by", "name")
        .populate("updated_by.user", "name");
    }

    if (!enquiry) {
      enquiry = await enquiryModel
        .findOne({ id })
        .populate("cordinator", "name")
        .populate("marketing_cordinator", "name")
        .populate("created_by", "name")
        .populate("updated_by.user", "name");
    }

    if (!enquiry && mongoose.Types.ObjectId.isValid(id)) {
      enquiry = await enquiryModel
        .findById(id)
        .populate("cordinator", "name")
        .populate("marketing_cordinator", "name")
        .populate("created_by", "name")
        .populate("updated_by.user", "name");
    }

    if (!enquiry) {
      enquiry = await enquiryModel
        .findOne({ job_no: id })
        .populate("cordinator", "name")
        .populate("marketing_cordinator", "name")
        .populate("created_by", "name")
        .populate("updated_by.user", "name");
    }

    if (!enquiry) {
      return res.status(404).json({ success: false, message: "Enquiry not found" });
    }

    const expiresInSeconds = (enquiry.links_duration || 0) * 60 * 60;

    let needsWatermark = false, logoUrl = "", copyrightText = "", enquiryDetails = {};
    try {
      const detail = await getEnquiryDetailForImposedImage(enquiry);
      needsWatermark = detail.needsWatermark;
      logoUrl = detail.logoUrl;
      copyrightText = detail.copyrightText;
      enquiryDetails = detail.enquiryDetails;
    } catch (e) {
      console.error("getEnquiryDetailForImposedImage error:", e);
    }

    const signedImages = await Promise.all(
      (enquiry.images || []).map(async (img) => {
        let signedUrl = img.url || "";
        try {
          signedUrl = await getSignedImageUrl({
            img,
            enquiry,
            expiresInSeconds,
            needsWatermark,
            logoUrl,
            copyrightText,
            enquiryDetails
          });
        } catch (e) {
          console.error("getSignedImageUrl error for image:", e);
        }

        return {
          _id: img._id,
          url: signedUrl,
          imageunit: img.imageunit || "",
          image_product_size: img.image_product_size,
          starttime: img.starttime,
          endtime: img.endtime,
          designer_person: img.designer_person,
          pause_time: img.pause_time,
          pause_notes: img.pause_notes,
          resume_time: img.resume_time,
          is_accepted: img.is_accepted,
          feedback: img.feedback,
          accepted_date_time: img.accepted_date_time,
          watermark_image_url: img.watermark_image_url,
          image_to_sample: img.image_to_sample,
          image_to_production: img.image_to_production,
          image_rework: img.image_rework,
          additional_files: img.additional_files,
        };
      })
    );

    let quotation_files = [];
    let PI_files = [];
    let master_template_files = [];
    let content_proofing_files = [];
    let is_bom_rework;
    let is_pi_rework;
    let is_bom_verified, is_pi_verified;
    let dtpId = null;

    let is_qty_pending_approval = false;
    let reprocessed_quotation_file = null;
    let is_reprocessed_client_approved = false;
    let bom_id = null;


    let bom_action_by_type, bom_action_by_name, bom_action_by_role, bom_approved_date_time, bom_rejected_date_time;
    let pi_action_by_type, pi_action_by_name, pi_action_by_role, pi_approved_date_time, pi_rejected_date_time;
    let bom_history = [];
    let pi_history = [];

    const effectiveSalesId = salesorderid || (sfJob?.sales_order_id ? sfJob.sales_order_id.toString() : null);

    let salesOrder = null;
    if (sfJob?.sales_order_id) {
      salesOrder = await salesorderlistModel.findById(sfJob.sales_order_id);
    }
    if (!salesOrder && effectiveSalesId) {
      salesOrder = await salesorderlistModel.findOne({ id: effectiveSalesId });
    }
    if (!salesOrder && effectiveSalesId && mongoose.Types.ObjectId.isValid(effectiveSalesId)) {
      salesOrder = await salesorderlistModel.findById(effectiveSalesId);
    }
    if (!salesOrder && enquiry) {
      salesOrder = await salesorderlistModel.findOne({ enquiry_id: enquiry._id });
    }

    if (salesOrder) {
      // 1. Quatation & PI Files with try/catch safety (from HEAD)
      if (salesOrder?.quatation_files?.length) {
        quotation_files = await Promise.all(
          salesOrder.quatation_files.map(async (file) => {
            try { return await generateSignedUrl(file); } catch { return file; }
          })
        );
      }

      if (salesOrder?.Pi_files?.length) {
        PI_files = await Promise.all(
          salesOrder.Pi_files.map(async (file) => {
            try { return await generateSignedUrl(file); } catch { return file; }
          })
        );
      }

      // 2. Status flags (Common)
      is_bom_rework = salesOrder?.is_bom_rework;
      is_pi_rework = salesOrder?.is_pi_rework;
      is_bom_verified = salesOrder?.is_bom_verified;
      is_pi_verified = salesOrder?.is_pi_verified;

      // 3. BOM History details (from dev_main)
      bom_history = salesOrder?.bom_history || [];
      const latestBom = bom_history.length > 0 ? bom_history[bom_history.length - 1] : null;
      bom_action_by_type = latestBom?.action_by_type || salesOrder?.bom_action_by_type;
      bom_action_by_name = latestBom?.action_by_name || salesOrder?.bom_action_by_name;
      bom_action_by_role = latestBom?.action_by_role || salesOrder?.bom_action_by_role;
      bom_approved_date_time = latestBom?.action === "Approved" ? latestBom.date_time : salesOrder?.bom_approved_date_time;
      bom_rejected_date_time = (latestBom?.action === "Rejected" || latestBom?.action === "Rework") ? latestBom.date_time : salesOrder?.bom_rejected_date_time;

      // 4. PI History details (from dev_main)
      pi_history = salesOrder?.pi_history || [];
      const latestPi = pi_history.length > 0 ? pi_history[pi_history.length - 1] : null;
      pi_action_by_type = latestPi?.action_by_type || salesOrder?.pi_action_by_type;
      pi_action_by_name = latestPi?.action_by_name || salesOrder?.pi_action_by_name;
      pi_action_by_role = latestPi?.action_by_role || salesOrder?.pi_action_by_role;
      pi_approved_date_time = latestPi?.action === "Approved" ? latestPi.date_time : salesOrder?.pi_approved_date_time;
      pi_rejected_date_time = (latestPi?.action === "Rejected" || latestPi?.action === "Rework") ? latestPi.date_time : salesOrder?.pi_rejected_date_time;

      // 5. Quantity approval & Reprocessed BOM PDF with $or query (Combined from HEAD & dev_main)
      is_qty_pending_approval = ((salesOrder.is_pushed_shop_floor === true || salesOrder.is_pushed_shop_floor === 'true') && salesOrder.is_qty_pending_approval) || false;
      
      const bomQuery = salesOrder.id
        ? { $or: [{ sales_order_nanoid: salesOrder.id }, { sales_order_id: salesOrder._id }] }
        : { sales_order_id: salesOrder._id };

      const bomObj = await bomModel.findOne(bomQuery);
      if (bomObj && bomObj.qty_update && (bomObj.qty_update.status === "pending" || bomObj.qty_update.status === "approved")) {
        bom_id = bomObj.id || bomObj._id;
        if (bomObj.qty_update.recalculated_data && bomObj.qty_update.recalculated_data.quotation_pdf) {
          try {
            reprocessed_quotation_file = await generateSignedUrl(bomObj.qty_update.recalculated_data.quotation_pdf);
          } catch {
            reprocessed_quotation_file = bomObj.qty_update.recalculated_data.quotation_pdf;
          }
        }
        is_reprocessed_client_approved = bomObj.qty_update.is_client_approved || false;
      }

      // 6. DTP Master Template & Content Proofing Files
      const dtpJob = await dtpStudioModel.findOne({ sample_order_id: salesOrder._id });
      if (dtpJob) {
        dtpId = dtpJob._id;
        if (dtpJob.master_template_files?.length) {
          master_template_files = await Promise.all(
            dtpJob.master_template_files.map(async (fileObj) => {
              const rawUrl = typeof fileObj === 'string' ? fileObj : (fileObj?.file_url || fileObj?.url || '');
              let signed = rawUrl;
              try { signed = await generateSignedUrl(rawUrl); } catch (e) { void e; }
              const baseObj = (typeof fileObj === 'object' && fileObj !== null && typeof fileObj.toObject === 'function') ? fileObj.toObject() : (typeof fileObj === 'object' ? fileObj : { file_url: rawUrl });
              return { ...baseObj, file_url: signed };
            })
          );
        }

        if (dtpJob.content_proofing_files?.length) {
          content_proofing_files = await Promise.all(
            dtpJob.content_proofing_files.map(async (fileObj) => {
              const rawUrl = typeof fileObj === 'string' ? fileObj : (fileObj?.file_url || fileObj?.url || '');
              let signed = rawUrl;
              try { signed = await generateSignedUrl(rawUrl); } catch (e) { void e; }
              const baseObj = (typeof fileObj === 'object' && fileObj !== null && typeof fileObj.toObject === 'function') ? fileObj.toObject() : (typeof fileObj === 'object' ? fileObj : { file_url: rawUrl });
              return { ...baseObj, file_url: signed };
            })
          );
        }
      }
    }

    // const effectiveSalesId = salesorderid || (sfJob?.sales_order_id ? sfJob.sales_order_id.toString() : null);
    // if (effectiveSalesId || sfJob?.sales_order_id) {
    //   try {
    //     let salesOrder = null;
    //     if (sfJob?.sales_order_id) {
    //       salesOrder = await salesorderlistModel.findById(sfJob.sales_order_id);
    //     }
    //     if (!salesOrder && effectiveSalesId) {
    //       salesOrder = await salesorderlistModel.findOne({ id: effectiveSalesId });
    //     }
    //     if (!salesOrder && effectiveSalesId && mongoose.Types.ObjectId.isValid(effectiveSalesId)) {
    //       salesOrder = await salesorderlistModel.findById(effectiveSalesId);
    //     }
    //     if (!salesOrder && enquiry) {
    //       salesOrder = await salesorderlistModel.findOne({ enquiry_id: enquiry._id });
    // let bom_action_by_type, bom_action_by_name, bom_action_by_role, bom_approved_date_time, bom_rejected_date_time;
    // let pi_action_by_type, pi_action_by_name, pi_action_by_role, pi_approved_date_time, pi_rejected_date_time;
    // let bom_history = [];
    // let pi_history = [];

    // const salesorderid = req.query.salesid;
    // if (salesorderid) {
    //   const salesOrder = await salesorderlistModel.findOne({ id: salesorderid });

    //   if (salesOrder?.quatation_files?.length) {
    //     quotation_files = await Promise.all(
    //       salesOrder.quatation_files.map((file) => generateSignedUrl(file))
    //     );
    //   }

    //   if (salesOrder?.Pi_files?.length) {
    //     PI_files = await Promise.all(
    //       salesOrder.Pi_files.map((file) => generateSignedUrl(file))
    //     );
    //   }

    //   is_bom_rework = salesOrder?.is_bom_rework;
    //   is_pi_rework = salesOrder?.is_pi_rework;
    //   is_bom_verified = salesOrder?.is_bom_verified;
    //   is_pi_verified = salesOrder?.is_pi_verified;

    //   bom_history = salesOrder?.bom_history || [];
    //   const latestBom = bom_history.length > 0 ? bom_history[bom_history.length - 1] : null;
    //   bom_action_by_type = latestBom?.action_by_type || salesOrder?.bom_action_by_type;
    //   bom_action_by_name = latestBom?.action_by_name || salesOrder?.bom_action_by_name;
    //   bom_action_by_role = latestBom?.action_by_role || salesOrder?.bom_action_by_role;
    //   bom_approved_date_time = latestBom?.action === "Approved" ? latestBom.date_time : salesOrder?.bom_approved_date_time;
    //   bom_rejected_date_time = (latestBom?.action === "Rejected" || latestBom?.action === "Rework") ? latestBom.date_time : salesOrder?.bom_rejected_date_time;

    //   pi_history = salesOrder?.pi_history || [];
    //   const latestPi = pi_history.length > 0 ? pi_history[pi_history.length - 1] : null;
    //   pi_action_by_type = latestPi?.action_by_type || salesOrder?.pi_action_by_type;
    //   pi_action_by_name = latestPi?.action_by_name || salesOrder?.pi_action_by_name;
    //   pi_action_by_role = latestPi?.action_by_role || salesOrder?.pi_action_by_role;
    //   pi_approved_date_time = latestPi?.action === "Approved" ? latestPi.date_time : salesOrder?.pi_approved_date_time;
    //   pi_rejected_date_time = (latestPi?.action === "Rejected" || latestPi?.action === "Rework") ? latestPi.date_time : salesOrder?.pi_rejected_date_time;

    //   if (salesOrder) {
    //     is_qty_pending_approval = ((salesOrder.is_pushed_shop_floor === true || salesOrder.is_pushed_shop_floor === 'true') && salesOrder.is_qty_pending_approval) || false;
    //     const bomObj = await bomModel.findOne({ sales_order_nanoid: salesOrder.id });
    //     if (bomObj && bomObj.qty_update && (bomObj.qty_update.status === "pending" || bomObj.qty_update.status === "approved")) {
    //       bom_id = bomObj.id;
    //       if (bomObj.qty_update.recalculated_data && bomObj.qty_update.recalculated_data.quotation_pdf) {
    //         reprocessed_quotation_file = await generateSignedUrl(bomObj.qty_update.recalculated_data.quotation_pdf);
    //       }
    //       is_reprocessed_client_approved = bomObj.qty_update.is_client_approved || false;
    //     }

    //     if (salesOrder?.quatation_files?.length) {
    //       quotation_files = await Promise.all(
    //         salesOrder.quatation_files.map(async (file) => {
    //           try { return await generateSignedUrl(file); } catch { return file; }
    //         })
    //       );
    //     }

    //     if (salesOrder?.Pi_files?.length) {
    //       PI_files = await Promise.all(
    //         salesOrder.Pi_files.map(async (file) => {
    //           try { return await generateSignedUrl(file); } catch { return file; }
    //         })
    //       );
    //     }

    //     is_bom_rework = salesOrder?.is_bom_rework;
    //     is_pi_rework = salesOrder?.is_pi_rework;
    //     is_bom_verified = salesOrder?.is_bom_verified;
    //     is_pi_verified = salesOrder?.is_pi_verified;

    //     if (salesOrder) {
    //       is_qty_pending_approval = ((salesOrder.is_pushed_shop_floor === true || salesOrder.is_pushed_shop_floor === 'true') && salesOrder.is_qty_pending_approval) || false;
    //       const bomQuery = salesOrder.id
    //         ? { $or: [{ sales_order_nanoid: salesOrder.id }, { sales_order_id: salesOrder._id }] }
    //         : { sales_order_id: salesOrder._id };
    //       const bomObj = await bomModel.findOne(bomQuery);
    //       if (bomObj && bomObj.qty_update && (bomObj.qty_update.status === "pending" || bomObj.qty_update.status === "approved")) {
    //         bom_id = bomObj.id || bomObj._id;
    //         if (bomObj.qty_update.recalculated_data && bomObj.qty_update.recalculated_data.quotation_pdf) {
    //           try {
    //             reprocessed_quotation_file = await generateSignedUrl(bomObj.qty_update.recalculated_data.quotation_pdf);
    //           } catch {
    //             reprocessed_quotation_file = bomObj.qty_update.recalculated_data.quotation_pdf;
    //           }
    //         }
    //         is_reprocessed_client_approved = bomObj.qty_update.is_client_approved || false;
    //       }
    //     }

    //     // Fetch DTP files associated with this sales order
    //     if (salesOrder) {
    //       const dtpJob = await dtpStudioModel.findOne({ sample_order_id: salesOrder._id });
    //       if (dtpJob) {
    //         dtpId = dtpJob._id;
    //         if (dtpJob.master_template_files?.length) {
    //           master_template_files = await Promise.all(
    //             dtpJob.master_template_files.map(async (fileObj) => {
    //               const rawUrl = typeof fileObj === 'string' ? fileObj : (fileObj?.file_url || fileObj?.url || '');
    //               let signed = rawUrl;
    //               try { signed = await generateSignedUrl(rawUrl); } catch (e) { void e; }
    //               const baseObj = (typeof fileObj === 'object' && fileObj !== null && typeof fileObj.toObject === 'function') ? fileObj.toObject() : (typeof fileObj === 'object' ? fileObj : { file_url: rawUrl });
    //               return { ...baseObj, file_url: signed };
    //             })
    //           );
    //         }

    //         if (dtpJob.content_proofing_files?.length) {
    //           content_proofing_files = await Promise.all(
    //             dtpJob.content_proofing_files.map(async (fileObj) => {
    //               const rawUrl = typeof fileObj === 'string' ? fileObj : (fileObj?.file_url || fileObj?.url || '');
    //               let signed = rawUrl;
    //               try { signed = await generateSignedUrl(rawUrl); } catch (e) { void e; }
    //               const baseObj = (typeof fileObj === 'object' && fileObj !== null && typeof fileObj.toObject === 'function') ? fileObj.toObject() : (typeof fileObj === 'object' ? fileObj : { file_url: rawUrl });
    //               return { ...baseObj, file_url: signed };
    //             })
    //           );
    //         }
    //       }
    //     }
    //   } catch (soErr) {
    //     console.error("Error processing sales order details for client access:", soErr);
    //   }
    // }
    const filteredResponse = {
      name: enquiry.name,
      id: enquiry.id,
      product_name: enquiry.product_name,
      job_no: enquiry.job_no,
      reference_no: enquiry.reference_no,
      images: signedImages,
      to_production: enquiry.to_production,
      to_sample: enquiry.to_sample,
      is_client_design: enquiry.is_client_design,
      quotation_files,
      PI_files,
      master_template_files,
      content_proofing_files,
      is_bom_rework,
      is_pi_rework,
      is_bom_verified,
      is_pi_verified,
      bom_action_by_type,
      bom_action_by_name,
      bom_action_by_role,
      bom_approved_date_time,
      bom_rejected_date_time,
      bom_history,
      pi_action_by_type,
      pi_action_by_name,
      pi_action_by_role,
      pi_approved_date_time,
      pi_rejected_date_time,
      pi_history,
      dtp_id: dtpId,
      is_qty_pending_approval,
      reprocessed_quotation_file,
      is_reprocessed_client_approved,
      bom_id
    };

    res.status(200).json({ success: true, data: filteredResponse });

  } catch (error) {
    console.error("Error fetching enquiry:", error);
    res.status(500).json({
      success: false,
      message: error?.message ? `Server error: ${error.message}` : "Server error",
      error: error.message
    });
  }
};


export const sendEnquiryWhatsAppShare = async (req, res) => {
  try {
    const { phone_number, values } = req.body;

    if (!phone_number || !values) {
      return res.status(400).json({ success: false, message: "phone_number and values are required" });
    }

    let formattedPhone = String(phone_number).replace(/\D/g, ""); 
    if (formattedPhone.length === 10) {
      formattedPhone = `91${formattedPhone}`;
    }

    const url = process.env.TWOFACTOR_WHATSAPP_PRODUCT_CONFIRAMTION_URL;
    const apiKey = process.env.TWOFACTOR_WHATSAPP_API_KEY;

    const payload = {
      receiver: formattedPhone,
      values: values
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    let data;
    try {
      data = await response.json();
    } catch {
      const text = await response.text();
      data = { message: text };
    }

    if (response.ok) {
      return res.status(200).json({
        success: true,
        message: "Message accepted by WhatsApp",
        data: data,
      });
    } else {
      return res.status(response.status || 400).json({
        success: false,
        message: "Failed to send WhatsApp message",
        error: data,
      });
    }
  } catch (error) {
    console.error("Error sending WhatsApp message:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
};

export const getUniqueClients = async (req, res) => {
  try {
    // 1. Fetch active customer names directly from Customer Master
    const customerClients = await customerModel.distinct("name", {
      is_active: { $ne: false },
    });

    // 2. Also fetch distinct client names from Enquiry collection
    const enquiryClients = await enquiryModel.distinct("name", {
      is_active: { $ne: false },
    });

    // 3. Combine unique customer names, strip whitespace, and sort alphabetically
    const combined = Array.from(
      new Set(
        [...customerClients, ...enquiryClients]
          .map((n) => (typeof n === "string" ? n.trim() : ""))
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

    res.status(200).json({ success: true, data: combined });
  } catch (error) {
    console.error("Error fetching unique clients:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const getUniqueProducts = async (req, res) => {
  try {
    const role = req.user?.role?.toLowerCase() || "";
    const person_id = req.user?._id;
    const filter = { is_active: true };

    if (role.includes("client servicing executive")) {
      filter.created_by = person_id;
    }

    const products = await enquiryModel.distinct("product_name", filter);
    const filteredProducts = products.filter(Boolean).sort();
    res.status(200).json({ success: true, data: filteredProducts });
  } catch (error) {
    console.error("Error fetching unique products:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const getEnquiryCountsByUser = async (req, res) => {
  try {
    const role = req.user?.role?.toLowerCase() || "";
    const person_id = req.user?._id;
    const matchQuery = { is_active: true };

    if (role.includes("client servicing executive") && person_id) {
      matchQuery.created_by = new mongoose.Types.ObjectId(person_id);
    }

    const counts = await enquiryModel.aggregate([
      { $match: matchQuery },
      { $group: { _id: "$created_by", count: { $sum: 1 } } }
    ]);
    res.status(200).json({ success: true, data: counts });
  } catch (error) {
    console.error("Error fetching enquiry counts by user:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const getEnquiryKPIStats = async (req, res) => {
  try {
    const client = req.query.client?.trim();

    const role = req.user?.role?.toLowerCase() || "";
    const person_id = req.user?._id;

    const activeQuery = { 
      is_active: true, 
      is_cancelled: { $nin: [true, "true"] }, 
      status: { $nin: ["abandon", "on_hold"] },
      is_on_hold: { $nin: [true, "true"] }
    };
    if (client) {
      activeQuery.name = client;
    }
    if (role.includes("client servicing executive")) {
      activeQuery.created_by = person_id;
    }
    
    // 1. Total Active: skip hold and abandon
    const totalActive = await enquiryModel.countDocuments(activeQuery);
    
    // 2. Enquiry stage: design approved and ready to create sales order form
    const enquiryStage = await enquiryModel.countDocuments({ 
      ...activeQuery, 
      is_completed: true, 
      to_sample: { $ne: true }, 
      to_production: { $ne: true } 
    });

    // For sales order stages, construct sales order query:
    const soQuery = {
      is_active: true,
      is_cancelled: { $nin: [true, "true"] },
      is_on_hold: { $nin: [true, "true"] },
      status: { $nin: ["abandon", "on_hold", "hold", "cancelled"] },
      is_client_design: { $ne: true }
    };
    if (role.includes("client servicing executive")) {
      const executiveEnquiries = await enquiryModel.find({
        $or: [
          { created_by: person_id },
          { cordinator: person_id }
        ]
      }).select("_id").lean();
      const enquiryIds = executiveEnquiries.map(e => e._id);
      if (client) {
        const clientEnquiries = await enquiryModel.find({ name: client, _id: { $in: enquiryIds } }).select("_id").lean();
        soQuery.enquiry_id = { $in: clientEnquiries.map(e => e._id) };
      } else {
        soQuery.enquiry_id = { $in: enquiryIds };
      }
    } else if (client) {
      const clientEnquiries = await enquiryModel.find({ name: client }).select("_id").lean();
      const clientEnquiryIds = clientEnquiries.map(e => e._id);
      soQuery.enquiry_id = { $in: clientEnquiryIds };
    }
    
    // 3. Design & Costing: once approved design's sales order form is complete, in stage of BOM/costing
    const designCosting = await salesorderlistModel.countDocuments({
      ...soQuery,
      is_verified_to_proceed: false,
      is_bom_verified: false
    });
    
    // 4. Awaiting Client / Finance: BOM completed but not verified to proceed (PI/Quotation/Finance checking stage)
    const awaitingClient = await salesorderlistModel.countDocuments({
      ...soQuery,
      is_verified_to_proceed: false,
      is_bom_verified: true
    });
    
    // 5. In Production
    const dispatchedPacks = await CtPack.find({
      $or: [
        { status: { $in: ['Packed', 'Complete'] } },
        { stage: { $in: ['dispatch', 'dispatched', 'completed'] } },
        { dispatchDt: { $exists: true, $ne: "" } }
      ]
    }).distinct('sub_job_no');

    const inProduction = await salesorderlistModel.countDocuments({
      ...soQuery,
      is_verified_to_proceed: true,
      sub_job_no: { $nin: dispatchedPacks }
    });
    
    // 6. Ready / Dispatched
    const readyDispatched = await salesorderlistModel.countDocuments({
      ...soQuery,
      is_verified_to_proceed: true,
      sub_job_no: { $in: dispatchedPacks }
    });
    
    res.status(200).json({
      success: true,
      data: {
        totalActive,
        enquiryStage,
        designCosting,
        awaitingClient,
        inProduction,
        readyDispatched
      }
    });
  } catch (error) {
    console.error("Error fetching enquiry KPI stats:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};



