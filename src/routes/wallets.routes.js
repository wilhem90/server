import express from "express";
import controlWallets from "../controllers/wallets.controller.js";
import middlewareAuthProfil from "../middleware/auth.profil.js";

const router = express.Router();

router.get(
  "/balance",
  middlewareAuthProfil.validateAuth,
  controlWallets.getBalance,
);

router.get(
  "/statements",
  middlewareAuthProfil.validateAuth,
  controlWallets.getStatements,
);

export default router;
