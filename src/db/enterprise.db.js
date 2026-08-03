import supabase from "../configs/supabase.js";

//All company
const listAllMyCompanyFromSupabase = async (userId) => {
  // Busca direta na tabela 'users' filtrando pela empresa
  const { data, error } = await supabase
    .from("companies")
    .select(
      `
        id,
        name,
        is_active,
        created_at,
        address(
        street,
        city,
        country
        )
      `,
    )
    .eq("owner_id", userId); // Traz todo mundo que trabalha nessa empresa

  if (error) {
    success: (false, error);
  }

  return {
    success: true,
    total: data?.length || 0,
    data,
  };
};

//All users and our transactions
const listAllMyCompanyUsersFromSupabase = async (myCompanyId) => {
  const { data, error } = await supabase
    .from("users")
    .select(
      `
      id,
      first_name,
      last_name,
      email,
      status,
      wallets (
        id,
        balance,
        currency
      )
    `,
    )
    .eq("company_id", myCompanyId);

  if (error) {
    return {
      success: false,
      error,
    };
  }

  return {
    success: true,
    total: data?.length || 0,
    data,
  };
};


export { listAllMyCompanyFromSupabase, listAllMyCompanyUsersFromSupabase };
