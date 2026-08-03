import { Router } from "express";
import {
    getAllCompanies,
  listAllMyCompanyUsers,
} from "../controllers/enterprises.controller.js";
import { privateRoute } from "../middlewares/auth.middleware.js";
const enterpriseRoutes = Router();

enterpriseRoutes.get("/my-companies", privateRoute, getAllCompanies);
enterpriseRoutes.get("/my-users", privateRoute, listAllMyCompanyUsers);

export default enterpriseRoutes;
