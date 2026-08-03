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

const getUserTransactionFromSupabase = async (
  authenticatedUserId,
  type,
  start_date,
  end_date,
  limit,
  offset,
) => {
  const wallets = await getWalletUserWithId(authenticatedUserId);
  const wallet_id = wallets.data.id;
  console.log(wallet_id);

  let startDate;
  let endDate;

  // 1) Garante que limit e offset sejam números válidos
  const pageLimit = limit ? parseInt(limit, 10) : 10;
  const pageOffset = offset ? parseInt(offset, 10) : 0;

  const cleanStartDate =
    start_date === "null" || start_date === "undefined" ? null : start_date;
  const cleanEndDate =
    end_date === "null" || end_date === "undefined" ? null : end_date;

  // 2) Ajuste de fuso horário brasileiro (UTC-3)
  if (!cleanStartDate || !cleanEndDate) {
    const now = new Date();

    // Início do dia (00:00:00 BRT -> 03:00:00 UTC)
    startDate = new Date(
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 3, 0, 0, 0),
    ).toISOString();

    // Fim do dia (23:59:59 BRT -> Amanhã 02:59:59 UTC)
    endDate = new Date(
      Date.UTC(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        2,
        59,
        59,
        999,
      ),
    ).toISOString();
  } else {
    startDate = new Date(cleanStartDate).toISOString(); // Garantindo conversão limpa se toIso não existir
    endDate = new Date(cleanEndDate).toISOString();
  }

  const cleanType = type === "null" || type === "undefined" ? null : type;

  // 3) Montagem da Query (REMOVIDO o await inicial para permitir encadeamento dinâmico)
  let query = supabase
    .from("statements")
    .select("*")
    .eq("wallet_id", wallet_id) // CRÍTICO: Filtrar apenas a carteira/usuário logado
    .gte("created_at", startDate)
    .lte("created_at", endDate)
    .order("created_at", { ascending: false })
    .range(pageOffset, pageOffset + pageLimit - 1);

  // Filtro condicional funciona perfeitamente agora
  if (cleanType) {
    query = query.eq("type", cleanType); // CORREÇÃO: Alterado de 'operation_type' para 'type' conforme seu DDL
  }

  // 4) Executa a query apenas aqui no final
  const { data, error } = await query;

  if (error) return { success: false, error };
  return { success: true, transactions: data };
};

export {
  getWalletUserWithId,
  depositFromSupabase,
  withdrawalFromSupabase,
  reviewTransactionFromSupabase,
  getUserTransactionFromSupabase,
};
