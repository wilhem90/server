create table IF NOT EXISTS public.users (
  uuid uuid not null default gen_random_uuid (),
  email text,
  phone text NOT NULL,
  user_name TEXT NOT NULL,
  first_name text not null,
  last_name text not null,
  document_id text null,
  birthday date null,
  password_hash text not null,
  status text not null default 'active'::text,
  email_confirmed boolean not null default false,
  last_login_at timestamp with time zone null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint users_pkey primary key (uuid),
  constraint users_email_key unique (email),
  constraint users_user_name_key unique (user_name),
  constraint users_status_check check (
    (
      status = any (
        array[
          'pending'::text,
          'active'::text,
          'blocked'::text,
          'inactive'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists users_document_id_idx on public.users using btree (document_id) TABLESPACE pg_default;

create index IF not exists users_status_idx on public.users using btree (status) TABLESPACE pg_default;

-- create trigger trg_create_user_wallet
-- after INSERT on users for EACH row
-- execute FUNCTION handle_new_user_wallet ();

-- create trigger trg_users_set_updated_at BEFORE
-- update on users for EACH row
-- execute FUNCTION set_updated_at ();




create table public.transactions (
  id uuid not null default gen_random_uuid (),
  wallet_id uuid not null,
  type character varying(30) not null,
  method_payment character varying(30) not null,
  status_transaction character varying(30) not null default 'pending'::character varying,
  amount numeric(15, 4) not null,
  metadata jsonb null,
  created_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  due_at timestamp with time zone null default (now() AT TIME ZONE 'utc'::text),
  constraint transactions_pkey primary key (id),
  constraint transactions_wallet_id_fkey foreign KEY (wallet_id) references wallets (id) on delete RESTRICT,
  constraint check_amount_trans check ((amount > (0)::numeric)),
  constraint check_method_payment check (
    (
      (method_payment)::text = any (
        (
          array[
            'pix'::character varying,
            'payment_internal'::character varying,
            'cash'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint check_status_trans check (
    (
      (status_transaction)::text = any (
        (
          array[
            'pending'::character varying,
            'approved'::character varying,
            'failed'::character varying,
            'canceled'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint check_type_trans check (
    (
      (type)::text = any (
        (
          array[
            'deposit'::character varying,
            'withdrawal'::character varying,
            'transfer_in'::character varying,
            'transfer_out'::character varying,
            'refund'::character varying,
            'purchase'::character varying,
            'fee'::character varying,
            'adjustment'::character varying,
            'bet'::character varying
          ]
        )::text[]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_transactions_wallet_status on public.transactions using btree (wallet_id, status_transaction) TABLESPACE pg_default;

create trigger trg_restrict_transactions BEFORE DELETE
or
update on transactions for EACH row
execute FUNCTION fn_restrict_transaction_updates ();





create or replace function public.reconcile_wallet_transactions_rpc(
  p_period text,
  p_lottery_name text,
  p_sorted jsonb
)
returns jsonb
language plpgsql
security definer
as $$
declare
  bet_rec record;

  payout numeric;

  v_borlette numeric;
  v_married numeric;
  v_lotto3 numeric;
  v_lotto4 numeric;
  v_lotto5 numeric;

  bor_vals jsonb;
  mar_vals jsonb;
  lotto3_vals jsonb;
  lotto4_vals jsonb;
  lotto5_vals jsonb;

  w text;
  coef numeric;

  last_credit_amount numeric;
  has_last_credit boolean;

  v_balance_before numeric;
  v_balance_after numeric;

  v_processed integer := 0;
  v_adjusted integer := 0;
  v_credited integer := 0;
  v_debited integer := 0;
  v_total_credit numeric := 0;
  v_total_debit numeric := 0;
begin
  -- Load coeficientes da loteria ativa do período
  select
    coalesce(l.borlette,0),
    coalesce(l.married,0),
    coalesce(l.lotto_3,0),
    coalesce(l.lotto_4,0),
    coalesce(l.lotto_5,0)
  into
    v_borlette, v_married, v_lotto3, v_lotto4, v_lotto5
  from public.lotteries l
  where l.lottery_name = p_lottery_name
    and l.period = p_period
    and l.status = 'active'
  limit 1;

  if v_borlette = 0 and v_married = 0 and v_lotto3 = 0 and v_lotto4 = 0 and v_lotto5 = 0 then
    raise exception 'Nenhuma loteria ativa encontrada para period=%, lottery_name=%', p_period, p_lottery_name;
  end if;

  bor_vals := coalesce(p_sorted->'bor', '{}'::jsonb);
  mar_vals := coalesce(p_sorted->'mar', '{}'::jsonb);
  lotto3_vals := coalesce(p_sorted->'lotto3', '{}'::jsonb);
  lotto4_vals := coalesce(p_sorted->'lotto4', '{}'::jsonb);
  lotto5_vals := coalesce(p_sorted->'lotto5', '{}'::jsonb);

  for bet_rec in
    select
      t.id as bet_id,
      t.wallet_id,
      t.amount
    from public.transactions t
    where t.type = 'bet'
      and t.metadata->'bet'->>'period' = p_period
      and t.metadata->'bet'->>'lottery_name' = p_lottery_name
    order by t.created_at asc
  loop
    v_processed := v_processed + 1;
    payout := 0;

    -- 1) Recalcular payout com base no p_sorted atual

    -- bor: lo1/lo2/lo3
    if bor_vals <> '{}'::jsonb then
      foreach w in array['lo1','lo2','lo3']
      loop
        if bor_vals ? w then
          coef := (bor_vals->>w)::numeric;
          payout := payout + (coef * v_borlette);
        end if;
      end loop;
    end if;

    -- mar: mar1..mar6 (pega todas as keys marX que existirem)
    if mar_vals <> '{}'::jsonb then
      for w in select jsonb_object_keys(mar_vals) loop
        if w.key ~ '^mar[1-6]$' then
          coef := (mar_vals->>w.key)::numeric;
          payout := payout + (coef * v_married);
        end if;
      end loop;
    end if;

    -- lotto3/4/5: winner (ou vencedor)
    begin
      w := coalesce(lotto3_vals->>'winner', lotto3_vals->>'vencedor');
      if w is not null then
        coef := coalesce((lotto3_vals->>w), '0')::numeric;
        payout := payout + (coef * v_lotto3);
      end if;
    exception when others then
      null;
    end;

    begin
      w := coalesce(lotto4_vals->>'winner', lotto4_vals->>'vencedor');
      if w is not null then
        coef := coalesce((lotto4_vals->>w), '0')::numeric;
        payout := payout + (coef * v_lotto4);
      end if;
    exception when others then
      null;
    end;

    begin
      w := coalesce(lotto5_vals->>'winner', lotto5_vals->>'vencedor');
      if w is not null then
        coef := coalesce((lotto5_vals->>w), '0')::numeric;
        payout := payout + (coef * v_lotto5);
      end if;
    exception when others then
      null;
    end;

    -- 2) Pegar o último amount creditado (wallet_transaction) dessa bet
    select
      wt.amount,
      true
    into
      last_credit_amount,
      has_last_credit
    from public.wallet_transaction wt
    where wt.transaction_id = bet_rec.bet_id
      and wt.wallet_id = bet_rec.wallet_id
      and wt.nature = 'credit'
    order by wt.created_at desc
    limit 1;

    if not found then
      has_last_credit := false;
      last_credit_amount := 0;
    end if;

    -- 3) Ajustar se necessário
    if (not has_last_credit) then
      -- só credita se payout > 0
      if payout > 0 then
        select (w.balance)
        into v_balance_before
        from public.wallets w
        where w.id = bet_rec.wallet_id
        for update;

        update public.wallets w
        set balance = w.balance + payout,
            updated_at = now()
        where w.id = bet_rec.wallet_id;

        select w.balance
        into v_balance_after
        from public.wallets w
        where w.id = bet_rec.wallet_id;

        insert into public.wallet_transaction(
          id, wallet_id, transaction_id,
          nature, type,
          amount,
          transfer_group_id,
          metadata,
          balance_before, balance_after
        )
        values (
          gen_random_uuid(),
          bet_rec.wallet_id,
          bet_rec.bet_id,
          'credit'::text,
          'adjustment'::text,
          payout,
          null,
          jsonb_build_object(
            'reason','bet_payout_reconcile_credit_first',
            'period',p_period,
            'lottery_name',p_lottery_name
          ),
          v_balance_before, v_balance_after
        );

        v_adjusted := v_adjusted + 1;
        v_credited := v_credited + 1;
        v_total_credit := v_total_credit + payout;
      end if;

    else
      -- existe último credit: se diferente do payout, ajustar diferença
      if last_credit_amount <> payout then
        -- creditado_diff pode ser positivo (precisa debitar) ou negativo (precisa creditar)
        -- diff = last_credit_amount - payout
        -- se diff > 0 => creditação foi maior: debita diff
        -- se diff < 0 => creditação foi menor: credita (-diff)
        if last_credit_amount > payout then
          -- debitar diferença
          declare
            v_diff numeric;
          begin
            v_diff := last_credit_amount - payout;

            select (w.balance)
            into v_balance_before
            from public.wallets w
            where w.id = bet_rec.wallet_id
            for update;

            update public.wallets w
            set balance = w.balance - v_diff,
                updated_at = now()
            where w.id = bet_rec.wallet_id;

            select w.balance
            into v_balance_after
            from public.wallets w
            where w.id = bet_rec.wallet_id;

            insert into public.wallet_transaction(
              id, wallet_id, transaction_id,
              nature, type,
              amount,
              transfer_group_id,
              metadata,
              balance_before, balance_after
            )
            values (
              gen_random_uuid(),
              bet_rec.wallet_id,
              bet_rec.bet_id,
              'debit'::text,
              'adjustment'::text,
              v_diff,
              null,
              jsonb_build_object(
                'reason','bet_payout_reconcile_debit_diff',
                'period',p_period,
                'lottery_name',p_lottery_name,
                'last_credit_amount',last_credit_amount,
                'payout',payout
              ),
              v_balance_before, v_balance_after
            );

            v_adjusted := v_adjusted + 1;
            v_debited := v_debited + 1;
            v_total_debit := v_total_debit + v_diff;
          end;

        else
          -- creditar diferença
          declare
            v_diff numeric;
          begin
            v_diff := payout - last_credit_amount;

            select (w.balance)
            into v_balance_before
            from public.wallets w
            where w.id = bet_rec.wallet_id
            for update;

            update public.wallets w
            set balance = w.balance + v_diff,
                updated_at = now()
            where w.id = bet_rec.wallet_id;

            select w.balance
            into v_balance_after
            from public.wallets w
            where w.id = bet_rec.wallet_id;

            insert into public.wallet_transaction(
              id, wallet_id, transaction_id,
              nature, type,
              amount,
              transfer_group_id,
              metadata,
              balance_before, balance_after
            )
            values (
              gen_random_uuid(),
              bet_rec.wallet_id,
              bet_rec.bet_id,
              'credit'::text,
              'adjustment'::text,
              v_diff,
              null,
              jsonb_build_object(
                'reason','bet_payout_reconcile_credit_diff',
                'period',p_period,
                'lottery_name',p_lottery_name,
                'last_credit_amount',last_credit_amount,
                'payout',payout
              ),
              v_balance_before, v_balance_after
            );

            v_adjusted := v_adjusted + 1;
            v_credited := v_credited + 1;
            v_total_credit := v_total_credit + v_diff;
          end;
        end if;
      end if;
    end if;

    -- (Opcional) não altero status_bet aqui, porque seu pedido foi especificamente
    -- “escrever nova linha em wallet_transaction ... ajustar se necessário”.
  end loop;

  return jsonb_build_object(
    'processed_bets', v_processed,
    'adjusted', v_adjusted,
    'credited_adjustments', v_credited,
    'debited_adjustments', v_debited,
    'total_credit', v_total_credit,
    'total_debit', v_total_debit,
    'period', p_period,
    'lottery_name', p_lottery_name
  );
end;
$$;