import supabase from "./conexion.js";

const walletSupabase = {
  // Get wallet by account number, including profile information.

  getWallet: async (account_number = null, user) => {
    if (["employee", "admin", "company", "owner"].includes(user?.type)) {
      const { data, error } = await supabase.rpc("get_wallet_company_account", {
        p_profile_id: user?.id || null,
      });
      if (error || !data?.length) {
        console.log("getWallet result:", data, error);
        return { success: false, error: error || "Wallet not found" };
      }
      return {
        success: true,
        wallet_id: data[0].wallet_id,
        account_number: data[0].account_number,
        balance: data[0].balance,
        active: data[0].active,
        profile_id: data[0].profile_id,
      };
    }

    const { data, error } = await supabase.rpc("get_wallet_account", {
      p_profile_id: user?.id,
      p_account_number: account_number || null,
      p_email: user?.email || null,
    });

    if (error || !data?.length) {
      console.log("getWallet result:", data, error);
      return { success: false, error: error || "Wallet not found" };
    }

    return {
      success: true,
      wallet_id: data[0].wallet_id,
      account_number: data[0].account_number,
      balance: data[0].balance,
      active: data[0].active,
      profile_id: data[0].profile_id,
    };
  },

  // Find the destination wallet by the informed account number or email.
  getWalletByAccount: async ({ account_number, email }) => {
    const { data, error } = await supabase.rpc("get_wallet_account", {
      p_profile_id: null,
      p_account_number: account_number || null,
      p_email: email || null,
    });

    if (error || !data?.length) {
      console.log("getWalletByAccount result:", data, error);
      return { success: false, error: error || "Wallet not found" };
    }

    return {
      success: true,
      wallet_id: data[0].wallet_id,
      account_number: data[0].account_number,
      balance: data[0].balance,
      active: data[0].active,
      profile_id: data[0].profile_id,
      full_name: data[0].full_name,
    };
  },

  // Deposit into a wallet. Uses an RPC for atomic increment (recommended).
  createIntentTransaction: async (dataDeposit) => {
    if (dataDeposit.amount <= 0) {
      return { success: false, error: "Amount must be positive" };
    }

    if (!dataDeposit.wallet_id) {
      return { success: false, error: "Wallet ID is required" };
    }

    const { data, error } = await supabase.rpc("create_intent_transaction", {
      p_wallet_id: dataDeposit.wallet_id,
      p_amount: dataDeposit.amount,
      p_type: dataDeposit.type,
      p_nature: dataDeposit.nature,
      p_reference_id: dataDeposit.reference_id || null,
      p_description: dataDeposit.description || null,
    });

    if (error) return { success: false, error };
    console.log("createIntentTransaction result:", data, error);
    return { success: true, ...data };
  },

  // Get transactions for a wallet by wallet ID.
  getTransactions: async (wallet_id) => {
    if (!wallet_id) {
      return { success: false, error: "Wallet ID is required" };
    }

    const { data, error } = await supabase.rpc("get_wallet_transactions", {
      p_wallet_id: wallet_id,
    });

    if (error) return { success: false, error };
    return { success: true, data: data || [] };
  },

  // Confirm a wallet transaction.
  confirmTransaction: async (dataConfirm) => {
    if (!dataConfirm.transaction_id) {
      return { success: false, error: "transaction_id is required" };
    }

    const { data, error } = await supabase.rpc("confirm_transaction", {
      p_transaction_id: dataConfirm.transaction_id,
    });

    if (error) return { success: false, error };
    return { success: true, ...data };
  },

  // Get wallet transaction balances.
  getWalletTransactionBalances: async (
    wallet_id,
    profile_id,
    limit,
    offset,
  ) => {
    const { data, error } = await supabase.rpc(
      "get_wallet_transaction_balances",
      {
        p_wallet_id: wallet_id || null,
        p_profile_id: profile_id || null,
        p_limit: limit || 50,
        p_offset: offset || 0,
      },
    );

    if (error) return { success: false, error };
    return { success: true, data: data || [] };
  },
};

export default walletSupabase;
