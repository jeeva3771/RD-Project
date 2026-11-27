import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import morgan from "morgan";
import cors from "cors";
import Routes from "./routes/index.js";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec, swaggerUiOptions } from "./swagger/swagger.js";

dotenv.config({ quiet: true });

connectDB();

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(morgan("dev"));

// Swagger route
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

app.use("/", Routes);

app.get("/", (req, res) => {
  res.send("<h1>Welcome to RD Application</h1>");
});

const PORT = process.env.PORT || 8081;

app.listen(PORT, () => {
  console.log(`Server Running on port ${PORT}`);
});
