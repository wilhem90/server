import { success } from "zod";
import supabase from "../configs/supabase.js";

const createBetFromSupabase = async (
  userId,
  lotteryName,
  period,
  amount,
  chosen_values,
  externalReference,
  pinTransaction,
) => {
  const { data, error } = await supabase.rpc("create_bet_transaction", {
    p_user_id: userId,
    p_lottery_name: lotteryName,
    p_period: period,
    p_amount: amount,
    p_external_reference: externalReference,
    p_values: chosen_values, // O objeto chosen_values do JS entra como JSONB no p_values
    p_potential_payout: 0,
  });

  if (error) {
    console.log(error);
    return { success: false, error };
  }

  // data é o ticket_ref (UUID) retornado pela função RPC do PostgreSQL
  return { success: true, ticketRef: data };
};

const getAllBetLotteriesFromSupabase = async ({
  uuid,
  startDate,
  endDate,
  lotteryName,
  limit = 20,
  offset = 0,
  period,
  ticketId,
}) => {
  try {
    if (!uuid) {
      return { success: false, error: "O parâmetro uuid é obrigatório." };
    }

    // 1) CORREÇÃO DO JOIN: bets -> statements -> wallets (através do user_id)
    // Usamos statements!inner para filtrar apenas as apostas da carteira do usuário logado
    let query = supabase
      .from("bets")
      .select("*, statements!inner(wallet_id, wallets!inner(user_id))", {
        count: "exact",
      })
      .eq("statements.wallets.user_id", uuid)
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    // 2) Filtros dinâmicos opcionais
    if (lotteryName) {
      query = query.eq("lottery_name", lotteryName);
    }
    if (period) {
      query = query.eq("period", period);
    }
    if (ticketId) {
      query = query.eq("ticket_number", ticketId);
    }

    // 3) Paginação e Ordenação
    query = query
      .range(offset, offset + limit - 1)
      .order("created_at", { ascending: false });

    const { data, error, count } = await query;

    if (error) {
      console.error("Erro Supabase:", error.message);
      return { success: false, error: error.message };
    }

    // 4) Limpa os nós de join internos para o front-end receber um objeto limpo
    const cleanData = data
      ? data.map(({ statements, ...ticket }) => ticket)
      : [];

    return {
      success: true,
      data: cleanData,
      meta: {
        totalRecords: count,
        limit,
        offset,
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

// Cancel ticket - Mantido original (perfeito usando RPC)
const cancelTicketFromSupabse = async (p_user_id, p_id_ticket, reason) => {
  const { data, error } = await supabase.rpc("cancel_bet_pending", {
    p_user_id,
    p_id_ticket,
    p_cancel_reason: reason ?? null,
  });
  if (error) {
    return { success: false, error };
  }
  return { success: true, data };
};

// Get Lotteries - Mantido original (simples e correto)
const getLotteriesFromSupabase = async () => {
  const { data, error } = await supabase.from("lotteries").select("*");
  if (error) {
    return { success: false, error };
  }
  return { success: true, data };
};

//Save ticket winning
const runLotteryDrawFromSupabase = async (
  lotteryName,
  period,
  dateLottery,
  sorted,
) => {
  // 2. Dispara a lógica pesada diretamente no Banco de Dados
  const { error } = await supabase.rpc("run_lottery_draw", {
    p_lottery_name: lotteryName,
    p_period: period,
    p_date_lottery: dateLottery,
    p_sorted: sorted,
  });

  if (error) {
    return { success: false, error };
  }

  // Retorna a lista de resultados processada com sucesso
  return {
    success: true,
    message: "Lottery draw processed successfully.",
  };
};

const getAllSortedFromSupabase = async ({
  startDate,
  endDate,
  lotteryName,
  limit,
  offset,
}) => {

  const query = supabase
    .from("winning_numbers")
    .select("*")
    .gte("date_lottery", startDate)
    .lte("date_lottery", endDate);

  const { data, error } = await query;
  if (error) {
    return { success: false, error };
  }

  // Retorna a lista
  return {
    success: true,
    data,
  };
};
export {
  createBetFromSupabase,
  getAllBetLotteriesFromSupabase,
  runLotteryDrawFromSupabase,
  cancelTicketFromSupabse,
  getLotteriesFromSupabase,
  getAllSortedFromSupabase,
};
