import supabase from "../configs/supabase.js";

const modelTopUp = {
  // Criando TopUp
  createTopUp: async (userData, dataTopup) => {
    console.log(userData);

    const { data, error } = await supabase.rpc(
      "create_topup_from_global_wallet",
      {
        p_skucode: dataTopup.skuCode,
        p_phone_number: dataTopup.accountNumber,
        p_send_value: dataTopup.sendValue,
        p_user_id: userData.userId || null,
        p_agent_id: userData.agentId || null,
        p_send_currency: dataTopup.sendCurrency,
        p_distributor_ref: dataTopup.distributorRef,
        p_receive_value: dataTopup.receiveValue || 10,
        p_receive_currency: dataTopup.receiveCurrency || "USD",
      },
    );

    if (error) {
      console.error("Erro ao criar TopUp:", error);
      throw new Error(error.message || "Erro ao criar TopUp.");
    }

    return data;
  },

  // ✅ Backend - modelTopUp.js
  GetTopups: async (data) => {
    return {
      success: true,
      items: [], // Placeholder for actual topup items
      lastVisible: null,
      totalRead: 0,
    };
  },
};

export default modelTopUp;
