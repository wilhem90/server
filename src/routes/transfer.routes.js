import express from "express";
import controllerTransferMoney from "../controllers/transfer.controller.js";
import middlewareAuthProfil from "../middleware/auth.profil.js";
const router = express.Router();

router.post(
  "/create",
  middlewareAuthProfil.validateAuth,
  controllerTransferMoney.createTransfer,
);

// router.get(
//   "/get-beneficiary/:accountNumber",
//   middlewareAuthProfil.validateAuth,
//   controllerTransferMoney.getBeneficiary,
// );

router.get(
  "/get-transfers",
  middlewareAuthProfil.validateAuth,
  controllerTransferMoney.getTransfers,
);

export default router;
