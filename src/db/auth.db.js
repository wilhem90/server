import supabase from "../configs/supabase.js";

const checkTokenListFromSupaBase = async (token) => {
  const { data, error } = await supabase
    .from("tokens_list")
    .select("*")
    .eq("token", token)
    .single();
  if (error) {
    return {
      success: false,
      message: "Token not found!",
    };
  }
  

  return {
    success: true,
    data,
  };
};

const blockTokenNow = async (data) => {
  console.log(data);

  const { error } = await supabase.from("tokens_list").insert(data);
  if (error) {
    return {
      success: false,
      error,
    };
  }

  return {
    success: true,
    message: "Token blocked successfully!",
  };
};

const validateEmail = async (email) => {
  const { error } = await supabase
    .from("users")
    .update({
      email_confirmed: true,
    })
    .eq("email", email)
    .single();

  if (error) {
    return {
      success: false,
      error,
    };
  }

  return {
    success: true,
    message: "Email confirmed successfully!",
  };
};

export { checkTokenListFromSupaBase, blockTokenNow, validateEmail };
