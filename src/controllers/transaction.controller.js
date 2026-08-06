import { v4 as uuidv4 } from "uuid";
console.log(uuidv4());

import {
  reviewTransactionFromSupabase,
  depositFromSupabase,
  withdrawalFromSupabase,
  getUserTransactionFromSupabase,
} from "../db/transaction.db.js";

const deposit = async (req, res) => {
  try {
    const { amount, description, externalReference } = req.body;

    if (!amount) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount.",
      });
    }

    const value = Number(amount);

    if (!externalReference) {
      return res.status(400).json({
        success: false,
        message: "External reference is required.",
      });
    }

    if (Number.isNaN(value) || value <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount.",
      });
    }

    const refDeposit = await depositFromSupabase({
      userId: req.user.uuid,
      method_payment: "pix", // Assuming the payment method is Pix
      amount: value,
      metadata: { description },
      external_reference: externalReference,
    });

    if (!refDeposit.success) {
      if (refDeposit.error.code === "23505") {
        return res.status(400).json({
          success: false,
          message: "Error external_reference code already exists.",
        });
      }
      return res.status(400).json({
        success: false,
        message: refDeposit.error.message,
      });
    }

    return res.status(201).json({
      success: true,
      data: {
        transactionId: refDeposit.transactionId,
        amount: Number(value).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        }),
        description,
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const withdrawal = async (req, res) => {
  try {
    const { amount, description, externalReference } = req.body;

    const value = Number(amount);

    if (Number.isNaN(value) || value <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount.",
      });
    }

    if (!externalReference) {
      return res.status(400).json({
        success: false,
        message: "External reference is required.",
      });
    }

    const refWithdrawal = await withdrawalFromSupabase({
      userId: req.user.uuid,
      method_payment: "pix", // Assuming the payment method is Pix
      amount: value,
      external_reference: externalReference,
      metadata: { description },
    });

    if (!refWithdrawal.success) {
      if (refWithdrawal.error.code === "23505") {
        return res.status(400).json({
          success: false,
          message: "Error external_reference code already exists.",
        });
      }
      return res.status(400).json({
        success: false,
        message: refWithdrawal.error.message,
      });
    }

    return res.status(201).json({
      success: true,
      data: {
        transactionId: refWithdrawal.transactionId,
        amount: Number(value).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        }),
        description,
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const reviewTransaction = async (req, res) => {
  try {
    const { transactionId, externalReference, metadata, action } = req.body;

    const refReviewTansaction = await reviewTransactionFromSupabase({
      transactionId,
      adminId: req.user.uuid,
      action,
      metadata,
    });

    if (!refReviewTansaction.success) {
      if (refReviewTansaction.error.code === "23505") {
        return res.status(400).json({
          success: false,
          message: "Error external_reference code already exists.",
        });
      }
      return res.status(400).json({
        success: false,
        message: refReviewTansaction.error.message,
      });
    }

    return res.status(201).json({
      success: true,
      data: {
        transactionId,
        externalReference,
        metadata,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const transactionHistory = async (req, res) => {
  try {
    // Implement the logic to fetch transaction history from Supabase
    const { type, start_date, end_date, limit, offset } = req.query;

    const refTransactionHistory = await getUserTransactionFromSupabase(
      req.user.uuid,
      type,
      start_date,
      end_date,
      limit,
      offset,
    );

    if (!refTransactionHistory.success) {
      return res.status(400).json({
        success: false,
        message: refTransactionHistory.error.message,
      });
    }

    return res.status(200).json({
      success: true,
      data: refTransactionHistory.transactions,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export { deposit, withdrawal, reviewTransaction, transactionHistory };
