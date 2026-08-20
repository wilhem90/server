import express from "express";
import {
  confirmEmailUser,
  getMySubuser,
  getUserByEmailUserNameDocumentId,
  loginUser,
  registerUser,
  resetPasswordByEmail,
  updateUser,
} from "../controllers/user.controller.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import {
  emailSchema,
  loginUserSchema,
  registerUserSchema,
} from "../schemas/user.schema.js";
import {
  checkTokenIfTokenNotBlocked,
  linkConfirmEmail,
  privateRoute,
  verifyCodeOTP,
} from "../middlewares/auth.middleware.js";
import limiter from "../configs/limiter.js";

const userRoutes = express.Router();

userRoutes.post(
  "/register",
  validateBody(registerUserSchema),
  registerUser,
  linkConfirmEmail,
);
userRoutes.post("/signin", validateBody(loginUserSchema), loginUser);
userRoutes.get("/:identifier", privateRoute, getUserByEmailUserNameDocumentId);
userRoutes.post(
  "/link-validate-email",
  limiter(24 * 60 * 60 * 1000, 2),
  validateBody(emailSchema),
  linkConfirmEmail,
);

//Validate email
userRoutes.get(
  "/confirm-email/:token",
  checkTokenIfTokenNotBlocked,
  confirmEmailUser,
);

userRoutes.post("/reset-password", limiter(900_000, 5), resetPasswordByEmail);
userRoutes.post("/update-password", verifyCodeOTP, updateUser);

// Get my subuser
userRoutes.get("/subuser", privateRoute, getMySubuser);

export default userRoutes;
