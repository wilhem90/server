CREATE OR REPLACE FUNCTION public.create_topup_from_global_wallet(
  p_skucode text,
  p_phone_number text,
  p_send_value numeric,
  p_user_id uuid DEFAULT NULL,
  p_agent_id uuid DEFAULT NULL,
  p_send_currency text DEFAULT 'BRL',
  p_distributor_ref text DEFAULT NULL,
  p_receive_value numeric DEFAULT NULL,
  p_receive_currency text DEFAULT NULL
)
RETURNS TABLE (
  topup_id uuid,
  statement_id uuid,
  company_id uuid,
  wallet_id uuid,
  status text,
  balance_after numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id uuid;
  v_company_count integer;
  v_company_ids uuid[];
  v_wallet_id uuid;
  v_statement_id uuid;
  v_topup_id uuid;
  v_balance_before numeric;
  v_balance_after numeric;
  v_existing_topup public.topups%ROWTYPE;
BEGIN
  IF (p_user_id IS NULL AND p_agent_id IS NULL)
     OR (p_user_id IS NOT NULL AND p_agent_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Informe p_user_id ou p_agent_id, mas não os dois';
  END IF;

  IF p_skucode IS NULL OR btrim(p_skucode) = '' THEN
    RAISE EXCEPTION 'skucode é obrigatório';
  END IF;

  IF p_phone_number IS NULL OR btrim(p_phone_number) = '' THEN
    RAISE EXCEPTION 'phone_number é obrigatório';
  END IF;

  IF p_send_value IS NULL OR p_send_value <= 0 THEN
    RAISE EXCEPTION 'send_value deve ser maior que zero';
  END IF;

  IF p_send_currency IS NULL OR btrim(p_send_currency) = '' THEN
    RAISE EXCEPTION 'send_currency é obrigatório';
  END IF;

  IF p_receive_value IS NULL OR p_receive_value <= 0 THEN
    RAISE EXCEPTION 'receive_value deve ser maior que zero';
  END IF;

  IF p_receive_currency IS NULL OR btrim(p_receive_currency) = '' THEN
    RAISE EXCEPTION 'receive_currency é obrigatório';
  END IF;

  IF p_distributor_ref IS NULL OR btrim(p_distributor_ref) = '' THEN
    RAISE EXCEPTION 'distributor_ref é obrigatório para idempotência';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('topup:' || btrim(p_distributor_ref), 0)
  );

  SELECT t.*
    INTO v_existing_topup
  FROM public.topups AS t
  WHERE t.distributor_ref = btrim(p_distributor_ref)
  LIMIT 1;

  IF FOUND THEN
    SELECT
      s.wallet_id,
      w.company_id,
      s.balance_after
    INTO
      wallet_id,
      company_id,
      balance_after
    FROM public.statements AS s
    JOIN public.wallets AS w ON w.id = s.wallet_id
    WHERE s.id = v_existing_topup.statement_id;

    topup_id := v_existing_topup.id;
    statement_id := v_existing_topup.statement_id;
    status := v_existing_topup.status;
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_agent_id IS NOT NULL THEN
    SELECT a.company_id
      INTO v_company_id
    FROM public.agents AS a
    JOIN public.companies AS c ON c.id = a.company_id
    WHERE a.id = p_agent_id
      AND a.status = 'active'
      AND c.is_active = 'active';

    IF v_company_id IS NULL THEN
      RAISE EXCEPTION 'agente inexistente, inativo ou loja inativa';
    END IF;
  ELSE
    IF NOT EXISTS (
      SELECT 1
      FROM public.users AS u
      WHERE u.id = p_user_id
        AND u.status = 'active'
    ) THEN
      RAISE EXCEPTION 'usuário inexistente ou inativo';
    END IF;

    SELECT
      count(*)::integer,
      array_agg(uc.company_id)
    INTO
      v_company_count,
      v_company_ids
    FROM (
      SELECT c.id AS company_id
      FROM public.companies AS c
      WHERE c.owner_id = p_user_id
        AND c.is_active = 'active'

      UNION

      SELECT cm.company_id
      FROM public.company_members AS cm
      JOIN public.companies AS c ON c.id = cm.company_id
      WHERE cm.user_id = p_user_id
        AND cm.status = 'active'
        AND c.is_active = 'active'
    ) AS uc;

    IF v_company_count = 0 THEN
      RAISE EXCEPTION 'usuário não está associado a nenhuma loja ativa';
    END IF;

    IF v_company_count > 1 THEN
      RAISE EXCEPTION 'usuário está associado a mais de uma loja ativa; use um agente para identificar a loja';
    END IF;

    v_company_id := v_company_ids[1];
  END IF;

  SELECT
    w.id,
    w.balance
  INTO
    v_wallet_id,
    v_balance_before
  FROM public.wallets AS w
  WHERE w.company_id = v_company_id
    AND w.user_id IS NULL
    AND w.type_wallet = 'global_wallet'::public.type_wallet
    AND w.currency = upper(btrim(p_send_currency))
    AND w.status = 'active'
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'a loja não possui uma global_wallet ativa para a moeda informada';
  END IF;

  IF v_balance_before < p_send_value THEN
    RAISE EXCEPTION 'saldo insuficiente na carteira global da loja';
  END IF;

  v_balance_after := v_balance_before - p_send_value;
  v_statement_id := gen_random_uuid();

  UPDATE public.wallets
  SET
    balance = v_balance_after,
    updated_at = now()
  WHERE id = v_wallet_id;

  INSERT INTO public.statements (
    id,
    wallet_id,
    type,
    amount,
    description,
    created_at,
    balance_before,
    balance_after,
    method_payment,
    nature,
    status,
    agent_id,
    user_id
  )
  VALUES (
    v_statement_id,
    v_wallet_id,
    'purchase',
    p_send_value,
    'Topup via carteira global',
    now(),
    v_balance_before,
    v_balance_after,
    'cash',
    'topup',
    'processing',
    p_agent_id,
    p_user_id
  );

  INSERT INTO public.topups (
    id,
    user_id,
    skucode,
    phone_number,
    send_value,
    send_currency,
    distributor_ref,
    statement_id,
    status,
    agent_id,
    receive_value,
    receive_currency,
    created_at
  )
  VALUES (
    gen_random_uuid(),
    p_user_id,
    btrim(p_skucode),
    btrim(p_phone_number),
    p_send_value,
    upper(btrim(p_send_currency)),
    btrim(p_distributor_ref),
    v_statement_id,
    'pending',
    p_agent_id,
    p_receive_value,
    upper(btrim(p_receive_currency)),
    now()
  )
  RETURNING id INTO v_topup_id;

  topup_id := v_topup_id;
  statement_id := v_statement_id;
  company_id := v_company_id;
  wallet_id := v_wallet_id;
  status := 'pending';
  balance_after := v_balance_after;
  RETURN NEXT;
END;
$$;