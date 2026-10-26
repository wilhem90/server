import { Router } from "express";
import controlProfil from "../controllers/profil.controller.js";
import companyController from "../controllers/company.controller.js";
import middlewareAuthProfil from "../middleware/auth.profil.js";
const router = Router();

router.post("/create-profil", controlProfil.createProfil);
router.post("/login", controlProfil.loginProfil);
router.post("/logout", middlewareAuthProfil.validateAuth, controlProfil.logoutProfil);

router.get(
  "/me",
  middlewareAuthProfil.validateAuth,
  controlProfil.getProfileByUsername,
);


router.put(
  "/update-profile",
  middlewareAuthProfil.validateAuth,
  controlProfil.updateProfile,
);

export default router;
