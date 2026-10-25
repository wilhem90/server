import supabase from "./conexion.js";

const modelCompany = {
  updateProfile: async (user_id, profilData) => {
    const { data, error } = await supabase.auth.admin.updateUserById(
      user_id,
      profilData,
    );

    if (error) {
      throw new Error(error.message);
    }

    return data;
  },

  //   Create Employee by company
  createEmployee: async (employeeData) => {
    const { data, error } = await supabase.auth.admin.createUser({
      email: employeeData.email.toLowerCase(),
      password: Math.random().toString(36).slice(-8),
      email_confirm: true,
      user_metadata: {
        company_id: employeeData.company_id,
        user_name: employeeData.username.toLowerCase(),
        full_name: employeeData.fullname.toLowerCase(),
        display_name: employeeData.fullname.toLowerCase(),
        type_profile: "employee",
        phone: employeeData.phone,
        need_wallet: false,
      },
    });
    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }
    return {
      success: true,
      data,
    };
  },

  myEmployees: async ({ company_id }) => {
    const { data, error } = await supabase.rpc("company_members", {
      p_company_id: company_id,
    });

    if (error) {
      console.error("Error al obtener empleados:", error);
      return {
        success: false,
        error: error.message,
      };
    }

    console.log(data);

    return {
      success: true,
      data,
    };
  },

  //   Create Client
  createClient: async (clientData) => {
    const { data, error } = await supabase
      .from("clients")
      .insert({
        client_name: clientData.client_name,
        phone: clientData.phone,
        doc_id: clientData.doc_id,
        inserted_by: clientData.profile_id,
        status: "active",
      })
      .select();

    if (error) {
      console.error("Error creating client:", error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data,
    };
  },

  // Get the recipient last used with an account number
  getBeneficiary: async ({ account_number }) => {
    const { data, error } = await supabase.rpc("get_beneficiary", {
      p_account_number: account_number,
    });

    if (error) {
      console.error("Error fetching beneficiary:", error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data: data[0],
    };
  },

  // Get Client by document, phone and/or name
  getClient: async ({ name, doc_id, phone }) => {
    const { data, error } = await supabase.rpc("get_client", {
      p_name: name || null,
      p_doc_id: doc_id || null,
      p_phone: phone || null,
    });

    if (error) {
      console.error("Error fetching client:", error);
      return {
        success: false,
        error: error.message,
      };
    }

    console.log(data, error);

    return {
      success: true,
      data: data?.[0] ?? null,
    };
  },

  //   Get App Configuration
  configApp: async (settings) => {
    const { name, date } = settings;
    let query = supabase.from("settings_global").select("*");

    if (name) {
      query = query.eq("name", name);
    }

    if (date) {
      query = query.eq("created_at", date);
    }

    const { data, error } = await query
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error al obtener la configuración:", error);
      return null;
    }

    return {
      success: true,
      data,
    };
  },

  getExchangeRate: async () => {
    const { data, error } = await supabase.rpc("get_exchange_rate");

    if (error) {
      console.error("Error fetching exchange rate:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? null };
  },

  setExchangeRate: async (rate) => {
    const { data, error } = await supabase.rpc("set_exchange_rate", {
      p_value: rate,
    });

    if (error) {
      console.error("Error saving exchange rate:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  },

  updateAppConfig: async (values) => {
    const { data, error } = await supabase
      .from("settings_global")
      .upsert(values)
      .select();

    if (error) {
      console.error("Error al actualizar la configuración:", error);
      return null;
    }

    return {
      success: true,
      data,
    };
  },
};

export default modelCompany;
