import supabase from "./conexion.js";

const transferModel = {
  createTransfer: async (dataTransfer) => {

    const { data, error } = await supabase.rpc("create_intent_transaction", {
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
        error,
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
    const dateNow = new Date();
    let end_date;
    let start_date;
    if (!startDate && !endDate) {
      start_date = new Date(dateNow.setDate(dateNow.getDate() - 30));
      end_date = dateNow;
    }
    if (startDate) {
      start_date = startDate;
    }
    if (endDate) {
      end_date = endDate;
    }

    const { data, error } = await supabase.rpc("get_transfers", {
      p_wallet_id: walletId,
      p_employee_id: employeeId,
      p_client_id: clientId,
      p_limit: limit,
      p_offset: offset,
      p_start_date: new Date(start_date),
      p_end_date: new Date(end_date),
    });

    if (error) {
      return {
        success: false,
        error,
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
        error,
      };
    }

    return {
      success: true,
      data,
    };
  },
};

export default transferModel;
