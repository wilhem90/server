import express from "express";
import {
  deposit,
  reviewTransaction,
  withdrawal,
} from "../controllers/transaction.controller.js";
import { critiqueRoute, privateRoute } from "../middlewares/auth.middleware.js";

const transactionRoutes = express.Router();

transactionRoutes.post("/deposit", privateRoute, deposit);
transactionRoutes.post("/withdrawal", privateRoute, withdrawal);
transactionRoutes.post("/review", privateRoute, reviewTransaction);

export default transactionRoutes;
