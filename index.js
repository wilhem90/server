import dotenv from "dotenv";
dotenv.config();
import express from "express";
import userRoutes from "./src/routes/user.route.js";
import transactionRoutes from "./src/routes/transaction.route.js";
import betRoutes from "./src/routes/bet.routes.js";
import walletRoutes from "./src/routes/wallet.routes.js";
import cors from "cors";
// import morgan from "morgan";
import enterpriseRoutes from "./src/routes/enterprises.route.js";
const app = express();
const port = process.env.PORT_SERVER;

app.use(express.json());
app.use(cors());
// app.use(morgan("dev"));
//Routes
app.use("/api/users", userRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/bet", betRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/enterprises", enterpriseRoutes);

//Server start
app.listen(port, () => {
  console.log(`http://localhost:${port}`);
});

//Route not found
app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: "Route not found",
  });
});
