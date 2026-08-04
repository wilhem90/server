import jwt from "jsonwebtoken";
import { validateBody } from "./validate.middleware.js";
import { loginUserSchema } from "../schemas/user.schema.js";
import z from "zod";
import { linkValidateEmail } from "../mails/linkValidateEmail.js";
import { checkTokenListFromSupaBase } from "../db/auth.db.js";
import sendEmail from "../configs/nodemailer.js";
import tokenExpiredEmail from "../mails/templateTokenExpired.js";
import { getUserAndWalletByEmailUserNameDocumentIdFromSupabase } from "../db/user.db.js";
import bcrypt from "bcrypt";

const refreshToken = async (data) => {
  return (refreshToken = jwt.sign({ uuid: data.uuid }, data.REFRESH_SECRET, {
    expiresIn: "7d",
  }));
};

const privateRoute = async (req, res, next) => {
  const token = String(req.headers.authorization).split(" ")[1];
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Not authorized.",
    });
  }
  
  try {
    const checkToken = jwt.verify(token, process.env.JWT_SECRET);
    
    req.user = checkToken;
    next();
  } catch (error) {
    if (error.message === "jwt expired") {
      return res.status(401).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Something went wrong, please try again later.",
    });
  }
};

//Check token if blocked
const checkTokenIfTokenNotBlocked = async (req, res, next) => {
  const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL;
  const { token } = req.params;
  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Not authorized.",
    });
  }

  try {
    const checkToken = jwt.verify(token, process.env.JWT_SECRET);
    const token_is_in_block_list = await checkTokenListFromSupaBase(token);

    if (token_is_in_block_list.success) {
      return res.status(401).json({
        success: false,
        message: "Invalid session please again with new session.",
      });
    }
    req.user = { email: checkToken.email, token };

    next();
  } catch (error) {
    console.log(error);
    if (error.message !== "jwt expired") {
      return res.status(400).send(tokenExpiredEmail(SUPPORT_EMAIL));
    }
    return res.status(500).json({
      false: false,
      message: "Something went wrong!",
    });
  }
};

//Link to confirm email
const linkConfirmEmail = async (req, res) => {
  const { email } = req.body;
  try {
    const existEmail =
      await getUserAndWalletByEmailUserNameDocumentIdFromSupabase(email);

    if (!existEmail?.data?.email) {
      return res.status(400).json({
        success: false,
        message: "You do not have an account registered with this email.",
      });
    }

    if (existEmail?.data?.email_confirmed) {
      return res.status(400).json({
        success: false,
        message: "Your email has already been confirmed.",
      });
    }

    const token_validate_email = jwt.sign({ email }, process.env.JWT_SECRET, {
      expiresIn: "24h",
    });
    const user =
      await getUserAndWalletByEmailUserNameDocumentIdFromSupabase(email);

    const url = `${process.env.FRONTEND_URL_PRO}/users/confirm-email/${token_validate_email}`;
    const messageId = await sendEmail(
      email,
      "Validate your account!",
      linkValidateEmail(user?.data?.first_name, "Pasyans", url),
    );

    if (!messageId.success) {
      throw new Error(`${messageId.error}`);
    }

    return res.status(200).json({
      success: true,
      message: "Please check your account email.",
      messageId: messageId?.messageId,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      false: false,
      message: "Something went wrong!",
    });
  }
};

const verifyCodeOTP = async (req, res, next) => {
  try {
    const message = "It was not possible to complete your password reset.";
    const { codeOTP, email } = req.body;
    if (!codeOTP || !email) {
      return res.status(400).json({
        success: false,
        message,
      });
    }

    const refUser =
      await getUserAndWalletByEmailUserNameDocumentIdFromSupabase(email);
    if (!refUser.data?.code_otp?.hash_code) {
      return res.status(401).json({
        success: false,
        message,
      });
    }

    const timeNow = new Date();
    console.log(refUser.data?.code_otp?.expires_at, timeNow);

    if (refUser.data?.code_otp?.expires_at < new Date()) {
      console.log("'auth.middleware'");

      return res.status(401).json({
        success: false,
        message: "Session invalid to reset your password.",
      });
    }

    const isMatch = await bcrypt.compare(
      codeOTP,
      refUser.data?.code_otp?.hash_code,
    );
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message,
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const critiqueRoute = async (req, res, next) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: "Not Authenticated" });
    }

    const { token_version } = req.user;

    if (token_version == null) {
      return res
        .status(401)
        .json({ success: false, message: "Not Authenticated" });
    }

    const user = await getUserAndWalletByEmailUserNameDocumentIdFromSupabase(
      req.user.email,
    );

    if (!user || !user.data) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (token_version !== user.data.token_version) {
      return res
        .status(401)
        .json({ success: false, message: "Not Authenticated" });
    }

    if (!req.body.pinTransaction || !user.data.pin_transaction) {
      return res
        .status(400)
        .json({ success: false, message: "Missing transaction pin" });
    }

    const pinMatch = bcrypt.compareSync(
      req.body.pinTransaction,
      user.data.pin_transaction,
    );

    if (!pinMatch) {
      return res.status(401).json({ success: false, message: "Incorrect pin" });
    }
    req.user = user.data.next();
  } catch (error) {
    console.error("Error in critiqueRoute:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const isAdminUser = async (req, res, next) => {
  try {
    // 1. Garante que o middleware de autenticação (JWT) rodou antes deste
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not Authenticated",
      });
    }

    // Ajuste 'user.data.role' para o nome exato da coluna na sua tabela do Supabase
    if (req.user.data.role !== "admin") {
      return res.status(403).json({
        // 403 Forbidden = Entendido, mas sem permissão
        success: false,
        message: "Access denied. Admins only.",
      });
    }

    // 4. Se passou em tudo, permite o acesso à rota prosseguindo para a próxima função
    next();
  } catch (error) {
    console.error("Error in isAdminUser middleware:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export {
  refreshToken,
  privateRoute,
  linkConfirmEmail,
  checkTokenIfTokenNotBlocked,
  verifyCodeOTP,
  critiqueRoute,
  isAdminUser,
};
