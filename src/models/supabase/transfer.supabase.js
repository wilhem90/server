import supabase from "./conexion.js";
import bcrypt from "bcrypt";

const transferModel = {
  createTransfer: async (dataTransfer) => {
    const { data: existingData, error: existingError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", dataTransfer.actorId);

    if (existingError) {
      return {
        success: false,
        error: existingError,
      };
    }

    if (!existingData || existingData.length === 0) {
      return {
        success: false,
        error: "Actor not found",
      };
    }

    if (dataTransfer.pin_transaction == null) {
      return {
        success: false,
        error: "PIN is required",
      };
    }

    const isPinMatch = bcrypt.compareSync(
      String(dataTransfer.pin_transaction),
      existingData[0].pin_transaction,
    );
    if (!isPinMatch) {
      return {
        success: false,
        error: "Invalid PIN",
      };
    }
    const { data, error } = await supabase.rpc("create_transfer", {
      p_wallet_id: dataTransfer.walletId,
      p_created_by: dataTransfer.actorId,
      p_client_id: dataTransfer.client_id,
      p_beneficiary_name: dataTransfer.beneficiary_name?.toLowerCase(),
      p_account_number: dataTransfer.account_number,
      p_operator_name: dataTransfer.operator_name?.toLowerCase(),
      p_send_value: dataTransfer.sendValue,
      p_send_currency: dataTransfer.sendCurrency,
      p_fee: dataTransfer.fee,
      p_fee_commission: dataTransfer.feeCommission,
      p_fee_provider: dataTransfer.feeProvider,
      p_exchange_rate: dataTransfer.exchangeRate,
      p_received_value: dataTransfer.receivedValue,
      p_received_currency: dataTransfer.receivedCurrency,
      p_needed_wallet: dataTransfer.neededWallet,
    });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data: { id: data },
    };
  },

  getTransfers: async ({
    walletId,
    employeeId,
    clientId,
    limit = 50,
    offset = 0,
    startDate,
    endDate,
  }) => {
    const end_date = endDate ? new Date(endDate) : new Date();
    const start_date = startDate
      ? new Date(startDate)
      : new Date(end_date.getTime() - 30 * 24 * 60 * 60 * 1000);

    const { data, error } = await supabase.rpc("get_transfers", {
      p_wallet_id: walletId,
      p_employee_id: employeeId,
      p_client_id: clientId,
      p_limit: limit,
      p_offset: offset,
      p_start_date: start_date,
      p_end_date: end_date,
    });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data,
    };
  },

  getTransferById: async (transferId) => {
    // Pode igual a id ou statement_id, dependendo do contexto
    let { data, error } = await supabase.rpc("get_transfer_by_id", {
      p_statement_id: transferId,
    });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data,
    };
  },
};

export default transferModel;
