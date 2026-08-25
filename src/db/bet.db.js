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

//Buscando tickets
const getAllBetLotteriesFromSupabase = async ({
  uuids, // Recibe el formato de array de Postgres "{id1,id2}"
  startDate,
  endDate,
  lotteryName,
  limit,
  page,
  period,
  ticketId,
}) => {
  try {
    if (!uuids) {
      return {
        success: false,
        error: "O parâmetro uuids é obrigatório.", // Mensaje de error actualizado en plural
      };
    }

    console.log(typeof startDate, endDate);
    // Llamada RPC actualizada con el nuevo nombre del parámetro de Postgres
    const { data, error } = await supabase.rpc("get_bets_report", {
      p_uuids: uuids, // CAMBIADO: 'p_uuid' ahora es 'p_uuids' para mapear al array de Postgres
      p_start_date: startDate,
      p_end_date: endDate,
      p_lottery_name: lotteryName || null,
      p_ticket_id: ticketId || null,
      p_period: period || null,
      p_page: page,
      p_limit: limit,
    });

    console.log(data, error);

    if (error) {
      console.error("Erro RPC get_bets_report:", error);

      return {
        success: false,
        error: error.message,
      };
    }

    const result = data || {};

    return {
      success: true,
      data: Array.isArray(result.data) ? result.data : [],
      meta: {
        page: Number(result.meta?.page || page),
        limit: Number(result.meta?.limit || limit),
        offset: Number(result.meta?.offset || 0),
        totalRecords: Number(result.meta?.totalRecords || 0),
        totalPages: Number(result.meta?.totalPages || 0),
        hasMore: Boolean(result.meta?.hasMore),
      },

      totals: {
        totalBets: Number(result.totals?.totalBets || 0),
        totalAmount: Number(result.totals?.totalAmount || 0),
        totalPayout: Number(result.totals?.totalPayout || 0),
        totalCancelled: Number(result.totals?.totalCancelled || 0),
        approvedBets: Number(result.totals?.approvedBets || 0),
        wonBets: Number(result.totals?.wonBets || 0),
        pendingBets: Number(result.totals?.pendingBets || 0),
        lostBets: Number(result.totals?.lostBets || 0),
        cancelledBets: Number(result.totals?.cancelledBets || 0),
      },
    };
  } catch (error) {
    console.error("Erro inesperado em getAllBetLotteriesFromSupabase:", error);

    return {
      success: false,
      error: error.message,
    };
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

  if (lotteryName) {
    query.eq("lottery_name", lotteryName);
  }

  if (limit) {
    query.limit(limit);
  }
  if (offset) {
    query.offset(offset);
  }
  const { data, error } = await query;

  if (error) {
    return { success: false, error };
  }
  return { success: true, data };
};


export {
  createBetFromSupabase,
  getAllBetLotteriesFromSupabase,
  runLotteryDrawFromSupabase,
  cancelTicketFromSupabse,
  getLotteriesFromSupabase,
  getAllSortedFromSupabase,
};
