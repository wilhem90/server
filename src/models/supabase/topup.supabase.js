import requestDing from "../../apis/ding.js";
import supabase from "./conexion.js";

const modelTopup = {
  createTopup: async (dataTopup, profile_type) => {
    const validate_received_value = await requestDing("SendTransfer", "POST", {
      SkuCode: dataTopup.sku_code,
      SendValue: dataTopup.send_value_net,
      SendCurrencyIso: dataTopup.send_currency?.toUpperCase(),
      AccountNumber: dataTopup.account_number,
      DistributorRef: dataTopup.distributor_ref,
      ValidateOnly: true,
    });

    if (!dataTopup.distributor_ref) {
      return {
        success: false,
        error: "DistributorRef é obrigatório.",
      };
    }

    console.log("validate_received_value:", validate_received_value);

    if (!validate_received_value?.success) {
      return {
        success: false,
        error: "Validation with Ding failed.",
      };
    }

    const received_value =
      validate_received_value?.data?.TransferRecord?.Price?.ReceiveValue;

    if (!received_value) {
      return {
        success: false,
        error: "Failed to retrieve received value from Ding validation.",
      };
    }

    // 1. Criar registro e debitar a carteira.
    const { data, error } = await supabase.rpc("create_topup", {
      p_profile_id: dataTopup.actor_id,
      p_type: profile_type,
      p_sku_code: dataTopup.sku_code,
      p_send_value: dataTopup.send_value,
      p_account_number: dataTopup.account_number,
      p_send_currency: dataTopup.send_currency,
      p_transfer_id: dataTopup.transfer_id ?? null,
      p_distributor_ref: dataTopup.distributor_ref,
      p_received_currency: dataTopup.received_currency,
      p_received_value: received_value,
      p_fee: dataTopup.fee ?? 0,
      p_fee_provider: dataTopup.fee_provider ?? 0,
      p_error_code: null,
      p_error_message: null,
      p_raw_api_response: null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const topup = Array.isArray(data) ? data[0] : data;

    if (!topup?.id) {
      return {
        success: false,
        error: "The database did not return the top-up ID.",
      };
    }

    // 2. Enviar ao DingConnect.
    const responseDing = await requestDing("SendTransfer", "POST", {
      SkuCode: dataTopup.sku_code,
      SendValue: dataTopup.send_value_net,
      SendCurrencyIso: dataTopup.send_currency?.toUpperCase(),
      AccountNumber: dataTopup.account_number,
      DistributorRef: dataTopup.distributor_ref,
      ValidateOnly: true,
    });

    return { success: true, data: topup, responseDing };
  },

  getTopupById: async (id) => {
    const { data, error } = await supabase.rpc("get_topup_by_statement_id", {
      p_statement_id: id,
    });

    if (error) return { success: false, error };

    return { success: true, data };
  },

  getTopupHistory: async (profile_id) => {
    const { data, error } = await supabase.rpc("get_topup_history", {
      p_profile_id: profile_id || null,
    });

    if (error) return { success: false, error };
    return { success: true, data: data || [] };
  },
};

export default modelTopup;
