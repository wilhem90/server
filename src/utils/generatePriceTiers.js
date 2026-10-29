import supabase from "../models/supabase/conexion.js";

// Ejemplo de uso en un controlador de cobro o cotización (Quote)
const wallet_price_tiers = {
  getConfigCost: async ({ userId, type, code }) => {
    if (["employee", "admin", "superadmin", "company"].includes(type)) {
      const { data, error } = await supabase.rpc(
        "pricing_rules_for_current_company",
        {
          p_profile_id: userId,
          p_code: code,
        },
      );
      if (error) {
        console.error("Error fetching prices:", error.message);
      }

      return data;
    }

    const { data, error } = await supabase.rpc(
      "pricing_rules_for_current_profile",
      {
        p_code: code,
      },
    );

    if (error) {
      console.error("Error fetching prices:", error.message);
    }
    console.log("generatePriceTiers", data, error);
    return data;
  },
};

export default wallet_price_tiers;
