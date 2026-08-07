import supabase from "../configs/supabase.js";

const getWalletUserWithId = async (idUser) => {
  const { data, error } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", idUser);

  if (error) {
    return {
      success: false,
      message: "Wallet not found!",
    };
  }

  return {
    success: true,
    data: data[0],
  };
};

// O usuário escolheu R$ 50 no Pix
const depositFromSupabase = async (dataTransaction) => {
  const { data: transactionId, error } = await supabase.rpc(
    "create_deposit_intent",
    {
      p_user_id: dataTransaction.userId,
      p_method_payment: dataTransaction.method_payment,
      p_amount: dataTransaction.amount,
      p_metadata: dataTransaction.metadata,
      p_external_reference: dataTransaction.external_reference,
    },
  );

  if (error) {
    return { success: false, error };
  }

  return { success: true, transactionId };
};

// O usuário escolheu R$ 50 no Pix
const withdrawalFromSupabase = async (dataTransaction) => {
  console.log(dataTransaction);

  const { data: transactionId, error } = await supabase.rpc(
    "create_withdrawal_intent",
    {
      p_user_id: dataTransaction.userId,
      p_method_payment: dataTransaction.method_payment,
      p_amount: dataTransaction.amount,
      p_external_reference: dataTransaction.external_reference,
      p_metadata: dataTransaction.metadata,
    },
  );

  if (error) {
    return { success: false, error };
  }

  return { success: true, transactionId };
};

// O usuário escolheu R$ 50 no Pix
const reviewTransactionFromSupabase = async (dataTransaction) => {
  const { data: transactionId, error } = await supabase.rpc(
    "review_intent_transaction",
    {
      p_transaction_id: dataTransaction.transactionId,
      p_admin_id: dataTransaction.adminId,
      p_action: dataTransaction.action,
      p_additional_metadata: dataTransaction.metadata,
    },
  );
  if (error) {
    return { success: false, error };
  }

  return { success: true, transactionId };
};

/**
 * Busca as transações do usuário no Supabase com filtros de data e tipo.
 * Caso as datas não sejam enviadas, busca automaticamente o dia atual completo (fuso Haiti UTC-4).
 */
const getUserTransactionFromSupabase = async (
  authenticatedUserId,
  type,
  start_date,
  end_date,
  limit,
  offset,
) => {
  try {
    // 1) Busca a carteira do usuário logado
    const wallets = await getWalletUserWithId(authenticatedUserId);
    const wallet_id = wallets.data?.id;

    if (!wallet_id) {
      return {
        success: false,
        error: "Carteira não encontrada para este usuário.",
      };
    }

    let startDate;
    let endDate;

    // Garante que limit e offset sejam inteiros válidos
    const pageLimit = limit ? parseInt(limit, 10) : 10;
    const pageOffset = offset ? parseInt(offset, 10) : 0;

    // Sanitiza strings nulas vindas do estado do filtro
    const cleanStartDate =
      start_date === "null" || start_date === "undefined" ? null : start_date;
    const cleanEndDate =
      end_date === "null" || end_date === "undefined" ? null : end_date;
    const cleanType = type === "null" || type === "undefined" ? null : type;

    // 2) Tratamento de Datas e Ajuste de Fuso Horário do Haiti (UTC-4)
    if (!cleanStartDate || !cleanEndDate) {
      const now = new Date();

      // Início do dia atual no Haiti (00:00:00 local -> 04:00:00 UTC)
      startDate = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          4,
          0,
          0,
          0,
        ),
      ).toISOString();

      // Fim do dia atual no Haiti (23:59:59 local -> Amanhã 03:59:59 UTC)
      // Passando 27h, o JS calcula nativamente a virada do dia seguinte em UTC de forma limpa
      endDate = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          27,
          59,
          59,
          999,
        ),
      ).toISOString();
    } else {
      // Quando o usuário seleciona as datas manualmente no Date Picker
      const sDate = new Date(cleanStartDate);
      startDate = new Date(
        Date.UTC(
          sDate.getUTCFullYear(),
          sDate.getUTCMonth(),
          sDate.getUTCDate(),
          4,
          0,
          0,
          0,
        ),
      ).toISOString();

      const eDate = new Date(cleanEndDate);
      endDate = new Date(
        Date.UTC(
          eDate.getUTCFullYear(),
          eDate.getUTCMonth(),
          eDate.getUTCDate(),
          27,
          59,
          59,
          999,
        ),
      ).toISOString();
    }

    // 3) Montagem da Query Dinâmica no Supabase
    let query = supabase
      .from("statements")
      .select("*")
      .eq("wallet_id", wallet_id)
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .order("created_at", { ascending: false })
      .range(pageOffset, pageOffset + pageLimit - 1);

    // Aplica o filtro de tipo (ex: 'bet', 'withdrawal') se estiver ativo
    if (cleanType) {
      query = query.eq("type", cleanType);
    }

    // 4) Executa a consulta
    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, transactions: data };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export {
  getWalletUserWithId,
  depositFromSupabase,
  withdrawalFromSupabase,
  reviewTransactionFromSupabase,
  getUserTransactionFromSupabase,
};
