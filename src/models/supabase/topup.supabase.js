import requestDing from "../../apis/ding.js";
import supabase from "./conexion.js";

const modelTopup = {
  createTopup: async (dataTopup, profile_type) => {
    if (dataTopup.validate_only) {
      return await requestDing("SendTransfer", "POST", {
        SkuCode: dataTopup.sku_code,
        SendValue: dataTopup.send_value_net,
        SendCurrencyIso: dataTopup.send_currency?.toUpperCase(),
        AccountNumber: dataTopup.account_number,
        DistributorRef: dataTopup.distributor_ref,
        ValidateOnly: true,
      });
    }

    if (!dataTopup.distributor_ref) {
      return {
        success: false,
        error: "DistributorRef é obrigatório.",
      };
    }

    // p_profile_id UUID,
    // p_type public.profile_type,
    // p_sku_code TEXT,
    // p_send_value NUMERIC,
    // p_account_number TEXT,
    // p_send_currency public.currencies,
    // p_transfer_id TEXT,
    // p_received_value NUMERIC,
    // p_distributor_ref UUID,
    // p_received_currency public.currencies,
    // p_fee NUMERIC,
    // p_fee_provider NUMERIC,
    // p_error_code TEXT,
    // p_error_message TEXT,
    // p_raw_api_response JSONB
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
      p_received_value: dataTopup.received_value,
      p_fee: dataTopup.fee ?? 0,
      p_fee_provider: dataTopup.fee_provider ?? 0,
      p_error_code: null,
      p_error_message: null,
      p_raw_api_response: null,
    });

    console.log(data, error);

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

  getTopupHistory: async (profile_id) => {
    const { data, error } = await supabase.rpc("get_topup_history", {
      p_profile_id: profile_id || null,
    });

    if (error) return { success: false, error };
    return { success: true, data: data || [] };
  },
};

export default modelTopup;
