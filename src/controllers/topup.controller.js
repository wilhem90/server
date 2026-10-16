import requestDing from "../apis/ding.js";
import modelTopup from "../models/supabase/topup.supabase.js";
import wallet_price_tiers from "../utils/generatePriceTiers.js";

async function getCurrentWallet(req) {
  return await wallet_price_tiers.getConfigCost({
    userId: req.user?.id,
    code: "topup",
    type: req.user?.type,
  });
}

function generatePriceTiers(
  minValue,
  maxValue,
  step,
  startPercent,
  endPercent,
) {
  if (minValue < 0 || maxValue <= 0 || step <= 0) {
    throw new Error("Invalid price tier parameters");
  }

  const tiers = [];
  const stepsCount = Math.floor((maxValue - minValue) / step);
  const percentStep = (startPercent - endPercent) / stepsCount;

  for (let i = 0; i <= stepsCount; i++) {
    const tierMin = minValue + i * step;
    const tierMax = i === stepsCount ? Infinity : tierMin + step - 1;
    const percent = startPercent - percentStep * i;
    tiers.push({
      min: tierMin,
      max: tierMax,
      percent: Number(percent.toFixed(2)),
    });
  }

  return tiers;
}

function getPercent(value, tiers = []) {
  const tier = tiers.find((t) => value >= t.min && value <= t.max);
  return tier ? tier.percent : 0;
}

function calculatePrice(value, isReverse = false, tiers = []) {
  const num = typeof value === "string" ? parseFloat(value) : value;

  if (typeof num !== "number" || isNaN(num) || !isFinite(num)) {
    throw new Error("Invalid value for calculation");
  }

  if (!isReverse) {
    const percent = getPercent(num, tiers);
    const result = num + num * percent;
    return result < 10 ? 10 : Number(result.toFixed(2));
  }

  for (const tier of tiers) {
    const original = num / (1 + tier.percent);
    if (original >= tier.min && original <= tier.max) {
      return Number(original.toFixed(2));
    }
  }
  return num;
}

const controlTopup = {
  GetCountries: async (req, res) => {
    try {
      const dataCountries = await requestDing("GetCountries", "GET");

      return res.status(200).json({
        success: true,
        ...dataCountries,
      });
    } catch (error) {
      console.error("[GetCountries]", error);

      return res.status(500).json({
        success: false,
        message: error?.message || "Error fetching countries.",
      });
    }
  },

  GetProviders: async (req, res) => {
    try {
      let { AccountNumber } = req.query;

      if (!AccountNumber) {
        return res.status(400).json({
          success: false,
          message: "AccountNumber is required.",
        });
      }

      if (!AccountNumber) {
        return res.status(400).json({
          success: false,
          message: "Invalid AccountNumber.",
        });
      }

      const dataProviders = await requestDing(
        `GetProviders?accountNumber=${encodeURIComponent(AccountNumber)}`,
        "GET",
      );

      return res.status(200).json({
        success: true,
        ...dataProviders,
      });
    } catch (error) {
      console.error("[GetProviders]", error);

      return res.status(500).json({
        success: false,
        message: error?.message || "Error fetching providers.",
      });
    }
  },

  GetProducts: async (req, res) => {
    try {
      let { AccountNumber, ProviderCodes } = req.query;

      if (!AccountNumber || !ProviderCodes) {
        return res.status(400).json({
          success: false,
          message: "AccountNumber and ProviderCodes are required.",
        });
      }

      if (!AccountNumber) {
        return res.status(400).json({
          success: false,
          message: "Invalid AccountNumber.",
        });
      }

      const dataProducts = await requestDing(
        `GetProducts?accountNumber=${encodeURIComponent(
          AccountNumber,
        )}&providerCodes=${encodeURIComponent(ProviderCodes)}`,
        "GET",
      );

      if (!dataProducts.data || dataProducts.data?.ResultCode !== 1) {
        return res.status(500).json({
          success: false,
          message: "Failed to fetch products from Ding Connect.",
        });
      }

      const tiers_price_current_user = await getCurrentWallet(req);

      if (Object.keys(tiers_price_current_user[0] || {}).length === 0) {
        return res.status(400).json({
          success: false,
          message: "No active price found for the selected wallet.",
        });
      }

      let {
        max_value,
        min_value,
        price_step,
        end_percent,
        fee_provider,
        start_percent,
      } = tiers_price_current_user[0] || {};

      if (
        min_value == null ||
        max_value == null ||
        price_step == null ||
        end_percent == null ||
        fee_provider == null ||
        start_percent == null
      ) {
        return res.status(400).json({
          success: false,
          message: "Top-up limit configuration is missing for this wallet.",
        });
      }

      max_value = parseFloat(max_value);
      min_value = parseFloat(min_value);
      price_step = parseFloat(price_step);
      end_percent = parseFloat(end_percent) / 100;
      start_percent = parseFloat(start_percent) / 100;
      fee_provider = parseFloat(fee_provider) / 100;

      const products = Array.isArray(dataProducts.data.Items)
        ? dataProducts.data.Items
        : [];

      const items = [];

      for (const product of products) {
        const skuCode = product?.SkuCode;
        const ReceiveCurrencyIso = product?.Maximum?.ReceiveCurrencyIso;

        if (!skuCode) {
          continue;
        }

        const minimum = product?.Minimum?.SendValue;

        const maximum = product?.Maximum?.SendValue;

        if (minimum === maximum) {
          items.push({
            skuCode,
            receiveCurrencyIso: ReceiveCurrencyIso,
            sendValue: calculatePrice(
              minimum,
              false,
              generatePriceTiers(
                min_value,
                max_value,
                price_step,
                start_percent,
                end_percent,
              ),
            ),
          });

          continue;
        }

        if (maximum > minimum) {
          const minValue = calculatePrice(
            minimum,
            false,
            generatePriceTiers(
              min_value,
              max_value,
              price_step,
              start_percent,
              end_percent,
            ),
          );

          const maxValue = calculatePrice(
            maximum,
            false,
            generatePriceTiers(
              min_value,
              max_value,
              price_step,
              start_percent,
              end_percent,
            ),
          );

          for (
            let value = Math.ceil(minValue);
            value <= Math.floor(maxValue);
            value++
          ) {
            items.push({
              skuCode,
              receiveCurrencyIso: ReceiveCurrencyIso,
              sendValue: value,
            });
          }
        }
      }

      return res.status(200).json({
        success: true,
        Items: items,
      });
    } catch (error) {
      console.error("[GetProducts]", error);

      return res.status(500).json({
        success: false,
        message: error?.message || "Error fetching products.",
      });
    }
  },

  // Controller method to handle sending top-up requests
  SendTopup: async (req, res) => {
    try {
      if (!req.body) {
        return res.status(400).json({
          success: false,
          message: "Request body is missing.",
        });
      }

      const currentActorId = req.user?.id;

      if (!currentActorId) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated.",
        });
      }

      const {
        skuCode,
        sendValue,
        sendCurrencyIso,
        accountNumber,
        validateOnly,
        receiveCountryName,
        operatorName,
        receiveCurrencyIso,
        distributor_ref,
      } = req.body;

      // ========================================================
      // VALIDAR CAMPOS
      // ========================================================

      const requiredFields = [
        "skuCode",
        "sendValue",
        "sendCurrencyIso",
        "receiveCurrencyIso",
        "accountNumber",
        "operatorName",
        "distributor_ref",
      ];

      for (const field of requiredFields) {
        if (req.body[field] == null || req.body[field] === "") {
          return res.status(400).json({
            success: false,
            message: `Required field missing: ${field}`,
          });
        }
      }

      // ========================================================
      // WALLET
      // ========================================================

      const tiers_price_current_user = await getCurrentWallet(req);

      if (Object.keys(tiers_price_current_user[0] || {}).length === 0) {
        return res.status(400).json({
          success: false,
          message: "No active price found for the selected wallet.",
        });
      }

      let {
        max_value,
        min_value,
        price_step,
        end_percent,
        fee_provider,
        start_percent,
      } = tiers_price_current_user[0] || {};

      if (
        min_value == null ||
        max_value == null ||
        price_step == null ||
        end_percent == null ||
        fee_provider == null ||
        start_percent == null
      ) {
        return res.status(400).json({
          success: false,
          message: "Top-up limit configuration is missing for this wallet.",
        });
      }

      max_value = parseFloat(max_value);
      min_value = parseFloat(min_value);
      price_step = parseFloat(price_step);
      end_percent = parseFloat(end_percent) / 100;
      start_percent = parseFloat(start_percent) / 100;
      fee_provider = parseFloat(fee_provider) / 100;

      // ========================================================
      // VALOR
      // ========================================================

      if (sendValue < min_value || sendValue > max_value) {
        return res.status(400).json({
          success: false,
          message: `The value must be between R$ ${min_value} and R$ ${max_value}.`,
        });
      }

      // ========================================================
      // ACCOUNT NUMBER
      // ========================================================

      if (!accountNumber) {
        return res.status(400).json({
          success: false,
          message: "Invalid account number.",
        });
      }

      const calculatedSendValue = calculatePrice(
        sendValue,
        true,
        generatePriceTiers(
          min_value,
          max_value,
          price_step,
          start_percent,
          end_percent,
        ),
      );

      if (calculatedSendValue <= 0 || calculatedSendValue >= sendValue) {
        return res.status(400).json({
          success: false,
          message: "Calculated top-up value is invalid.",
        });
      }

      const fee = sendValue - calculatedSendValue;

      if (fee < 0) {
        return res.status(400).json({
          success: false,
          message: "Calculated fee is invalid.",
        });
      }

      // ========================================================
      // DISTRIBUTOR REF
      // ========================================================

      // ========================================================
      // DADOS DA RECARGA
      // ========================================================
      const dataTopup = {
        actor_id: currentActorId,
        sku_code: skuCode,
        send_value: sendValue.toFixed(2),
        send_value_net: calculatedSendValue.toFixed(2),
        account_number: accountNumber,
        distributor_ref,
        send_currency: sendCurrencyIso,
        transfer_id: null,
        received_value: calculatedSendValue.toFixed(2),
        received_currency: receiveCurrencyIso,
        fee: fee.toFixed(2),
        validate_only: Boolean(validateOnly),
        fee_provider: (fee_provider > 0 ? fee_provider * fee : 0).toFixed(2),
        error_code: null,
        error_message: null,
        raw_api_response: {
          validateOnly: Boolean(validateOnly),
          transactionType: "topup",
          operatorName,
          receiveCountryName,
          sendValue: sendValue.toFixed(2),
          calculatedSendValue: calculatedSendValue.toFixed(2),
          fee: fee.toFixed(2),
        },
      };

      // ========================================================
      // CRIAR TOPUP OR VALIDATE ONLY
      // ========================================================
      const profile_type = req.user?.type;
      if (!profile_type) {
        return res.status(400).json({
          success: false,
          message: "Profile type is required.",
          data: dataTopup,
        });
      }

      const amountOfDing = await modelTopup.createTopup(
        dataTopup,
        profile_type,
      );

      if (
        !amountOfDing.success ||
        amountOfDing.data?.TransferRecord?.ProcessingState?.includes([
          "Failed",
          "Cancelled",
        ])
      ) {
        return res.status(400).json({
          success: false,
          error: amountOfDing.data?.TransferRecord?.ProcessingState?.includes(
            "Failed",
          )
            ? "Failed"
            : amountOfDing.data?.TransferRecord?.ProcessingState?.includes(
                  "Cancelled",
                )
              ? "Cancelled"
              : null,
        });
      }
      // ========================================================
      // VALIDATE ONLY
      // ========================================================

      if (Boolean(validateOnly)) {
        return res.status(200).json({
          success: true,
          data: {
            ...amountOfDing?.data?.TransferRecord?.Price,
          },
        });
      }

      // ========================================================
      // RESPONSE
      // ========================================================

      return res.status(201).json({
        success: true,
        data: {
          distributor_ref,
          sendValue: sendValue.toFixed(2),
          calculatedSendValue: calculatedSendValue.toFixed(2),
          fee: fee.toFixed(2),
          fee_provider: (fee_provider > 0 ? fee_provider * fee : 0).toFixed(2),
          send_value_net: calculatedSendValue.toFixed(2),
          ...amountOfDing?.data,
        },
      });
    } catch (error) {
      console.error("[SendTopup]", error);
      return res.status(400).json({
        success: false,
        message: error?.message || "Error processing the top-up.",
      });
    }
  },

  getTopupById: async (req, res) => {
    try {
      const { statement_id } = req.params;
      const topup = await modelTopup.getTopupById(statement_id);
      if (!topup?.success) {
        return res.status(400).json({
          success: false,
          message: topup?.error?.message || "Error retrieving top-up.",
        });
      }
      return res.status(200).json({
        success: true,
        data: topup?.data || null,
      });
    } catch (error) {
      console.error("[GetTopupById]", error);
      return res.status(400).json({
        success: false,
        message: error?.message || "Error retrieving top-up.",
      });
    }
  },

  getTopupHistory: async (req, res) => {
    try {
      const { user } = req;
      const history = await modelTopup.getTopupHistory(user.id);
      if (!history?.success) {
        return res.status(400).json({
          success: false,
          message:
            history?.error?.message || "Error retrieving top-up history.",
        });
      }
      return res.status(200).json({
        success: true,
        data: history?.data || [],
      });
    } catch (error) {
      console.error("[GetTopupHistory]", error);
      return res.status(400).json({
        success: false,
        message: error?.message || "Error retrieving top-up history.",
      });
    }
  },
};

export default controlTopup;
