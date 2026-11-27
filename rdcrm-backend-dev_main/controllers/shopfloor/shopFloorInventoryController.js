import shopFloorInventoryModel from "../../models/shopfloor/shopFloorInventoryModel.js";

const getDateRange = (filterType, filterValue) => {
    let startDate, endDate;

    if (filterType === 'today') {
        const [year, month, day] = filterValue.split('-');
        startDate = new Date(year, month - 1, day);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(year, month - 1, day);
        endDate.setHours(23, 59, 59, 999);
    } else if (filterType === 'month') {
        const [year, month] = filterValue.split('-');
        startDate = new Date(year, month - 1, 1);
        endDate = new Date(year, month, 0);
        endDate.setHours(23, 59, 59, 999);
    } else if (filterType === 'week') {
        const year = parseInt(filterValue.substring(0, 4));
        const week = parseInt(filterValue.substring(6, 8));
        
        const simple = new Date(year, 0, 1 + (week - 1) * 7);
        const dow = simple.getDay();
        const ISOweekStart = simple;
        if (dow <= 4) {
            ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
        } else {
            ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
        }
        
        startDate = new Date(ISOweekStart);
        endDate = new Date(ISOweekStart);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
    } else if (filterType === 'fy') {
        const year = parseInt(filterValue);
        startDate = new Date(year, 3, 1);
        endDate = new Date(year + 1, 2, 31);
        endDate.setHours(23, 59, 59, 999);
    }

    return { startDate, endDate };
};

// Get list of inventory items for a specific shop floor
export const getShopFloorInventory = async (req, res) => {
    try {
        const { shopfloor_name, search, page, limit, filterType, filterValue } = req.query;

        let query = {};
        if (shopfloor_name && shopfloor_name !== 'All') {
            query.shopfloor_name = shopfloor_name;
        }

        if (filterType && filterValue) {
            const { startDate, endDate } = getDateRange(filterType, filterValue);
            if (startDate && endDate) {
                query.updatedAt = {
                    $gte: startDate,
                    $lte: endDate
                };
            }
        }

        if (search) {
            query.$or = [
                { name: { $regex: new RegExp(search, 'i') } },
                { item_code: { $regex: new RegExp(search, 'i') } }
            ];
        }

        let mQuery = shopFloorInventoryModel.find(query)
            .populate("stock_sizes")
            .populate({
                path: "inward_history.requested_by_id",
                select: "name username"
            })
            .sort({ name: 1 });

        if (page && limit) {
            const pageNum = parseInt(page) || 1;
            const limitNum = parseInt(limit) || 10;
            const skip = (pageNum - 1) * limitNum;
            mQuery = mQuery.skip(skip).limit(limitNum);
        }

        const items = await mQuery;
        const totalCount = await shopFloorInventoryModel.countDocuments(query);

        // Calculate overall metrics
        const metricsAggr = await shopFloorInventoryModel.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    inStock: { $sum: { $cond: [{ $gt: ["$stock", 0] }, 1, 0] } },
                    outOfStock: { $sum: { $cond: [{ $lte: ["$stock", 0] }, 1, 0] } },
                    totalValue: { $sum: { $multiply: ["$stock", { $toDouble: { $ifNull: ["$cost", 0] } }] } }
                }
            }
        ]);
        const metrics = metricsAggr.length > 0 ? metricsAggr[0] : { inStock: 0, outOfStock: 0, totalValue: 0 };

        return res.status(200).json({
            success: true,
            data: items,
            totalCount,
            metrics
        });
    } catch (error) {
        console.error("getShopFloorInventory error:", error);
        return res.status(500).json({ success: false, message: "Server error fetching shop floor inventory", error: error.message });
    }
};

// Get a single shop floor inventory item by ID
export const getShopFloorInventoryItem = async (req, res) => {
    try {
        const { id } = req.params;

        const item = await shopFloorInventoryModel.findById(id)
            .populate("stock_sizes")
            .populate({
                path: "inward_history.requested_by_id",
                select: "name username"
            });

        if (!item) {
            return res.status(404).json({ success: false, message: "Inventory item not found." });
        }

        return res.status(200).json({
            success: true,
            data: item
        });
    } catch (error) {
        console.error("getShopFloorInventoryItem error:", error);
        return res.status(500).json({ success: false, message: "Server error fetching shop floor inventory item details", error: error.message });
    }
};
