import supabase from "./conexion.js";

// p_account_number TEXT,
// p_amount NUMERIC(18,2),
// p_method transaction_method,
// p_type transaction_type,
// p_validate_only BOOLEAN DEFAULT true,
// p_fee NUMERIC(15, 2) DEFAULT 0.00,
// p_reference_id TEXT DEFAULT NULL,
// p_bar_code TEXT DEFAULT NULL,
// p_digitable_line TEXT DEFAULT NULL,
// p_pix_copy_paste TEXT DEFAULT NULL,
// p_pix_end_to_end_id TEXT DEFAULT NULL

const transactionSupabase = {
  // Deposit into a wallet. Uses an RPC for atomic increment (recommended).
  createIntentTransaction: async (dataTransaction) => {
    console.log(dataTransaction.validate_only);

    const { data, error } = await supabase.rpc("create_intent_transaction", {
      p_account_number: dataTransaction.account_number,
      p_amount: dataTransaction.amount,
      p_validate_only: Boolean(dataTransaction.validate_only) || false,
      p_bar_code: dataTransaction.bar_code || null,
      p_digitable_line: dataTransaction.digitable_line || null,
      p_fee: dataTransaction.fee || 0.0,
      p_method: dataTransaction.method || null,
      p_pix_copy_paste: dataTransaction.pix_copy_paste || null,
      p_pix_end_to_end_id: dataTransaction.pix_end_to_end_id || null,
      p_reference_id: dataTransaction.reference_id || null,
      p_type: dataTransaction.type,
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, data };
  },

  // Confirm a wallet transaction.
  confirmTransaction: async (dataConfirm) => {
    if (!dataConfirm.transaction_id) {
      return { success: false, error: "transaction_id is required" };
    }

    const { data, error } = await supabase.rpc("confirm_transaction", {
      p_transaction_id: dataConfirm.transaction_id,
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, data };
  },
};

export default transactionSupabase;
