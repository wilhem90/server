import express from "express";
import { showBalance } from "../controllers/wallet.controller.js";
import { privateRoute } from "../middlewares/auth.middleware.js";

const walletRoutes = express.Router();
walletRoutes.get("/balance", privateRoute, showBalance);
walletRoutes.get("/extract-wallet", showBalance);

export default walletRoutes;
