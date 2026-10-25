import transactionSupabase from "../models/supabase/transactions.supabase.js";

// p_account_number TEXT,
// p_amount NUMERIC(18,2),
// p_method transaction_method,
// p_type transaction_type,
// p_fee NUMERIC(15, 2) DEFAULT 0.00,
// p_reference_id TEXT DEFAULT NULL,
// p_bar_code TEXT DEFAULT NULL,
// p_digitable_line TEXT DEFAULT NULL,
// p_due_date DATE DEFAULT NULL,
// p_pix_copy_paste TEXT DEFAULT NULL,
// p_pix_end_to_end_id TEXT DEFAULT NULL

const controlTransactions = {
  // Controller for handling wallet-related operations, such as deposits and balance inquiries.
  deposit: async (req, res) => {
    try {
      const {
        account_number,
        amount: a,
        method,
        reference_id,
        bar_code,
        digitable_line,
        pix_copy_paste,
        pix_end_to_end_id,
        validate_only = true,
      } = req.body;
      const amount = Number(a);

      // Validate required fields
      if (!account_number) {
        return res.status(400).json({
          success: false,
          message: "Account_number is required.",
        });
      }

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

      // If method equal pix
      if (method === "pix" && !pix_copy_paste && !pix_end_to_end_id) {
        return res.status(400).json({
          success: false,
          message:
            "For PIX transactions, either Pix_copy_paste or Pix_end_to_end_id is required.",
        });
      }

      if (method === "bank_slip" && !bar_code && !digitable_line) {
        return res.status(400).json({
          success: false,
          message:
            "For Bank_slip transactions, either Bar_code or Digitable_line is required.",
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
        pix_copy_paste,
        pix_end_to_end_id,
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

  withdraw: async (req, res) => {
    try {
      const { account_number, validate_only, email } = req.body;
      const amount = Number(req.body.amount);

      if (!["company", "owner", "admin"].includes(req.user?.type)) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized role.",
        });
      }
      if (
        (!account_number && !email) ||
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "account_number or email and a positive amount are required.",
        });
      }

      const wallet = await transactionSupabase.getWalletByAccount({
        account_number,
        email,
      });
      if (!wallet?.success || !wallet?.account_number) {
        return res.status(404).json({
          success: false,
          message: "Wallet not found.",
        });
      }

      if (validate_only === true || validate_only === "true") {
        return res.status(200).json({
          success: true,
          data: {
            account_number: wallet.account_number,
            active: wallet.active,
            full_name: wallet.full_name,
            profile_id: wallet.profile_id,
          },
        });
      }

      const result = await transactionSupabase.createIntentTransaction({
        wallet_id: wallet.wallet_id,
        amount,
        type: "withdraw",
        nature: "debit",
        reference_id: null,
        description: null,
      });
      if (!result?.success) {
        return res.status(400).json({
          success: false,
          message: result?.error || "Error processing withdrawal.",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Withdrawal successful.",
        data: {
          id: result?.data?.id,
          account_number: wallet.account_number,
          active: wallet.active,
          full_name: wallet.full_name,
          profile_id: wallet.profile_id,
        },
      });
    } catch (error) {
      console.error("[CreateIntentTransactionTransaction]", error);
      return res.status(400).json({
        success: false,
        message: error?.message || "Error processing withdrawal.",
      });
    }
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
          message: result?.error.message || "Error confirming transaction.",
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
