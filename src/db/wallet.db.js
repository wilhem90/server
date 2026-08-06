import supabase from "../configs/supabase.js";

const showBalanceFromSupabase = async (id) => {
  const { data, error } = await supabase.rpc("get_user_real_balance", {
    p_user_id: id,
  });

  if (error) {
    console.error("Erro ao buscar saldo via RPC:", error.message);
    return { success: false, error: "Não foi possível buscar o saldo." };
  }

  const userWallet = data[0];

  if (!userWallet) {
    return {
      success: false,
      error: "Carteira não encontrada para este usuário.",
    };
  }

  return {
    success: true,
    data: userWallet,
  };
};

export { showBalanceFromSupabase };
