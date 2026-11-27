import MaterialPurchaseRequest from "../../models/store/materialPurchaseRequestModel.js";
import { getCurrentDate } from "../../helpers/dateTime.js";

// Helper for Auto-generated Request Number
const getNextRequestCode = async () => {
    const prefix = "SPR-";
    const last = await MaterialPurchaseRequest.findOne({ request_number: { $regex: /^SPR-\d+$/ } })
        .sort({ createdAt: -1 })
        .select("request_number");
    let next = 1001;
    if (last?.request_number) {
        const match = last.request_number.match(/\d+$/);
        if (match) next = parseInt(match[0], 10) + 1;
    }
    return `${prefix}${next}`;
};

export const createMaterialPurchaseRequest = async (req, res) => {
    try {
        const userId = req.user?._id;
        const role = req.user?.role?.toLowerCase() || '';
        const isHead = req.user?.is_head;

        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

        const { items } = req.body;
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: "Request must include at least one item." });
        }

        const request_number = await getNextRequestCode();

        let initialStatus = 'PENDING_STORE_HEAD';
        let store_head_approval = undefined;
        let admin_head_approval = undefined;

        if (role === 'admin executive') {
            initialStatus = 'APPROVED';
            admin_head_approval = { approved_by: userId, approved_at: getCurrentDate(), remark: "Auto-approved (Created by Admin Executive)" };
            store_head_approval = { approved_by: userId, approved_at: getCurrentDate(), remark: "Auto-approved (Created by Admin Executive)" };
        } else if (isHead) {
            initialStatus = 'PENDING_ADMIN_HEAD';
            store_head_approval = { approved_by: userId, approved_at: getCurrentDate(), remark: "Auto-approved (Created by Head)" };
        }

        const newRequest = new MaterialPurchaseRequest({
            request_number,
            requested_by: userId,
            items,
            status: initialStatus,
            store_head_approval,
            admin_head_approval,
            created_at: getCurrentDate(),
            updated_at: getCurrentDate()
        });

        const savedRequest = await newRequest.save();

        const populatedRequest = await MaterialPurchaseRequest.findById(savedRequest._id)
            .populate('requested_by', 'name')
            .populate('store_head_approval.approved_by', 'name')
            .populate('admin_head_approval.approved_by', 'name')
            .populate('rejection_details.rejected_by', 'name');

        res.status(201).json({ success: true, data: populatedRequest });
    } catch (error) {
        console.error("Error creating Material Purchase Request:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// GET ALL Material Purchase Requests
export const getAllMaterialPurchaseRequests = async (req, res) => {
    try {
        const userId = req.user?._id;
        const role = req.user?.role?.toLowerCase() || '';
        const isHead = req.user?.is_head;

        let query = { is_active: true };

        // If not admin and not a head, restrict view to only their own requests
        if (role !== 'admin executive' && !isHead) {
            query.requested_by = userId;
        }

        const mprs = await MaterialPurchaseRequest.find(query)
            .populate("requested_by", "name")
            .populate("store_head_approval.approved_by", "name")
            .populate("admin_head_approval.approved_by", "name")
            .populate("rejection_details.rejected_by", "name")
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, data: mprs });
    } catch (error) {
        console.error("Error fetching Material Purchase Requests:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// APPROVE Material Purchase Request
export const approveMaterialPurchaseRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { remark } = req.body;
        const userId = req.user?._id;

        const request = await MaterialPurchaseRequest.findById(requestId);
        if (!request) return res.status(404).json({ success: false, message: "Request not found" });

        const role = req.user?.role?.toLowerCase() || '';
        const currentStatus = request.status;

        if (role === 'admin executive') {
            if (currentStatus === 'PENDING_STORE_HEAD' || currentStatus === 'PENDING_ADMIN_HEAD') {
                request.status = 'APPROVED';
                request.admin_head_approval = {
                    approved_by: userId,
                    approved_at: getCurrentDate(),
                    remark: remark || "Approved by Admin Executive"
                };
                
                if (currentStatus === 'PENDING_STORE_HEAD') {
                    request.store_head_approval = {
                        approved_by: userId,
                        approved_at: getCurrentDate(),
                        remark: "Auto-approved (Admin Executive Override)"
                    };
                }
            } else {
                return res.status(400).json({ success: false, message: "Request is not in a valid state for approval" });
            }
        } else {
            if (currentStatus === 'PENDING_STORE_HEAD') {
                request.status = 'PENDING_ADMIN_HEAD';
                request.store_head_approval = {
                    approved_by: userId,
                    approved_at: getCurrentDate(),
                    remark
                };
            } else if (currentStatus === 'PENDING_ADMIN_HEAD') {
                return res.status(403).json({ success: false, message: "Only Admin Executive can approve at this stage" });
            } else {
                return res.status(400).json({ success: false, message: "Request is not in a valid state for approval" });
            }
        }

        request.updated_at = getCurrentDate();
        await request.save();

        const populatedRequest = await MaterialPurchaseRequest.findById(request._id)
            .populate('requested_by', 'name')
            .populate('store_head_approval.approved_by', 'name')
            .populate('admin_head_approval.approved_by', 'name')
            .populate('rejection_details.rejected_by', 'name');

        res.status(200).json({ success: true, message: "Request approved successfully", data: populatedRequest });
    } catch (error) {
        console.error("Error approving Material Purchase Request:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// REJECT Material Purchase Request
export const rejectMaterialPurchaseRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { remark } = req.body;
        const userId = req.user?._id;
        const role = req.user?.role?.toLowerCase() || '';
        const isHead = req.user?.is_head;

        if (!remark) return res.status(400).json({ success: false, message: "Remark is required for rejection." });

        const request = await MaterialPurchaseRequest.findById(requestId);
        if (!request) return res.status(404).json({ success: false, message: "Request not found" });

        if (role === 'admin executive') {
            request.status = 'REJECTED';
            request.rejection_details = {
                rejected_by: userId,
                rejected_at: getCurrentDate(),
                remark
            };
        } else if (isHead) {
            // Store Head rejects: wait for admin approval instead of full reject
            request.status = 'PENDING_ADMIN_HEAD';
            request.rejection_details = {
                rejected_by: userId,
                rejected_at: getCurrentDate(),
                remark: "Store Head Escalation (Rejected): " + remark
            };
        } else {
            return res.status(403).json({ success: false, message: "Only Admin Executive or Store Head can reject requests" });
        }

        request.updated_at = getCurrentDate();
        await request.save();

        const populatedRequest = await MaterialPurchaseRequest.findById(request._id)
            .populate('requested_by', 'name')
            .populate('store_head_approval.approved_by', 'name')
            .populate('admin_head_approval.approved_by', 'name')
            .populate('rejection_details.rejected_by', 'name');

        res.status(200).json({ success: true, message: "Request rejected successfully", data: populatedRequest });
    } catch (error) {
        console.error("Error rejecting Material Purchase Request:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const updateMaterialPurchaseRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { items } = req.body;
        const userId = req.user?._id;
        const role = req.user?.role?.toLowerCase() || '';
        const isHead = req.user?.is_head;

        if (!items || !items.length) {
            return res.status(400).json({ success: false, message: "Request must contain at least one item." });
        }

        const request = await MaterialPurchaseRequest.findById(requestId);
        if (!request) return res.status(404).json({ success: false, message: "Request not found" });

        if (request.status === 'APPROVED' || request.status === 'REJECTED') {
            return res.status(400).json({ success: false, message: "This request is closed and cannot be edited." });
        }

        if (request.requested_by.toString() !== userId.toString() && role !== 'admin executive' && !isHead) {
            return res.status(403).json({ success: false, message: "Not authorized to edit this request" });
        }

        request.items = items;
        request.updated_at = getCurrentDate();
        await request.save();

        const populatedRequest = await MaterialPurchaseRequest.findById(request._id)
            .populate('requested_by', 'name')
            .populate('store_head_approval.approved_by', 'name')
            .populate('admin_head_approval.approved_by', 'name')
            .populate('rejection_details.rejected_by', 'name');

        res.status(200).json({ success: true, message: "Request updated successfully", data: populatedRequest });
    } catch (error) {
        console.error("Error updating Material Purchase Request:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
