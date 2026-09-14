import { Router } from "express";
import {
  createCompany,
  createProfile,
  loginCompany,
  recoveryPassword,
  getMyCompany,
  getMyProfile,
} from "../controllers/companies.controller.js";
import limiter from "../configs/limiter.js";
import welcomeEmail from "../mails/welcomeEmail.js";
import { privateRoute } from "../middlewares/auth.middleware.js";
const companiesRoutes = Router();

companiesRoutes.post("/create", limiter(1 * 60 * 1000, 1), createCompany);
// Welcome route for companies (if needed)
companiesRoutes.get("/", (_, res) => {
  res
    .status(200)
    .send(welcomeEmail("Parceiro(a)", "Flexpay", "devsht2024@gmail.com"));
});

companiesRoutes.post("/login", loginCompany);
companiesRoutes.get("/my-company", privateRoute, getMyCompany);
companiesRoutes.get("/profile", privateRoute, getMyProfile);
companiesRoutes.post("/recovery-password", recoveryPassword);
companiesRoutes.post("/create-profile", createProfile);

export default companiesRoutes;
