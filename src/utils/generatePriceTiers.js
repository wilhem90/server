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

  registerPricing: async (userId, code, config) => {
    console.log("registerPricing", { userId, code, config });
    const { data, error } = await supabase
      .from("company_pricing_rules")
      .upsert(
        {
          company_id: userId,
          service_code: code,
          max_value: config.max_value,
          min_value: config.min_value,
          price_step: config.price_step,
          start_percent: config.start_percent,
          end_percent: config.end_percent,
          fee_fixed: config.fee_fixed,
          fee_provider: config.fee_provider,
        },
        { onConflict: ["company_id", "service_code"] },
      )
      .select();
    if (error) {
      console.error("Error registering pricing:", error.message);
      return { success: false, error: error.message };
    }
    return { success: true, data };
  },
};

export default wallet_price_tiers;
