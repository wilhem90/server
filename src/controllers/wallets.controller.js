import walletSupabase from "../models/supabase/wallets.supabase.js";

const controlWallets = {
  // Controller for handling wallet-related operations, such as deposits and balance inquiries.
  getBalance: async (req, res) => {
    try {
      const wallet = await walletSupabase.getWallet(null, req.user);
      if (!wallet?.success || !wallet?.account_number) {
        return res.status(404).json({
          success: false,
          message: "Wallet not found.",
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          wallet_id: wallet.wallet_id,
          account_number: wallet.account_number,
          active: wallet.active,
          profile_id: wallet.profile_id,
          balance: wallet.balance,
          currency: wallet.currency,
        },
      });
    } catch (error) {
      console.error("[GetBalanceWallet]", error);
      return res.status(400).json({
        success: false,
        message: error?.message || "Error fetching wallet balance.",
      });
    }
  },

  // Controller for handling wallet transaction retrieval.
  getTransactions: async (req, res) => {
    try {
      const wallet = await walletSupabase.getWallet(null, req.user);
      if (!wallet?.success || !wallet?.account_number) {
        return res.status(404).json({
          success: false,
          message: "Wallet not found.",
        });
      }

      const transactions = await walletSupabase.getTransactions(
        wallet.wallet_id,
      );
      if (!transactions?.success) {
        return res.status(400).json({
          success: false,
          message:
            transactions?.error.message || "Error retrieving transactions.",
        });
      }

      return res.status(200).json({
        success: true,
        data: transactions?.data || [],
      });
    } catch (error) {
      console.error("[GetTransactionsWallet]", error);
      return res.status(400).json({
        success: false,
        message: error?.message || "Error retrieving transactions.",
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

      const result = await walletSupabase.confirmTransaction({
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

  getStatements: async (req, res) => {
    try {
      const { user } = req;
      const { limit = 50, offset = 0 } = req.query;
      const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
      const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

      const statements = await walletSupabase.getWalletTransactionBalances(
        user.wallet_id,
        null,
        safeLimit,
        safeOffset,
      );
      if (!statements?.success) {
        return res.status(400).json({
          success: false,
          message: statements?.error.message || "Error retrieving statements.",
        });
      }

      return res.status(200).json({
        success: true,
        data: statements?.data || [],
      });
    } catch (error) {
      console.error("[GetStatementsWallet]", error);
      return res.status(400).json({
        success: false,
        message: error?.message || "Error retrieving statements.",
      });
    }
  },
};

export default controlWallets;
