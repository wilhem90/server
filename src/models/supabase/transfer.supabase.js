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
    limit = 100,
    offset = 0,
    startDate,
    endDate,
  } = {}) => {
    try {
      if (!walletId && !employeeId && !clientId) {
        return {
          success: false,
          error:
            "Informe ao menos um filtro: carteira, funcionário ou cliente.",
        };
      }

      const parseDate = (value, label) => {
        if (value == null || value === "") return null;

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
          throw new Error(`${label} inválida.`);
        }

        return date.toISOString();
      };

      const p_end_date = parseDate(endDate, "Data final");
      const p_start_date =
        parseDate(startDate, "Data inicial") ??
        new Date(
          (p_end_date ? new Date(p_end_date) : new Date()).getTime() -
            30 * 24 * 60 * 60 * 1000,
        ).toISOString();

      if (p_end_date && new Date(p_start_date) > new Date(p_end_date)) {
        return {
          success: false,
          error: "A data inicial não pode ser posterior à data final.",
        };
      }

      const safeLimit = Number(limit);
      const safeOffset = Number(offset);

      if (!Number.isInteger(safeLimit) || safeLimit < 1 || safeLimit > 1000) {
        return {
          success: false,
          error: "O limite deve ser um inteiro entre 1 e 1000.",
        };
      }

      if (!Number.isInteger(safeOffset) || safeOffset < 0) {
        return {
          success: false,
          error: "O offset deve ser um inteiro igual ou maior que zero.",
        };
      }

      console.log("p_start_date:", p_start_date, "p_end_date:", p_end_date);

      const { data, error } = await supabase.rpc("get_transfers", {
        p_wallet_id: walletId ?? null,
        p_employee_id: employeeId ?? null,
        p_client_id: clientId ?? null,
        p_start_date,
        p_end_date,
        p_limit: safeLimit,
        p_offset: safeOffset,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data ?? [] };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao buscar transferências.",
      };
    }
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

  updateTransfer: async ({
    status,
    transferId,
    agentId,
    transferExterneId,
  }) => {
    try {
      const { data, error } = await supabase.rpc("update_transfer", {
        p_status: status,
        p_transfer_id: transferId,
        p_agent_id: agentId,
        p_transfer_externe_id: transferExterneId || null,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao atualizar transferência.",
      };
    }
  },
};

export default transferModel;
