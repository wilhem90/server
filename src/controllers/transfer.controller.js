import handleExchangeRate from "../apis/exchangeRate.js";
import modelCompany from "../models/supabase/company.supabase.js";
import supabase from "../models/supabase/conexion.js";
import transferModel from "../models/supabase/transfer.supabase.js";
import wallet_price_tiers from "../utils/generatePriceTiers.js";

async function getCurrentWallet(req) {
  return await wallet_price_tiers.getConfigCost({
    userId: req.user?.id,
    type: req.user?.type,
    code: "money_transfer",
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

const controllerTransferMoney = {
  // Cria uma transferência de dinheiro
  createTransfer: async (req, res) => {
    console.log(req.body);
    const {
      client_id,
      beneficiary_name,
      account_number,
      operator_name,
      sendValue,
      distributor_ref,
      validateOnly = true,
    } = req.body;

    const { user } = req;
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
      need_wallet,
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

    let { data: exchangeRateData } = await modelCompany.configApp({
      name: "exchange_rate",
      date: new Date().toISOString().split("T")[0],
    });

    if (!exchangeRateData?.value) {
      await handleExchangeRate();
      const { data: newExchangeRateData } = await modelCompany.configApp({
        name: "exchange_rate",
        date: new Date().toISOString().split("T")[0],
      });
      exchangeRateData = newExchangeRateData;
    }

    try {
      const tiers = generatePriceTiers(
        min_value,
        max_value,
        price_step,
        start_percent,
        end_percent,
      );
      const fee = (
        calculatePrice(sendValue, false, tiers) - parseFloat(sendValue)
      ).toFixed(2);
      const estimated = (parseFloat(sendValue) - fee).toFixed(2);

      const dataToSend = {
        sendValue,
        sendCurrency: user?.wallet_currency,
        fee,
        fee_company: (fee - fee_provider * fee).toFixed(2),
        fee_provider: (fee_provider * fee).toFixed(2),
        sendValueWithTax: (sendValue - fee).toFixed(2),
        estimated: (estimated * exchangeRateData?.value ?? 1).toFixed(2),
        receivedCurrency: "HTG",
        exchangeRate: exchangeRateData?.value ?? 1,
      };

      if (validateOnly) {
        return res.status(200).json({
          success: true,
          data: { ...dataToSend },
        });
      }

      // Aqui você pode adicionar a lógica para criar a transferência de dinheiro
      const fields = [
        "beneficiary_name",
        "account_number",
        "distributor_ref",
        "operator_name",
      ];

      if (fields.some((field) => !req.body[field])) {
        return res.status(400).json({
          success: false,
          message: `Required fields missing: ${fields.filter((field) => !req.body[field]).join(", ")}`,
        });
      }

      // Aqui você pode adicionar a lógica para criar a transferência de dinheiro
      const actorId = req.user.id;
      const transfer = await transferModel.createTransfer({
        walletId: user?.wallet_id,
        actorId,
        client_id,
        beneficiary_name,
        account_number,
        operator_name,
        sendValue,
        sendCurrency: user?.wallet_currency ?? "BRL",
        fee: dataToSend.fee,
        feeCommission: dataToSend.fee_company,
        feeProvider: dataToSend.fee_provider,
        exchangeRate: dataToSend.exchangeRate,
        receivedValue: dataToSend.estimated,
        receivedCurrency: dataToSend.receivedCurrency,
        distributorRef: distributor_ref,
        neededWallet: need_wallet,
      });

      if (!transfer.success) {
        console.log(transfer);
        return res.status(500).json({
          success: false,
          message: transfer.error?.message || "Falha ao criar a transferência",
        });
      }

      return res.status(200).json({
        success: true,
        transfer: transfer.data,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },

  // Busca beneficiário pelo número da conta
  getBeneficiaryByAccountNumber: async (req, res) => {
    try {
      const accountNumber = req.params.accountNumber;

      if (!accountNumber) {
        return res.status(400).json({
          success: false,
          message: "Número da conta é obrigatório",
        });
      }

      const requestBene =
        await transferModel.getBeneficiaryByAccountNumber(accountNumber);

      if (!requestBene.success) {
        return res.status(404).json({
          success: false,
          message: requestBene.message || "Beneficiário não encontrado",
        });
      }

      // Caso contrário, retorna o beneficiário
      return res.status(200).json({
        success: true,
        beneficiary: requestBene.data,
      });
    } catch (error) {
      console.error("Erro ao buscar beneficiário:", error);
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },

  getTransfers: async (req, res) => {
    try {
      const { user } = req;
      const {
        clientId,
        limit = 50,
        offset = 0,
        startDate,
        endDate,
      } = req.query;

      const transfers = await transferModel.getTransfers({
        walletId: user.wallet_id,
        employeeId: user.id,
        clientId,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        startDate,
        endDate,
      });

      if (!transfers.success) {
        return res.status(404).json({
          success: false,
          message: transfers.message || "Nenhuma transferência encontrada",
        });
      }

      return res.status(200).json({
        success: true,
        transfers: transfers.data,
      });
    } catch (error) {
      console.error("Erro ao buscar transferências:", error);
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },

  getTransferById: async (req, res) => {
    try {
      const transferId = req.params.id;

      if (!transferId) {
        return res.status(400).json({
          success: false,
          message: "ID da transferência é obrigatório",
        });
      }

      const requestTransfer = await transferModel.getTransferById(transferId);

      if (!requestTransfer.success) {
        return res.status(404).json({
          success: false,
          message: requestTransfer.message || "Transferência não encontrada",
        });
      }

      return res.status(200).json({
        success: true,
        transfer: requestTransfer.data,
      });
    } catch (error) {
      console.error("Erro ao buscar transferência:", error);
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },
};

export default controllerTransferMoney;
