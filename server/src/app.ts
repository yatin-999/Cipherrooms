import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import dotenv from "dotenv";
import http from "http";

import authRoutes from "./routes/auth.routes";
import friendRoutes from "./routes/friend.routes";
import { initSocket } from "./socket";

dotenv.config();

const app = express();
const server = http.createServer(app);

initSocket(server);

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/friends", friendRoutes);

async function start() {
  await mongoose.connect(process.env.MONGO_URI!);
  console.log("MongoDB connected");

  server.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});