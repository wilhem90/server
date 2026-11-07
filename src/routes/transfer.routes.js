import express from "express";
import controllerTransferMoney from "../controllers/transfer.controller.js";
import middlewareAuthProfil from "../middleware/auth.profil.js";
const router = express.Router();

router.post(
  "/create",
  middlewareAuthProfil.validateAuth,
  controllerTransferMoney.createTransfer,
);

router.get(
  "/get-transfer/:id",
  middlewareAuthProfil.validateAuth,
  controllerTransferMoney.getTransferById,
);

router.get(
  "/get-transfers",
  middlewareAuthProfil.validateAuth,
  controllerTransferMoney.getTransfers,
);

router.put(
  "/update-transfer",
  middlewareAuthProfil.validateAuth,
  (req, res, next) =>
    middlewareAuthProfil.checkPermission(req, res, next, "transfer", "delivered"),
  controllerTransferMoney.updateTransfer,
);

export default router;
