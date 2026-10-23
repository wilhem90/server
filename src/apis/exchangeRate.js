import dotenv from "dotenv";
import modelCompany from "../models/supabase/company.supabase.js";
dotenv.config();
const exchangeRate = async () => {
  try {
    const currentDate = new Date();
    const date = currentDate.toISOString().split("T")[0];
    // Look up the row by name only, so we update it instead of inserting duplicates
    const existing = await modelCompany.configApp({ name: "exchange_rate" });

    if (!existing?.success) return;
    if (existing.data?.created_at === date && Number(existing.data.value) > 0) {
      return;
    }

    const response = await fetch(
      `https://v6.exchangerate-api.com/v6/${process.env.EXCHANGE_KEY}/latest/brl`,
    );

    if (!response.ok) {
      console.error("Exchange rate API error:", response.status);
      return;
    }

    const conversion_json = await response.json();
    const rate = Number(conversion_json?.conversion_rates?.HTG);

    if (!Number.isFinite(rate) || rate <= 0) {
      console.error("Exchange rate API returned no valid HTG rate");
      return;
    }

    await modelCompany.updateAppConfig({
      ...(existing.data?.id ? { id: existing.data.id } : {}),
      name: "exchange_rate",
      value: String(rate),
      created_at: date,
    });
  } catch (error) {
    console.error("Erro ao buscar taxa de câmbio:", error);
  }
};

export default exchangeRate;
