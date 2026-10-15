import dotenv from "dotenv";
import modelCompany from "../models/supabase/company.supabase.js";
dotenv.config();
const exchangeRate = async () => {
  try {
    const currentDate = new Date();
    const date = currentDate.toISOString().split("T")[0];
    let exchange_rate = await modelCompany.configApp({
      name: "exchange_rate",
      date,
    });

    if (exchange_rate.success && !exchange_rate.data) {
      const handleExchangerate = await fetch(
        `https://v6.exchangerate-api.com/v6/${process.env.EXCHANGE_KEY}/latest/brl`,
      );

      if (handleExchangerate.ok) {
        const conversion_json = await handleExchangerate.json();
        const rate = conversion_json.conversion_rates.HTG;

        exchange_rate = await modelCompany.updateAppConfig({
          value: rate,
          name: "exchange_rate",
        });
      }
    }
  } catch (error) {
    console.error("Erro ao buscar taxa de câmbio:", error);
  }
};

export default exchangeRate;
