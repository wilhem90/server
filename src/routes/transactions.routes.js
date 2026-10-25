import express from "express";
import controlTransactions from "../controllers/transactions.controller.js";
import middlewareAuthProfil from "../middleware/auth.profil.js";

const router = express.Router();


router.post(
  "/deposit",
  middlewareAuthProfil.validateAuth,
  controlTransactions.deposit,
);

router.post(
  "/withdraw",
  middlewareAuthProfil.validateAuth,
  controlTransactions.withdraw,
);

router.post(
  "/confirm_transaction",
  middlewareAuthProfil.validateAuth,
  controlTransactions.confirmTransaction,
);

export default router;
