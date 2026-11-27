import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const DB_URL = process.env.DB_URL;

async function run() {
  try {
    await mongoose.connect(DB_URL);
    console.log("Connected to MongoDB");

    const collection = mongoose.connection.collection("product_config_masters");

    // Enable for medal, badge, lapel_pin
    const res1 = await collection.updateMany(
      { product_id: { $in: ["medal", "badge", "lapel_pin"] } },
      { $set: { "size_config.has_colour_wise_qty": true } }
    );
    console.log("Updated colour-wise products:", res1.modifiedCount);

    // Ensure others have it set to false if missing
    const res2 = await collection.updateMany(
      { product_id: { $nin: ["medal", "badge", "lapel_pin"] }, "size_config.has_colour_wise_qty": { $exists: false } },
      { $set: { "size_config.has_colour_wise_qty": false } }
    );
    console.log("Set default false for other products:", res2.modifiedCount);

    process.exit(0);
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  }
}

run();

