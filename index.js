import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
// import morgan from "morgan";
import profilRouter from "./src/routes/profil.routes.js";
import companyRouter from "./src/routes/company.routes.js";
import topupRouter from "./src/routes/topup.routes.js";
import transferRouter from "./src/routes/transfer.routes.js";
import walletRouter from "./src/routes/wallets.routes.js";
const app = express();
app.use(express.json());

app.use(cors());
// app.use(morgan("dev"));
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
app.use("/api/profiles", profilRouter);
app.use("/api/companies", companyRouter);
app.use("/api/topups", topupRouter);
app.use("/api/transfers", transferRouter);
app.use("/api/wallets", walletRouter);

app.use((_, res) => {
  res.status(404).json({ message: "Not Found" });
});
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
