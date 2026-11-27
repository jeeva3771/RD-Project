import React, { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import JobDetails from "./JobDetails";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { fetchSamplesalesOrderById, updateSampleSalesOrder, fetchSampleSalesOrderCounts } from "../../../reducer/sampleSalesorderReducer";
import MaterialSelect from "./MaterialSelect";
import Specification from "./Specification";
import MaterialGroup from "./MaterialGroup";
import MaterialGroupWithProcesses from "./materialProcess";
import PackingStep from "./PackingStepper";
import CostingDetails from "./CostingDetails";
import jobSheet from "./JobSheet";
import QuotationStep from "./QuotationStep";
import { createBOM, fetchBOMById, saveBOMDraft, updateBOM } from "../../../reducer/bomReducer";
import ImageLightbox from "../../common/ImageLightbox";
import { axiosInstance } from "../../../utils/url/config";

const steps = [
  "Job ",
  "Mat",
  "Spec",
  "Grp",
  "Proc",
  "Pak",
  "cost",
  "Job",
  "quote"
];

const stepComponents = [
  JobDetails,
  MaterialSelect,
  Specification,
  MaterialGroup,
  MaterialGroupWithProcesses,
  PackingStep,
  CostingDetails,
  jobSheet,
  QuotationStep,
];

export default function StepperForm() {
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({});
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  const CurrentStep = stepComponents[activeStep];

  const dispatch = useDispatch();
  const { sampleOrderid } = useParams();
  const { bomid } = useParams();

  const { sotype } = useParams();


  const location = useLocation();

  const isViewMode = location.pathname.toLowerCase().includes(
    "/quotation/view"
  );

  const { singleSamplesalesOrder, loadingSingle } = useSelector(
    (state) => state.sampleSalesOrders
  );

  const { selectedBOM, loading } = useSelector(
    (state) => state.bom
  );

  const effectiveBomId =
    bomid ||
    singleSamplesalesOrder?.bom_id ||
    singleSamplesalesOrder?.bom_nanoid ||
    selectedBOM?.id ||
    selectedBOM?._id ||
    null;

  useEffect(() => {
    if (sampleOrderid) {
      dispatch(fetchSamplesalesOrderById(sampleOrderid));
    }
  }, [sampleOrderid, dispatch]);

  // Direct EnquiryFlow integration fetch for exact sub-job specifications & uploaded artwork files
  useEffect(() => {
    if (!sampleOrderid) return;
    axiosInstance
      .get(`/enquiry-flow-integration/${sampleOrderid}`)
      .then((res) => {
        if (res.data?.success && res.data?.data) {
          const job = res.data.data;
          const cleanSub = String(sampleOrderid).trim();
          const subJob =
            (job.sub_jobs || []).find((s) => s.sub_job_no === cleanSub) ||
            job.sub_jobs?.[0] ||
            {};
          const theAsk = job.the_ask || job.wizard_state?.the_ask || {};

          const resolvedMaterial =
            subJob.material ||
            (Array.isArray(theAsk.materials)
              ? theAsk.materials.join(", ")
              : theAsk.material) ||
            "";
          const resolvedSize =
            subJob.size ||
            (Array.isArray(theAsk.sizes)
              ? theAsk.sizes.join(", ")
              : theAsk.size) ||
            "";
          const resolvedSpecs =
            subJob.spec_line || subJob.specs || theAsk.specs || "";
          const resolvedSpecLine = subJob.spec_line || resolvedSpecs || "";
          const resolvedSpec = subJob.spec || {};
          const resolvedFiles = [
            ...(Array.isArray(subJob.dtp_files)
              ? subJob.dtp_files.map((f) => f?.file_url || f)
              : []),
            ...(Array.isArray(subJob.designer_files)
              ? subJob.designer_files.map((f) => f?.file_url || f)
              : []),
          ].filter(Boolean);

          setFormData((prev) => ({
            ...prev,
            material: resolvedMaterial || prev.material,
            size: resolvedSize || prev.size,
            specs: resolvedSpecs || prev.specs,
            spec_line: resolvedSpecLine || prev.spec_line,
            spec: Object.keys(resolvedSpec).length > 0 ? resolvedSpec : prev.spec,
            theme: subJob.theme || theAsk.theme || prev.theme,
            trophy_type: subJob.trophy_type || subJob.kind || prev.trophy_type || "custom",
            jobQty: subJob.quantity || theAsk.quantity || prev.jobQty || 1,
            designer_files: resolvedFiles.length > 0 ? resolvedFiles : prev.designer_files,
          }));
        }
      })
      .catch((err) => {
        console.warn("Could not fetch enquiry job details in StepperForm:", err?.message || err);
      });
  }, [sampleOrderid]);


  useEffect(() => {
    const idToFetch = bomid || singleSamplesalesOrder?.bom_id || singleSamplesalesOrder?.bom_nanoid || sampleOrderid;
    if (idToFetch) {
      dispatch(fetchBOMById(idToFetch));
    }
  }, [bomid, singleSamplesalesOrder?.bom_id, singleSamplesalesOrder?.bom_nanoid, sampleOrderid, dispatch]);

  console.log("selectedBOM", selectedBOM);

  useEffect(() => {
    if (!selectedBOM) return;

    setFormData((prev) => ({
      ...prev,

      // Job
      jobQty: selectedBOM.job_quantity || prev.jobQty,
      originalJobQty: selectedBOM.job_quantity || prev.originalJobQty,
      subJobNo: selectedBOM.sub_job_no || prev.subJobNo,
      jobNo: selectedBOM.job_no || prev.jobNo,
      productName: selectedBOM.product_name || prev.productName,
      orgimage: selectedBOM.org_image || prev.orgimage,
      jobDescription: selectedBOM.jobDescription || prev.jobDescription,
      reference_no: selectedBOM.enquiry_id?.reference_no || prev.reference_no || "",

      // Materials
      customItems: selectedBOM.items || [],

      materialSpecification: selectedBOM.material_specification || [],

      materialGroups: selectedBOM.material_groups || [],

      materialprocess: selectedBOM.materialprocess || [],

      packingdatas: selectedBOM.packingdatas || [],

      costDetails: selectedBOM.costdetails || {},

      jobSheet: selectedBOM.jobSheet || {},

      quotation: selectedBOM.quotation || {},

      artwork_pdf: selectedBOM.artwork_pdf || "",
      artwork_cdr: selectedBOM.artwork_cdr || "",

      artwork_pdf_url: selectedBOM.artwork_pdf_url || "",
      artwork_cdr_url: selectedBOM.artwork_cdr_url || "",


      totalUnitCost: selectedBOM.quotation?.finalUnitPrice,
      totalJobCost: selectedBOM.quotation?.finalJobPrice,
    }));
  }, [selectedBOM]);

  // Restore the step the user was on when they saved the draft
  useEffect(() => {
    if (selectedBOM?.draft_step != null) {
      setActiveStep(selectedBOM.draft_step);
    }
  }, [selectedBOM]);


  useEffect(() => {
    if (!singleSamplesalesOrder) return;

    // Always read from enquiry_id if available
    const data = singleSamplesalesOrder.enquiry_id || {};

    // preload image (optional)
    if (singleSamplesalesOrder.image) {
      const img = new Image();
      img.src = singleSamplesalesOrder.image;
    }


    // NORMALIZE PRODUCT SIZE
    // [{ cms: "3" }] → { cms: "3" }
    let productSizeObj = {};

    if (Array.isArray(data.product_size)) {
      data.product_size.forEach((item) => {
        const key = Object.keys(item)[0];
        const value = item[key];
        productSizeObj[key] = value;
      });
    }

    // MARKETING COORDINATOR IDS
    const coordinatorIds = Array.isArray(data.marketing_cordinator)
      ? data.marketing_cordinator.map((c) => c._id)
      : [];

    // SET FORM DATA (single update)
    setFormData((prev) => ({
      ...prev,

      // Sub-job identifiers
      subJobNo: prev.subJobNo || singleSamplesalesOrder.sub_job_no || singleSamplesalesOrder.id || "",
      jobNo: prev.jobNo || singleSamplesalesOrder.job_no || "",
      orgimage: prev.orgimage || singleSamplesalesOrder.image || singleSamplesalesOrder.orgimage || "",
      jobDescription: prev.jobDescription || singleSamplesalesOrder.job_description || "",

      // category
      category: data.category || prev.category || "",
      subcategory: data.subcategory || prev.subcategory || "",

      emails: Array.isArray(data.email) ? data.email : prev.emails || [],

      // whatsapp
      whatsapp_numbers: Array.isArray(data.wp_number)
        ? data.wp_number.map((x) => x.toString())
        : prev.whatsapp_numbers || [],

      // product
      productName: data.product_name || prev.productName || "",
      reference_no: data.reference_no || prev.reference_no || "",

      // Product requirements & "What's the design" specs
      material: singleSamplesalesOrder.material || data.preferred_material || prev.material || "",
      size: singleSamplesalesOrder.size || (Array.isArray(data.product_size) ? data.product_size[0]?.size : "") || prev.size || "",
      specs: singleSamplesalesOrder.specs || singleSamplesalesOrder.job_description || prev.specs || "",
      spec_line: singleSamplesalesOrder.spec_line || data.spec_line || prev.spec_line || "",
      spec: singleSamplesalesOrder.spec || data.spec || prev.spec || {},
      trophy_type: singleSamplesalesOrder.trophy_type || data.category || prev.trophy_type || "custom",
      product_type: singleSamplesalesOrder.trophy_type || data.category || prev.product_type || "custom",
      theme: singleSamplesalesOrder.theme || data.subcategory || prev.theme || "",
      designer_files: singleSamplesalesOrder.designer_files || prev.designer_files || [],

      // update jobQty if sample order quantity differs from BOM
      jobQty: singleSamplesalesOrder.job_quantity || singleSamplesalesOrder.quantity || prev.jobQty,
    }));
  }, [singleSamplesalesOrder]);

  const handleNext = (stepData) => {
    setFormData({ ...formData, ...stepData });
    setActiveStep((prev) => prev + 1);
  };


  const handleBack = () => setActiveStep((prev) => prev - 1);


  const goToStep = (index) => setActiveStep(index);


  //   console.log("customItems", JSON.stringify(formData.customItems));
  //   console.log("________________________________________________________________________________")
  //       console.log("materialSpecification",JSON.stringify(formData.materialSpecification) );

  //   console.log("________________________________________________________________________________")

  //       console.log("materialGroups",  JSON.stringify(formData.materialGroups) );

  //   console.log("________________________________________________________________________________")

  //       console.log("materialprocess",  JSON.stringify(formData.materialprocess) );

  //   console.log("________________________________________________________________________________")

  //       console.log("packingdatas",  JSON.stringify(formData.packingdatas) );

  //         console.log("________________________________________________________________________________")

  //       console.log("costdetails",  JSON.stringify(formData.costDetails) );
  //       console.log("________________________________________________________________________________")

  //       console.log("jobSheet",  JSON.stringify(formData.jobSheet) );


  // console.log("totalUnitCost",formData.totalUnitCost)
  // console.log("totalJobCost",formData.totalJobCost)


  //   console.log("________________________________________________________________________________")

  //       console.log("quotation",  JSON.stringify(formData.quotation) );


  // console.log("singleSamplesalesOrder",singleSamplesalesOrder)


  // SAVE AS DRAFT — uses upsert endpoint to avoid duplicate BOM records
  const handleSaveDraft = async (currentStepData = {}) => {
    if (isViewMode) {
      toast.info("View only mode");
      return;
    }
    try {
      setIsSubmitting(true);
      const combinedData = { ...formData, ...currentStepData };
      const fd = new FormData();

      fd.append("sales_order_id",  sampleOrderid);
      if (effectiveBomId) {
        fd.append("bom_id", effectiveBomId);
      }
      fd.append("enquiry_id",      singleSamplesalesOrder?.enquiry_id?._id
                                || singleSamplesalesOrder?.enquiry_id
                                || selectedBOM?.enquiry_id?._id
                                || selectedBOM?.enquiry_id);
      fd.append("job_quantity",    combinedData.jobQty      || "");
      fd.append("sub_job_no",      combinedData.subJobNo    || singleSamplesalesOrder?.sub_job_no || selectedBOM?.sub_job_no || "");
      fd.append("product_name",    combinedData.productName || "");
      fd.append("job_no",          combinedData.jobNo       || singleSamplesalesOrder?.job_no    || selectedBOM?.job_no    || "");
      fd.append("orgimage",        combinedData.orgimage    || "");
      fd.append("jobDescription",  combinedData.jobDescription || "");
      fd.append("draft_step",      activeStep);

      if (combinedData.customItems?.length > 0)
        fd.append("items", JSON.stringify(combinedData.customItems));

      if (combinedData.materialSpecification)
        fd.append("material_specification", JSON.stringify(combinedData.materialSpecification));

      if (combinedData.materialGroups)
        fd.append("material_groups", JSON.stringify(combinedData.materialGroups));

      if (combinedData.materialprocess)
        fd.append("materialprocess", JSON.stringify(combinedData.materialprocess));

      if (combinedData.packingdatas)
        fd.append("packingdatas", JSON.stringify(combinedData.packingdatas));

      if (combinedData.costDetails)
        fd.append("costdetails", JSON.stringify(combinedData.costDetails));

      if (combinedData.jobSheet)
        fd.append("jobSheet", JSON.stringify(combinedData.jobSheet));

      if (combinedData.quotation) {
        const q = { ...combinedData.quotation };
        delete q.artwork;
        fd.append("quotation", JSON.stringify(q));
      }

      // dispatch upsert — will UPDATE existing draft or CREATE a new one (never duplicates)
      await dispatch(saveBOMDraft(fd)).unwrap();
      dispatch(fetchSampleSalesOrderCounts("quotation"));
      toast.success("BOM saved as draft!");
      navigate(-1);
    } catch (error) {
      toast.error(error?.message || "Error saving draft");
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleFinalSubmit = async (finalData) => {
    if (isViewMode) {
      toast.info("View only mode");
      return;
    }
    try {
      setIsSubmitting(true);
      const fd = new FormData();


      fd.append("sales_order_id", sampleOrderid);

      fd.append(
        "enquiry_id",
        singleSamplesalesOrder?.enquiry_id?._id ||
          singleSamplesalesOrder?.enquiry_id ||
          selectedBOM?.enquiry_id?._id ||
          selectedBOM?.enquiry_id ||
          ""
      );

      fd.append("job_quantity", formData.jobQty || singleSamplesalesOrder?.job_quantity || "");
      fd.append("sub_job_no", formData.subJobNo || singleSamplesalesOrder?.sub_job_no || selectedBOM?.sub_job_no || "");
      fd.append("product_name", formData.productName || singleSamplesalesOrder?.product_name || selectedBOM?.product_name || "");
      fd.append("job_no", formData.jobNo || singleSamplesalesOrder?.job_no || selectedBOM?.job_no || "");
      fd.append("orgimage", formData.orgimage || singleSamplesalesOrder?.orgimage || singleSamplesalesOrder?.image || "");
      fd.append("jobDescription", formData.jobDescription || singleSamplesalesOrder?.job_description || "");



      // Material DETAILS
      if (formData.customItems && formData.customItems.length > 0) {
        fd.append("items", JSON.stringify(formData.customItems));
      }

      fd.append(
        "material_specification",
        JSON.stringify(formData.materialSpecification)
      );

      fd.append(
        "material_groups",
        JSON.stringify(formData.materialGroups)
      );

      fd.append(
        "materialprocess",
        JSON.stringify(formData.materialprocess)
      );

      fd.append("packingdatas", JSON.stringify(formData.packingdatas));

      fd.append("costdetails", JSON.stringify(formData.costDetails));

      fd.append("jobSheet", JSON.stringify(formData.jobSheet));


      // Quotation data except files
      const quotationData = { ...finalData.quotation };
      delete quotationData.artwork;
      fd.append("quotation", JSON.stringify(quotationData));

      // // Now append files separately
      // if (finalData.quotation.artwork) {
      //   if (finalData.quotation.artwork.pdf) {
      //     fd.append("artwork_pdf", finalData.quotation.artwork.pdf);
      //   }
      //   if (finalData.quotation.artwork.cdr) {
      //     fd.append("artwork_cdr", finalData.quotation.artwork.cdr);
      //   }
      // }

      const artwork = finalData.quotation?.artwork || {};

      // PDF
      if (artwork.pdf instanceof File) {
        fd.append("artwork_pdf", artwork.pdf); // new upload
      } else if (artwork.existing_pdf) {
        fd.append("clone_artwork_pdf_key", formData.artwork_pdf);
      }

      // CDR
      if (artwork.cdr instanceof File) {
        fd.append("artwork_cdr", artwork.cdr);
      } else if (artwork.existing_cdr) {
        fd.append("clone_artwork_cdr_key", formData.artwork_cdr);
      }






      console.log("FormData contents:", formData);





      const targetBomId = effectiveBomId || bomid;
      if (targetBomId) {
        await dispatch(
          updateBOM({
            id: targetBomId,
            payload: fd,
          })
        ).unwrap();

        toast.success("BOM updated successfully!");
      } else {

        await dispatch(createBOM(fd)).unwrap();

        toast.success("BOM created successfully!");
      }

      dispatch(fetchSampleSalesOrderCounts("quotation"));
      navigate(-1);

    } catch (error) {
      toast.error(
        error.response?.data?.message || "Error submitting Bom"
      );
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <>
      {/* <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4 mt-12"> */}
      {/* <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4 mt-12" style ={ {backgroundColor: "#4f46e5"}}> */}
      <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4 mt-12 p-6 rounded-xl shadow-md"
        style={{ backgroundColor: "#4f46e5", color: "white" }}>

        <div className="md:w-1/4 flex justify-start">
          {(() => {
            const headerImage =
              singleSamplesalesOrder?.image ||
              singleSamplesalesOrder?.orgimage ||
              formData?.orgimage ||
              selectedBOM?.org_image ||
              selectedBOM?.image;

            return headerImage ? (
              <img
                src={headerImage}
                alt="Sample"
                className="max-w-full max-h-16 object-contain cursor-zoom-in rounded bg-white/20 p-1"
                onClick={() => setPreviewImage(headerImage)}
                onError={(e) => {
                  console.warn("Header image load error:", headerImage);
                  const fallback = singleSamplesalesOrder?.orgimage || selectedBOM?.org_image;
                  if (fallback && fallback !== headerImage && e.target.src !== fallback) {
                    e.target.src = fallback;
                  } else {
                    e.target.style.display = "none";
                  }
                }}
              />
            ) : (
              <div className="w-16 h-16 bg-white/20 rounded-lg flex items-center justify-center text-xs text-white">
                No Image
              </div>
            );
          })()}
        </div>

        <div className="md:w-1/2 text-center">
          <div className="text-3xl font-bold text-gray-100">Pricing Engine</div>
          <div className="text-sm text-gray-100">Complete all steps</div>
        </div>

        <div className="md:w-1/4 flex flex-col items-end text-sm">
          <div className="font-bold text-gray-100">Job No: {singleSamplesalesOrder?.sub_job_no}</div>
          <div className="font-bold text-gray-100">Reference No: {singleSamplesalesOrder?.enquiry_id?.reference_no || " "}</div>
          <div className="font-bold text-gray-100">Job Qty: {formData.jobQty || singleSamplesalesOrder?.job_quantity}</div>
        </div>
      </div>




      <div className="flex justify-center mb-6">
        <div className="flex flex-wrap justify-center gap-2 max-w-4xl">
          {steps.map((label, idx) => {
            const isActive = idx === activeStep;
            const isCompleted = idx < activeStep;

            return (
              <div
                key={idx}
                // onClick={() => goToStep(idx)}
                className={`
                cursor-pointer px-4 py-2 rounded-md text-sm font-medium
                transition-all
                ${isCompleted
                    ? "bg-violet-100 text-violet-700"
                    : !isActive
                      ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      : ""
                  }
              `}
                style={isActive ? { backgroundColor: "#4f46e5", color: "white" } : {}}
              >
                {label}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-center items-start min-h-screen p-4 bg-gray-100 ">
        <div className="w-full bg-white rounded-xl shadow-md p-6">






          {/* <div className="flex justify-center mb-6">
      <div className="flex flex-wrap justify-center gap-2 max-w-4xl">
        {steps.map((label, idx) => {
          const isActive = idx === activeStep;
          const isCompleted = idx < activeStep;

          return (
            <div
              key={idx}
              // onClick={() => goToStep(idx)}
              className={`
                cursor-pointer px-4 py-2 rounded-md text-sm font-medium
                transition-all
                ${isCompleted
                  ? "bg-violet-100 text-violet-700"
                  : !isActive
                  ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  : ""
                }
              `}
              style={isActive ? { backgroundColor: "#4f46e5", color: "white" } : {}}
            >
              {label}
            </div>
          );
        })}
      </div>
    </div> */}



          {/* Current step form */}
          <CurrentStep
            handleNext={(stepData) => {
              if (activeStep === steps.length - 1) {
                const finalData = { ...formData, ...stepData };
                setFormData(finalData);
                handleFinalSubmit(finalData);
              } else {
                handleNext(stepData);
              }
            }}
            handleBack={handleBack}
            handleSaveDraft={handleSaveDraft}
            formData={formData}
            setFormData={setFormData}
            SamplesalesOrderdata={singleSamplesalesOrder}
            isSubmitting={isSubmitting}
            sotype={sotype}
            isViewMode={isViewMode}
          />
        </div>
      </div>
      <ImageLightbox
        src={previewImage}
        fileName={singleSamplesalesOrder?.sub_job_no || formData?.subJobNo || "Product Image"}
        onClose={() => setPreviewImage(null)}
      />
    </>
  );
}
