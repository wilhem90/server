import supabase from "../configs/supabase.js";

const registerUserFromSupabase = async (dataUser) => {
  const { data: newUserId, error } = await supabase.rpc(
    "register_custom_user",
    {
      p_first_name: dataUser.first_name,
      p_last_name: dataUser.last_name,
      p_document_id: dataUser.document_id,
      p_birthday: dataUser.birthday,
      p_email: dataUser.email,
      p_user_name: dataUser.userName,
      p_phone: dataUser.phone,
      p_password_hash: dataUser.password_hash,
      p_country: dataUser.country,
      p_state: dataUser.state,
      p_city: dataUser.city,
      p_neighborhood: dataUser.neighborhood,
      p_street: dataUser.street,
      p_number: dataUser.number,
    },
  );

  if (error) {
    // console.error("Failed to register user:", error.message);
    return { success: false, error };
  }

  return { success: true, data: newUserId };
};

// supabaseService.js
const getUserAndWalletByEmailUserNameDocumentIdFromSupabase = async (
  search,
) => {
  // Retorna sucesso falso imediatamente se o termo de busca estiver vazio
  if (!search) {
    return { success: false, error: new Error("Search parameter is required") };
  }

  console.log(search);

  const { data, error } = await supabase
    .from("users")
    .select(
      `
        id,
        email,
        first_name,
        last_name,
        user_name,
        document_id,
        birthday,
        status,
        role,
        password_hash,
        email_confirmed,
        code_otp,
        token_version,
        pin_transaction,
        wallets (
          id,
          status,
          currency,
          balance,
          number_account
        ),
        addresses (
          id,
          country,
          state,
          city,
          neighborhood,
          street,
          number
        )
      `,
    )
    .or(
      `email.eq."${search}",user_name.eq."${search}",document_id.eq."${search}"`,
    )
    .maybeSingle();

  if (error || !data) {
    return { success: false, error };
  }

  return { success: true, data };
};

//Update user
const updateUserFromSupabase = async (email, data) => {
  const { error } = await supabase
    .from("users")
    .update(data)
    .eq("email", email)
    .single();

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }
  return {
    success: true,
  };
};

// Get my subuser
async function getSubUsersFromSupabase(adminId) {
  const { data, error } = await supabase.rpc("list_sub_users", {
    p_admin_id: adminId,
  });
  if (error || !data) {
    return { success: false, error };
  }

  return {
    success: true,
    data,
  };
}

export {
  getUserAndWalletByEmailUserNameDocumentIdFromSupabase,
  registerUserFromSupabase,
  updateUserFromSupabase,
  getSubUsersFromSupabase,
};
