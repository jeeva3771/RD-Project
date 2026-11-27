import mongoose from "mongoose";

const connectDB = async (retryCount = 0) => {
  try {
    const conn = await mongoose.connect(process.env.DB_URL, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    console.log(`connected to mongodb database: ${conn.connection.name} -> ${conn.connection.host}`);
  } catch (error) {
    console.error(`error in mongodb: ${error.message || error}`);
    if (retryCount < 5) {
      console.log(`Retrying MongoDB connection in 3s... (attempt ${retryCount + 1}/5)`);
      setTimeout(() => connectDB(retryCount + 1), 3000);
    }
  }
};

mongoose.connection.on("disconnected", () => {
  console.warn("MongoDB connection disconnected. Attempting to reconnect...");
});

mongoose.connection.on("reconnected", () => {
  console.log("MongoDB connection re-established.");
});

mongoose.connection.on("error", (err) => {
  console.error("MongoDB connection error:", err.message || err);
});

export default connectDB;
