import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

import {
  getSubUsersFromSupabase,
  getUserAndWalletByEmailUserNameDocumentIdFromSupabase,
  registerUserFromSupabase,
  updateUserFromSupabase,
} from "../db/user.db.js";
import bcrypt from "bcrypt";
import { blockTokenNow } from "../db/auth.db.js";
import welcomeEmail from "../mails/welcomeEmail.js";
import sendEmail from "../configs/nodemailer.js";
import codeOtpTemplate from "../mails/codeOtpTemplate.js";
import limiter from "../configs/limiter.js";
import { v4 } from "uuid";

//Register user
const registerUser = async (req, res, next) => {
  try {
    const validatedData = req.body;

    // Criptografia da Senha
    const saltRounds = 10;
    const hashedData = async (data) => {
      return await bcrypt.hash(data, saltRounds);
    };

    const dataUser = {
      ...validatedData,
      ...req.body.address,
      password_hash: await hashedData(validatedData.password),
      userName: String(validatedData.user_name).toLocaleLowerCase(),
    };
    const refUser = await registerUserFromSupabase(dataUser);

    if (!refUser.success) {
      if (refUser.error.message.includes("users_email_key")) {
        return res.status(409).json({
          success: false,
          message: "Email already registered.",
        });
      }

      if (refUser.error.message.includes("users_user_name_key")) {
        return res.status(409).json({
          success: false,
          message: "Username already exists.",
        });
      }
    }

    next();
  } catch (error) {
    console.error("Erro no registro de usuário:", error);
    return res.status(500).json({
      success: false,
      message: "Oops, something went wrong. Please try again later.",
    });
  }
};

const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Email and password are required for login!",
    });
  }

  try {
    // 1. Busca usuário e carteira juntos
    const userResult =
      await getUserAndWalletByEmailUserNameDocumentIdFromSupabase(
        String(email).toLowerCase(),
      );
    if (!userResult.success) {
      return res.status(400).json({
        success: false,
        message: "Credentials invalid.",
      });
    }

    const user = userResult.data;

    // 2. Valida se o e-mail foi confirmado
    if (!user.email_confirmed) {
      return res.status(401).json({
        success: false,
        message: "Account pending confirmation email.",
      });
    }

    // 3. Valida a senha hash com bcrypt
    const password_match = await bcrypt.compare(password, user.password_hash);
    if (!password_match) {
      return res.status(400).json({
        success: false,
        message: "Credentials invalid.",
      });
    }

    const JWT_SECRET = process.env.JWT_SECRET;
    const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

    // 5. Geração do Access Token com novos dados inclusos (dados estáticos úteis)
    const token = jwt.sign(
      {
        uuid: user.id,
        email: user.email,
        name: user.first_name,
        status: user.status,
        role: user.role,
        account: user.wallets[0].number_account ?? null,
        currency: user.wallets[0].currency ?? "BRL",
        statusWallet: user.wallets[0].status,
      },
      JWT_SECRET,
      { expiresIn: "30d" },
    );

    // 6. Geração do Refresh Token (apenas identificador seguro)
    const refreshToken = jwt.sign({ uuid: user.uuid }, REFRESH_SECRET, {
      expiresIn: "7d",
    });

    // 7. Cálculo exato do tempo de expiração do Token para o frontend
    const expirationDate = new Date();
    expirationDate.setMinutes(expirationDate.getMinutes() + 15);

    // 8. Atualiza o último login do usuário no Supabase
    await updateUserFromSupabase(email, { last_login_at: new Date() });

    // 9. Retorno de sucesso para o cliente
    return res.status(200).json({
      success: true,
      message: "Login successfully.",
      email,
      token,
      expiresIn: expirationDate.toISOString(),
      refreshToken,
    });
  } catch (error) {
    console.error("Erro no fluxo de login:", error);
    return res.status(500).json({
      success: false,
      message: "Opss something went wrong please try again later.",
    });
  }
};

//Get use by email
const getUserByEmailUserNameDocumentId = async (req, res) => {
  try {
    const { identifier } = req.params;

    if (!identifier) {
      return res.status(400).json({
        success: false,
        message: "identifier required.",
      });
    }
    const refUser =
      await getUserAndWalletByEmailUserNameDocumentIdFromSupabase(identifier);

    if (!refUser.success) {
      throw new Error(refUser.error.message);
    }

    const subuserResult = await getSubUsersFromSupabase(refUser.data.id);
    refUser.data.subusers = subuserResult.success ? subuserResult.data : [];
    delete refUser.data.password_hash;
    delete refUser.data.pin_transaction;
    delete refUser.data.uuid;
    delete refUser.data.code_otp;

    return res.status(200).json({
      success: true,
      data: {
        ...refUser.data,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//Confirm email
const confirmEmailUser = async (req, res) => {
  try {
    const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL;
    const responseConfirmEmail = await updateUserFromSupabase(req.user.email, {
      email_confirmed: true,
    });

    console.log(responseConfirmEmail);

    if (!responseConfirmEmail.success) {
      return res.status(400).json({
        success: false,
        message: "Something went wrong!",
      });
    }

    const user = await getUserAndWalletByEmailUserNameDocumentIdFromSupabase(
      req.user.email,
    );
    return res
      .status(200)
      .send(welcomeEmail(user.data.first_name, "Pasyans", SUPPORT_EMAIL));
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//Update user
const updateUser = async (req, res) => {
  try {
    const fieldsValid = [
      "phone",
      "first_name",
      "last_name",
      "document_id",
      "birthday",
      "new_password",
    ];

    const fields = {};

    fieldsValid.forEach((element) => {
      if (req.body[element]) {
        fields[element] = req.body[element];
      }
    });

    if (fields.new_password) {
      fields.password_hash = bcrypt.hashSync(fields.new_password, 10);
      delete fields.new_password;
    }

    fields.code_otp = {
      hash_code: null,
      expires_at: null,
    };

    fields.token_version = v4();
    const refUpdate = await updateUserFromSupabase(req.body.email, fields);

    return res.status(200).json({
      success: true,
      message: "Data updated!",
      refUpdate,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const resetPasswordByEmail = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required to recover your password.",
      });
    }

    // Find user
    const refUser =
      await getUserAndWalletByEmailUserNameDocumentIdFromSupabase(email);

    if (!refUser.success || !refUser.data?.email) {
      // Don't reveal if email exists or not (security)
      return res.status(200).json({
        success: true,
        message:
          "If this email is registered, you will receive a recovery code.",
      });
    }

    // Generate and store OTP
    const codeOtp = String(Math.floor(100_000 + Math.random() * 900_000));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const code_otp = {
      hash_code: bcrypt.hashSync(codeOtp, 10),
      expires_at: expiresAt,
    };

    // Prepare email data
    const date = new Date();
    const userAgent = req.headers["user-agent"] || "Unknown Browser";
    const ipAddress = req.ip || req.connection.remoteAddress || "Unknown IP";

    // Send email
    const emailResult = await sendEmail(
      refUser.data.email,
      "Recovery password",
      codeOtpTemplate(
        codeOtp,
        15,
        refUser.data.first_name,
        date.toLocaleString("pt-br"),
        userAgent,
        ipAddress,
      ),
    );

    if (!emailResult.success) {
      console.error(
        `Failed to send password reset email to ${email}:`,
        emailResult.error,
      );
      return res.status(500).json({
        success: false,
        message: "Failed to send recovery email. Please try again later.",
      });
    }

    await updateUserFromSupabase(refUser.data.email, { code_otp });

    return res.status(200).json({
      success: true,
      message: "Recovery code sent to your email.",
      // Add optional: resend_after: 60 // seconds
    });
  } catch (error) {
    console.error("Password reset error:", {
      email: req.params.email,
      error: error.message,
    });

    return res.status(500).json({
      success: false,
      message: "An internal error occurred. Please try again later.",
    });
  }
};

// Get my subuser
const getMySubuser = async (req, res) => {
  try {
    const userId = req.user.id;
    const subusersResult = await getSubUsersFromSupabase(userId);

    if (!subusersResult.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve subusers.",
      });
    }

    return res.status(200).json({
      success: true,
      data: subusersResult.data,
    });
  } catch (error) {
    console.error("Error retrieving subusers:", error);
    return res.status(500).json({
      success: false,
      message: "An internal error occurred. Please try again later.",
    });
  }
};

export {
  getUserByEmailUserNameDocumentId,
  registerUser,
  loginUser,
  confirmEmailUser,
  updateUser,
  resetPasswordByEmail,
  getMySubuser,
};
