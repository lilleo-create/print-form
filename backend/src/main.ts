import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import fs from "fs";
import path from "path";
import helmet from "helmet";
import { env } from "./config/env";
import { authRoutes } from "./routes/authRoutes";
import { productRoutes } from "./routes/productRoutes";
import { orderRoutes } from "./routes/orderRoutes";
import { customRequestRoutes } from "./routes/customRequestRoutes";
import { sellerRoutes } from "./routes/sellerRoutes";
import { filterRoutes } from "./routes/filterRoutes";
import { meRoutes } from "./routes/meRoutes";
import { adminRoutes } from "./routes/adminRoutes";
import { paymentRoutes } from "./routes/paymentRoutes";
import { errorHandler } from "./middleware/errorHandler";
import { globalLimiter } from "./middleware/rateLimiters";

const app = express();
const uploadsDir = path.join(process.cwd(), "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet());
app.use(globalLimiter);

const allowedOrigins = [env.frontendUrl];
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("CORS_NOT_ALLOWED"));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use("/uploads", express.static(uploadsDir));

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/auth", authRoutes);
app.use("/products", productRoutes);
app.use("/orders", orderRoutes);
app.use("/custom-requests", customRequestRoutes);
app.use("/seller", sellerRoutes);
app.use("/filters", filterRoutes);
app.use("/me", meRoutes);
app.use("/admin", adminRoutes);
app.use("/payments", paymentRoutes);

app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`API running on ${env.port}`);
});
