import dotenv from "dotenv";
dotenv.config();
import stripeRoutes from "@/routes/stripe.route";
import userRoutes from "@/routes/user.route";
import refreshRoutes from "@/routes/refresh.route";
import dashboardRoutes from "@/routes/dashboard.route";
import connectDB from "@/config/db";
import showcaseRoutes from "@/routes/showcase.route";
import connectDB from "@/config/db";

import cors from "cors";
import fileUpload from "express-fileupload";
import connectDB from "@/config/db";

import cors from "cors";

import express, { Application, json, urlencoded } from "express";

const port = process.env.PORT || 8000;
const app: Application = express();
const devMode = process.env.MODE === "dev";

connectDB();

app.use(urlencoded({ extended: true }));
app.use(json());
app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: "/tmp/",
  })
);

app.use(
  cors({
    origin: devMode
      ? ["http://localhost:5173", "http://localhost:4173"]
      : ["http://localhost:5173", "http://localhost:4173"],
    methods: "GET,POST,PATCH,PUT,DELETE,OPTIONS",
    allowedHeaders: "Content-Type,Authorization",
    credentials: true,
  })
);

app.use("/api/users", userRoutes);
app.use("/api/stripe", stripeRoutes);
app.use("/api/refresh", refreshRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/showcase", showcaseRoutes);

app.get("/", (req, res) => {
  res.status(200).json({ msg: "Server is up and running" });
});

const server = app.listen(port, () => {
  console.log(`Server is listening at port ${port}`);
});
