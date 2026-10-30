import supabase, { createAuthClient } from "./conexion.js";

const profilModel = {
  getProfileByUsername: async (username) => {
    try {
      if (!username) {
        return null;
      }

      const normalizedUsername = username.trim().toLowerCase();

      const { data, error } = await supabase.rpc("get_profile_by_username", {
        p_username: normalizedUsername,
      });
      if (error) {
        console.error("[getProfileByUsername] Supabase error:", error);

        return null;
      }

      if (!data) {
        return null;
      }
      return data;
    } catch (error) {
      console.error("[getProfileByUsername] Unexpected error:", error);

      return null;
    }
  },

  getProfileById: async (id) => {
    try {
      if (!id) {
        return null;
      }

      const { data, error } = await supabase.rpc("get_profile_by_id", {
        p_profile_id: id,
      });

      if (error) {
        console.error("[getProfileById] Supabase error:", error);
        return null;
      }

      return data || null;
    } catch (error) {
      console.error("[getProfileById] Unexpected error:", error);
      return null;
    }
  },

  createProfil: async (profilData) => {
    try {
      if (!profilData?.email) {
        return {
          success: false,
          error: "Email é obrigatório",
        };
      }

      if (!profilData?.password) {
        return {
          success: false,
          error: "Password é obrigatório",
        };
      }

      if (!profilData?.username) {
        return {
          success: false,
          error: "Username é obrigatório",
        };
      }

      if (!profilData?.fullname) {
        return {
          success: false,
          error: "Nome completo é obrigatório",
        };
      }

      const email = profilData.email.trim().toLowerCase();
      const username = profilData.username.trim().toLowerCase();
      const fullname = profilData.fullname.trim();

      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: profilData.password,
        email_confirm: true,

        user_metadata: {
          user_name: username,
          full_name: fullname,
          display_name: fullname,
          phone: profilData.phone || null,
          need_wallet: true,
          type_profile: "user",
        },
      });

      console.log(data, error);

      if (error) {
        console.error("[createProfil] Supabase error:", error);

        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error("[createProfil] Unexpected error:", error);

      return {
        success: false,
        error: {
          message: error.message,
          name: error.name,
          status: error.status,
          code: error.code,
        },
      };
    }
  },

  updateProfile: async (user_id, profileData) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .update(profileData)
        .eq("id", user_id);

      if (error) {
        console.error("[updateProfile] Supabase error:", error);
        return null;
      }

      console.log(data);

      return data || null;
    } catch (error) {
      console.error("[updateProfile] Unexpected error:", error);
      return null;
    }
  },

  loginProfil: async ({ email, password }) => {
    try {
      if (!email) {
        return {
          success: false,
          error: "Email é obrigatório",
        };
      }

      if (!password) {
        return {
          success: false,
          error: "Password é obrigatório",
        };
      }

      const normalizedEmail = email.trim().toLowerCase();

      const { data, error } = await createAuthClient().auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        console.error("[loginProfil] Supabase login error:", error);

        return {
          success: false,
          error: error.message,
        };
      }

      if (!data?.user) {
        return {
          success: false,
          error: "Usuário não retornado pelo Supabase",
        };
      }

      if (!data?.session) {
        return {
          success: false,
          error: "Sessão não retornada pelo Supabase",
        };
      }

      return {
        success: true,
        data: {
          user: {
            ...data.user.user_metadata,
          },
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
          expires_in: data.session.expires_in,
          token_type: data.session.token_type,
        },
      };
    } catch (error) {
      console.error("[loginProfil] Unexpected error:", error);

      return {
        success: false,
        error: error.message,
      };
    }
  },

  getPermissionsByRole: async (role) => {
    try {
      const { data, error } = await supabase
        .from("role_permissions_view")
        .select("permissions")
        .eq("role", role)
        .eq("active", true);

      if (error) {
        console.error("[getPermissionsByRole] Supabase error:", error);
        return [];
      }

      return data?.[0]?.permissions || [];
    } catch (error) {
      console.error("[getPermissionsByRole] Unexpected error:", error);
      return [];
    }
  },
};

export default profilModel;
