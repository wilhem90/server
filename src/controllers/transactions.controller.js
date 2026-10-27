import transactionSupabase from "../models/supabase/transactions.supabase.js";

const controlTransactions = {
  // Controller for handling wallet-related operations, such as deposits and balance inquiries.
  deposit: async (req, res) => {
    try {
      const {
        amount: a,
        method,
        reference_id,
        bar_code,
        digitable_line,
      } = req.body;
      const amount = Number(a);

      // Validate required fields
      if (!Number.isFinite(amount) || amount <= 0 || amount > 5000) {
        return res.status(400).json({
          success: false,
          message: "Amount must be a positive number (max 5000).",
        });
      }

      if (!method) {
        return res.status(400).json({
          success: false,
          message: "Method is required.",
        });
      }

      const validate_only = !(
        req.body.validate_only === false || req.body.validate_only === "false"
      );
      const account_number = req.user?.wallet_account_number;

      if (!account_number) {
        return res.status(400).json({
          success: false,
          message: "User has no wallet.",
        });
      }
      // Generate a unique reference ID UUID for the transaction
      const ref_id = crypto.randomUUID();

      const result = await transactionSupabase.createIntentTransaction({
        account_number,
        amount,
        type: "deposit",
        validate_only,
        nature: "credit",
        method,
        reference_id: reference_id || ref_id,
        bar_code,
        digitable_line,
        pix_copy_paste: Math.random().toString(36).substring(2, 15),
        pix_end_to_end_id: Math.random().toString(36).substring(2, 15),
        description: null,
      });
      if (!result?.success) {
        return res.status(400).json({
          success: false,
          message: result?.error || "Error processing deposit.",
        });
      }

      return res.status(200).json({
        success: true,
        message: validate_only
          ? "Validation successful."
          : "Deposit successful.",
        data: { ...result?.data },
      });
    } catch (error) {
      console.error("[CreateIntentTransactionTransaction]", error);
      return res.status(400).json({
        success: false,
        message: error?.message || "Error processing deposit.",
      });
    }
  },

  // Withdrawals are not implemented yet: the SQL function only supports
  // deposits, and no wallet lookup exists in this module.
  withdraw: async (req, res) => {
    return res.status(501).json({
      success: false,
      message: "Withdrawals are not implemented yet.",
    });
  },
  // Controller for handling wallet transaction confirmations.
  confirmTransaction: async (req, res) => {
    try {
      if (req.user?.type !== "superadmin") {
        return res.status(403).json({
          success: false,
          message: "Unauthorized role to confirm transactions.",
        });
      }

      const { transaction_id } = req.body;
      if (!transaction_id) {
        return res.status(400).json({
          success: false,
          message: "transaction_id is required.",
        });
      }

      const result = await transactionSupabase.confirmTransaction({
        transaction_id,
      });

      if (!result?.success) {
        return res.status(400).json({
          success: false,
          message: result?.error || "Error confirming transaction.",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Transaction confirmed successfully.",
      });
    } catch (error) {
      console.error("[ConfirmTransactionWallet]", error);
      return res.status(400).json({
        success: false,
        message: error?.message || "Error confirming transaction.",
      });
    }
  },
};

export default controlTransactions;
