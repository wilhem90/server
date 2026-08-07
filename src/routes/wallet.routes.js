import express from "express";
import { showBalance } from "../controllers/wallet.controller.js";
import { privateRoute } from "../middlewares/auth.middleware.js";
import { transactionHistory } from "../controllers/transaction.controller.js";

const walletRoutes = express.Router();
walletRoutes.get("/balance", privateRoute, showBalance);
walletRoutes.get("/history", privateRoute, transactionHistory);
export default walletRoutes;
