import { config } from "dotenv";
import supabase from "./conexion.js";

const modelCompany = {
  createCompany: async (profilData) => {
    const { data, error } = await supabase.auth.admin.createUser({
      email: profilData.email.toLowerCase(),
      password: profilData.password,
      email_confirm: true,

      user_metadata: {
        phone: profilData.phone,
        user_name: profilData.username.toLowerCase(),
        full_name: profilData.fullname.toLowerCase(),
        need_wallet: true,
        type_profile: "company",
        owner_id: profilData.user_id,
        display_name: profilData.fullname.toLowerCase(),
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  },

  myCompanies: async ({ user_id }) => {
    const { data, error } = await supabase.rpc("get_my_companies", {
      p_profile_id: user_id,
    });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }
    return data;
  },

  //   Create Employee by company
  createEmployee: async (employeeData) => {
    const { data, error } = await supabase.auth.admin.createUser({
      email: employeeData.email.toLowerCase(),
      password: employeeData.password,
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
        company_id: clientData.company_id,
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

  // get Client by ID or name
  getBeneficiary: async ({ account_number }) => {
    const { data, error } = await supabase
      .from("transfers")
      .select("*")
      .eq("account_number", account_number)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error fetching beneficiary:", error);
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

  // Get Client by ID or name
  getClient: async ({ name, doc_id, phone }) => {
    let query = supabase.from("clients").select("*");
    if (name) {
      query = query.ilike("client_name", `%${name}%`);
    }
    if (doc_id) {
      query = query.eq("doc_id", doc_id);
    }
    if (phone) {
      query = query.eq("phone", phone);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error("Error fetching client:", error);
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

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error("Error al obtener la configuración:", error);
      return null;
    }

    return {
      success: true,
      data,
    };
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
