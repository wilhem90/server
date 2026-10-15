import express from "express";
import controlWallets from "../controllers/wallets.controller.js";
import middlewareAuthProfil from "../middleware/auth.profil.js";

const router = express.Router();

router.get(
  "/balance",
  middlewareAuthProfil.validateAuth,
  controlWallets.getBalance,
);

router.post(
  "/deposit",
  middlewareAuthProfil.validateAuth,
  controlWallets.deposit,
);

router.get(
  "/statements",
  middlewareAuthProfil.validateAuth,
  controlWallets.getStatements,
);

router.get(
  "/transactions",
  middlewareAuthProfil.validateAuth,
  controlWallets.getTransactions,
);

router.post(
  "/confirm_transaction",
  middlewareAuthProfil.validateAuth,
  controlWallets.confirmTransaction,
);

export default router;
