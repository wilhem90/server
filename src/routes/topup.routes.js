import express from "express";
import controlTopup from "../controllers/topup.controller.js";
import middlewareAuthProfil from "../middleware/auth.profil.js";
const router = express.Router();

// router.post("/create", middlewareAuthProfil.validateAuth, controlTopup.createTopup);
router.get(
  "/countries",
  middlewareAuthProfil.validateAuth,
  controlTopup.GetCountries,
);
router.get(
  "/providers",
  middlewareAuthProfil.validateAuth,
  controlTopup.GetProviders,
);
router.get(
  "/products",
  middlewareAuthProfil.validateAuth,
  controlTopup.GetProducts,
);
router.post(
  "/send",
  middlewareAuthProfil.validateAuth,
  // (req, res, next) =>
  //   middlewareAuthProfil.checkPermission(req, res, next, "topup", "write"),
  controlTopup.SendTopup,
);

router.get(
  "/get-topup/:statement_id",
  middlewareAuthProfil.validateAuth,
  controlTopup.getTopupById,
);

router.get(
  "/history",
  middlewareAuthProfil.validateAuth,
  controlTopup.getTopupHistory,
);

router.post(
  "/reconcile",
  middlewareAuthProfil.validateAuth,
  controlTopup.reconcileTopups,
);

export default router;
