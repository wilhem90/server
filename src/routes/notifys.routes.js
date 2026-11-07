import express from "express";
import controllerNotify from "../controllers/notify.controller.js";
import middlewareAuthProfil from "../middleware/auth.profil.js";
const router = express.Router();

router.get("/me", middlewareAuthProfil.validateAuth, controllerNotify.getNotification);

router.get("/get-notification", (_req, res) => {
  res.status(503).json({
    success: false,
    error: "Notifications are unavailable until access controls are verified.",
  });
});

export default router;
