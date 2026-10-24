import dotenv from "dotenv";
import modelCompany from "../models/supabase/company.supabase.js";
dotenv.config();
const exchangeRate = async () => {
  try {
    const existing = await modelCompany.getExchangeRate();

    if (!existing.success) return null;
    if (existing.data?.is_today && Number(existing.data.value) > 0) {
      return existing.data;
    }

    const response = await fetch(
      `https://v6.exchangerate-api.com/v6/${process.env.EXCHANGE_KEY}/latest/brl`,
    );

    if (!response.ok) {
      console.error("Exchange rate API error:", response.status);
      return null;
    }

    const conversion_json = await response.json();
    const rate = Number(conversion_json?.conversion_rates?.HTG);

    if (!Number.isFinite(rate) || rate <= 0) {
      console.error("Exchange rate API returned no valid HTG rate");
      return null;
    }

    const saved = await modelCompany.setExchangeRate(rate);

    return saved.success ? saved.data : null;
  } catch (error) {
    console.error("Erro ao buscar taxa de câmbio:", error);
    return null;
  }
};

export default exchangeRate;
