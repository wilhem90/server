import jwt from "jsonwebtoken";
import z from "zod";
import bcrypt from "bcrypt";
import { validateBody } from "./validate.middleware.js";
import { loginUserSchema } from "../schemas/user.schema.js";
import { linkValidateEmail } from "../mails/linkValidateEmail.js";
import { checkTokenListFromSupaBase } from "../db/auth.db.js";
import sendEmail from "../configs/nodemailer.js";
import tokenExpiredEmail from "../mails/templateTokenExpired.js";
import {
  getSubUsersFromSupabase,
  getUserAndWalletByEmailUserNameDocumentIdFromSupabase,
} from "../db/user.db.js";

// =====================================================
// CONSTANTES
// =====================================================
const TOKEN_EXPIRY = {
  ACCESS: "7d",
  REFRESH: "30d",
  EMAIL_VALIDATE: "24h",
};

const ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  USER: "user",
};

const ERROR_MESSAGES = {
  NOT_AUTHORIZED: "Not authorized.",
  NOT_AUTHENTICATED: "Not authenticated.",
  USER_NOT_FOUND: "User not found.",
  INTERNAL_ERROR: "Something went wrong. Please try again later.",
  INVALID_SESSION: "Invalid session. Please login again.",
  INCORRECT_PIN: "Incorrect PIN.",
  MISSING_PIN: "Missing transaction PIN.",
  EMAIL_NOT_FOUND: "You do not have an account registered with this email.",
  EMAIL_ALREADY_CONFIRMED: "Your email has already been confirmed.",
};

// =====================================================
// FUNÇÕES AUXILIARES
// =====================================================
const generateTokens = (data, secret, expiresIn) => {
  return jwt.sign(data, secret, { expiresIn });
};

const verifyToken = (token, secret) => {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    throw error;
  }
};

const sendEmailWithRetry = async (email, subject, html, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await sendEmail(email, subject, html);
      if (result.success) return result;
    } catch (error) {
      console.error(`Email attempt ${i + 1} failed:`, error);
      if (i === retries - 1) throw error;
    }
  }
};

// =====================================================
// REFRESH TOKEN
// =====================================================
const refreshToken = async (data) => {
  return generateTokens(
    { uuid: data.uuid },
    data.REFRESH_SECRET,
    TOKEN_EXPIRY.REFRESH
  );
};

// =====================================================
// PRIVATE ROUTE - Valida token de acesso
// =====================================================
const privateRoute = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: ERROR_MESSAGES.NOT_AUTHORIZED,
      });
    }

    const decoded = verifyToken(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.message === "jwt expired") {
      return res.status(401).json({
        success: false,
        message: "Session expired. Please login again.",
      });
    }

    console.error("Private route error:", error);
    return res.status(500).json({
      success: false,
      message: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  }
};

// =====================================================
// CHECK TOKEN IF NOT BLOCKED
// =====================================================
const checkTokenIfTokenNotBlocked = async (req, res, next) => {
  const { token } = req.params;
  const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: ERROR_MESSAGES.NOT_AUTHORIZED,
    });
  }

  try {
    const decoded = verifyToken(token, process.env.JWT_SECRET);
    const tokenIsBlocked = await checkTokenListFromSupaBase(token);

    if (tokenIsBlocked.success) {
      return res.status(401).json({
        success: false,
        message: ERROR_MESSAGES.INVALID_SESSION,
      });
    }

    req.user = { email: decoded.email, token };
    next();
  } catch (error) {
    console.error("Check token error:", error);

    if (error.message === "jwt expired") {
      return res.status(400).send(tokenExpiredEmail(SUPPORT_EMAIL));
    }

    return res.status(500).json({
      success: false,
      message: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  }
};

// =====================================================
// LINK CONFIRM EMAIL
// =====================================================
const linkConfirmEmail = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email is required.",
    });
  }

  try {
    const existingUser = await getUserAndWalletByEmailUserNameDocumentIdFromSupabase(
      email
    );

    if (!existingUser?.data?.email) {
      return res.status(400).json({
        success: false,
        message: ERROR_MESSAGES.EMAIL_NOT_FOUND,
      });
    }

    if (existingUser.data.email_confirmed) {
      return res.status(400).json({
        success: false,
        message: ERROR_MESSAGES.EMAIL_ALREADY_CONFIRMED,
      });
    }

    const token = generateTokens(
      { email },
      process.env.JWT_SECRET,
      TOKEN_EXPIRY.EMAIL_VALIDATE
    );

    const user = existingUser.data;
    const url = `${process.env.FRONTEND_URL_PRO}/users/confirm-email/${token}`;
    const emailHtml = linkValidateEmail(user.first_name, "Pasyans", url);

    const result = await sendEmailWithRetry(email, "Validate your account!", emailHtml);

    if (!result.success) {
      throw new Error(result.error || "Failed to send email");
    }

    return res.status(200).json({
      success: true,
      message: "Please check your email inbox.",
      messageId: result.messageId,
    });
  } catch (error) {
    console.error("Link confirm email error:", error);
    return res.status(500).json({
      success: false,
      message: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  }
};

// =====================================================
// VERIFY CODE OTP
// =====================================================
const verifyCodeOTP = async (req, res, next) => {
  const { codeOTP, email } = req.body;
  const ERROR_MSG = "Unable to complete password reset.";

  if (!codeOTP || !email) {
    return res.status(400).json({
      success: false,
      message: "Code OTP and email are required.",
    });
  }

  try {
    const user = await getUserAndWalletByEmailUserNameDocumentIdFromSupabase(email);

    if (!user.data?.code_otp?.hash_code) {
      return res.status(401).json({
        success: false,
        message: ERROR_MSG,
      });
    }

    const { expires_at, hash_code } = user.data.code_otp;

    // Verifica se o código expirou
    if (new Date(expires_at) < new Date()) {
      return res.status(401).json({
        success: false,
        message: "OTP code has expired. Please request a new one.",
      });
    }

    // Verifica se o código é válido
    const isValid = await bcrypt.compare(codeOTP, hash_code);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid OTP code.",
      });
    }

    next();
  } catch (error) {
    console.error("Verify OTP error:", error);
    return res.status(500).json({
      success: false,
      message: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  }
};

// =====================================================
// CRITIQUE ROUTE - Valida PIN e token_version
// =====================================================
const critiqueRoute = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: ERROR_MESSAGES.NOT_AUTHENTICATED,
      });
    }

    const { token_version, email } = req.user;

    if (token_version == null) {
      return res.status(401).json({
        success: false,
        message: ERROR_MESSAGES.NOT_AUTHENTICATED,
      });
    }

    const user = await getUserAndWalletByEmailUserNameDocumentIdFromSupabase(email);

    if (!user?.data) {
      return res.status(404).json({
        success: false,
        message: ERROR_MESSAGES.USER_NOT_FOUND,
      });
    }

    // Verifica se o token_version coincide
    if (token_version !== user.data.token_version) {
      return res.status(401).json({
        success: false,
        message: ERROR_MESSAGES.NOT_AUTHENTICATED,
      });
    }

    // Verifica PIN
    const { pin_transaction, ...userData } = user.data;

    if (!req.body.pinTransaction || !pin_transaction) {
      return res.status(400).json({
        success: false,
        message: ERROR_MESSAGES.MISSING_PIN,
      });
    }

    const pinMatch = bcrypt.compareSync(req.body.pinTransaction, pin_transaction);

    if (!pinMatch) {
      return res.status(401).json({
        success: false,
        message: ERROR_MESSAGES.INCORRECT_PIN,
      });
    }

    // Adiciona os dados do usuário ao req
    req.user = {
      ...req.user,
      ...userData,
    };

    next();
  } catch (error) {
    console.error("Critique route error:", error);
    return res.status(500).json({
      success: false,
      message: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  }
};

// =====================================================
// IS ADMIN USER - Verifica se é admin ou super admin
// =====================================================
const isAdminUser = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: ERROR_MESSAGES.NOT_AUTHENTICATED,
      });
    }

    const { uuid } = req.query;
    const { role, uuid: loggedUserUUID } = req.user;

    if (!uuid) {
      return res.status(400).json({
        success: false,
        message: "User UUID is required in query parameters.",
      });
    }

    // 1. SUPER ADMIN - Acesso total
    if (role === ROLES.SUPER_ADMIN) {
      return next();
    }

    // 2. ADMIN - Acesso próprio e sub usuários
    if (role === ROLES.ADMIN) {
      // Acesso ao próprio UUID
      if (loggedUserUUID === uuid) {
        return next();
      }

      // Busca sub usuários do admin
      const subUsers = await getSubUsersFromSupabase(loggedUserUUID);

      if (!subUsers.success) {
        return res.status(500).json({
          success: false,
          message: "Could not retrieve sub users.",
        });
      }

      const subUserUUIDs = (subUsers.data || []).map((sub) => sub.uuid);

      // Admin pode acessar somente seus sub usuários
      if (subUserUUIDs.includes(uuid)) {
        return next();
      }

      return res.status(403).json({
        success: false,
        error: "You are not authorized to access this user's tickets.",
      });
    }

    // 3. USUÁRIO NORMAL - Acesso apenas a si mesmo
    if (loggedUserUUID === uuid) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: "You are not authorized to access this user's tickets.",
    });
  } catch (error) {
    console.error("isAdminUser middleware error:", error);
    return res.status(500).json({
      success: false,
      message: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  }
};

// =====================================================
// IS ADMIN OR SUB USER
// =====================================================
const isAdminOrSubUser = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: ERROR_MESSAGES.NOT_AUTHENTICATED,
      });
    }

    const { identifier } = req.params;
    const { role, email, uuid: loggedUserUUID } = req.user;

    // 1. SUPER ADMIN - Acesso total
    if (role === ROLES.SUPER_ADMIN) {
      return next();
    }

    // 2. ADMIN - Acesso próprio e sub usuários
    if (role === ROLES.ADMIN) {
      // Acesso ao próprio email
      if (email === identifier) {
        return next();
      }

      // Busca sub usuários do admin
      const subUsers = await getSubUsersFromSupabase(loggedUserUUID);

      if (!subUsers.success) {
        return res.status(500).json({
          success: false,
          message: "Could not retrieve sub users.",
        });
      }

      const subUserEmails = (subUsers.data || []).map((sub) => sub.email);

      // Admin pode acessar somente seus sub usuários
      if (subUserEmails.includes(identifier)) {
        return next();
      }

      return res.status(403).json({
        success: false,
        error: "You are not authorized to access this user's data.",
      });
    }

    // 3. USUÁRIO NORMAL - Acesso apenas a si mesmo
    if (email === identifier) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: "You are not authorized to access this user's data.",
    });
  } catch (error) {
    console.error("isAdminOrSubUser middleware error:", error);
    return res.status(500).json({
      success: false,
      message: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  }
};

// =====================================================
// IS ADMIN OR SUPER ADMIN
// =====================================================
const isAdminOrSuperAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: ERROR_MESSAGES.NOT_AUTHENTICATED,
      });
    }

    const { role } = req.user;

    if (role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: "You are not authorized to access this resource.",
    });
  } catch (error) {
    console.error("isAdminOrSuperAdmin middleware error:", error);
    return res.status(500).json({
      success: false,
      message: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  }
};

// =====================================================
// EXPORTS
// =====================================================
export {
  refreshToken,
  privateRoute,
  linkConfirmEmail,
  checkTokenIfTokenNotBlocked,
  verifyCodeOTP,
  critiqueRoute,
  isAdminUser,
  isAdminOrSubUser,
  isAdminOrSuperAdmin,
};