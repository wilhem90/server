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
  "/confirm",
  middlewareAuthProfil.validateAuth,
  (req, res, next) =>
    middlewareAuthProfil.checkPermission(
      req,
      res,
      next,
      "transactions",
      "confirm",
    ),
  controlTransactions.confirmTransaction,
);

export default router;
