import supabase from "../configs/supabase.js";

/**
 * Cria a conta de autenticação da empresa.
 */
const createCompanyInDatabase = async ({ email, password }) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    return {
      success: false,
      error,
    };
  }

  return {
    success: true,
    data,
  };
};

/**
 * Cria o perfil relacionado à empresa.
 */
const createProfileInDatabase = async ({ companyId, profileData }) => {
  const { data, error } = await supabase
    .from("profiles")
    .insert([
      {
        company_id: companyId,
        ...profileData,
      },
    ])
    .select()
    .single();

  if (error) {
    return {
      success: false,
      error,
    };
  }

  return {
    success: true,
    data,
  };
};

/**
 * Login da empresa.
 */
const loginCompanyInDatabase = async ({ email, password }) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return {
      success: false,
      error,
    };
  }

  return {
    success: true,
    data,
  };
};

/**
 * Busca uma empresa pelo ID.
 */
const getCompanyFromDatabase = async (companyId) => {
  const { data, error } = await supabase
    .from("companies")
    .select(`
      id,
      email,
      created_at
      `)
    .eq("id", companyId)
    .single();

  if (error) {
    return {
      success: false,
      error,
    };
  }

  return {
    success: true,
    data,
  };
};

/**
 * Busca um perfil pelo ID.
 */
const getProfileFromDatabase = async (profileId) => {
  const { data, error } = await supabase
    .from("profiles")
    .select(`
      id,
      name,
      wallets(
        id,
        type,
        status,
        balance,
        currency,
        account_number
      )
      `)
    .eq("id", profileId)
    .single();

  if (error) {
    return {
      success: false,
      error,
    };
  }

  return {
    success: true,
    data,
  };
};

/**
 * Valida o access token e retorna o usuário autenticado.
 */
const verifyCompanyInDatabase = async (accessToken) => {
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error) {
    return {
      success: false,
      error,
    };
  }

  return {
    success: true,
    data,
  };
};

/**
 * Recuperação de senha.
 */
const recoveryPasswordInDatabase = async ({ email }) => {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email);

  if (error) {
    return {
      success: false,
      error,
    };
  }

  return {
    success: true,
    data,
  };
};

export {
  createCompanyInDatabase,
  createProfileInDatabase,
  loginCompanyInDatabase,
  getCompanyFromDatabase,
  getProfileFromDatabase,
  verifyCompanyInDatabase,
  recoveryPasswordInDatabase,
};
