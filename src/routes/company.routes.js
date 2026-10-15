import express from "express";
import companyController from "../controllers/company.controller.js";
import middlewareAuthProfil from "../middleware/auth.profil.js";
const router = express.Router();

router.post(
  "/create-employee",
  middlewareAuthProfil.validateAuth,
  companyController.createEmployee,
);
router.get(
  "/my-employees",
  middlewareAuthProfil.validateAuth,
  companyController.myEmployees,
);
router.put(
  "/update-employee/:id",
  middlewareAuthProfil.validateAuth,
  companyController.updateEmployee,
);

router.post(
  "/new-client",
  middlewareAuthProfil.validateAuth,
  companyController.createClient,
);

router.get(
  "/get-client",
  middlewareAuthProfil.validateAuth,
  companyController.getClient,
);

router.get(
  "/settings-app",
  middlewareAuthProfil.validateAuth,
  companyController.getSettingsApp,
);

export default router;
