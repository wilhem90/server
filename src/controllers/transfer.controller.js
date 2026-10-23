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
  createTransfer: async (req, res) => {
    try {
      const {
        client_id,
        doc_id,
        phone_client,
        client_name,
        beneficiary_name,
        account_number,
        operator_name,
        sendValue: rawSendValue,
      } = req.body;

      const { user } = req;

      // ========================================================
      // 1. VALIDAR AUTENTICAÇÃO E DADOS BÁSICOS
      // ========================================================

      if (!user?.id || !user?.wallet_id) {
        return res.status(401).json({
          success: false,
          message: "User or wallet not authenticated.",
        });
      }

      const rawValidateOnly = req.body.validateOnly;
      let validateOnly = true;

      if (rawValidateOnly !== undefined) {
        if (rawValidateOnly === true || rawValidateOnly === "true") {
          validateOnly = true;
        } else if (rawValidateOnly === false || rawValidateOnly === "false") {
          validateOnly = false;
        } else {
          return res.status(400).json({
            success: false,
            message: "validateOnly must be a boolean.",
          });
        }
      }

      if (rawSendValue == null || String(rawSendValue).trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Transfer amount is required.",
        });
      }

      const amount = Number(rawSendValue);

      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid transfer amount.",
        });
      }

      // ========================================================
      // 2. OBTER A CONFIGURAÇÃO DE PREÇOS DA CARTEIRA
      // ========================================================

      const tiersPriceCurrentUser = await getCurrentWallet(req);

      if (!Array.isArray(tiersPriceCurrentUser) || !tiersPriceCurrentUser[0]) {
        return res.status(400).json({
          success: false,
          message: "No active price found for the selected wallet.",
        });
      }

      let {
        max_value,
        min_value,
        price_step,
        start_percent,
        end_percent,
        fee_provider,
      } = tiersPriceCurrentUser[0];

      const pricingValues = [
        max_value,
        min_value,
        price_step,
        start_percent,
        end_percent,
        fee_provider,
      ];

      if (
        pricingValues.some(
          (value) => value === null || value === undefined || value === "",
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Wallet pricing configuration is incomplete.",
        });
      }

      max_value = Number(max_value);
      min_value = Number(min_value);
      price_step = Number(price_step);

      const startPercent = Number(start_percent) / 100;
      const endPercent = Number(end_percent) / 100;
      const providerPercent = Number(fee_provider) / 100;

      if (
        !Number.isFinite(max_value) ||
        !Number.isFinite(min_value) ||
        !Number.isFinite(price_step) ||
        !Number.isFinite(startPercent) ||
        !Number.isFinite(endPercent) ||
        !Number.isFinite(providerPercent) ||
        min_value <= 0 ||
        max_value < min_value ||
        price_step <= 0 ||
        startPercent < 0 ||
        endPercent < 0 ||
        providerPercent < 0 ||
        providerPercent > 1
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid wallet pricing configuration.",
        });
      }

      if (amount < min_value || amount > max_value) {
        return res.status(400).json({
          success: false,
          message: `The value must be between R$ ${min_value} and R$ ${max_value}.`,
        });
      }

      // ========================================================
      // 3. OBTER A TAXA DE CÂMBIO
      // ========================================================

      const today = new Date().toISOString().split("T")[0];

      let { data: exchangeRateData, error: exchangeRateError } =
        await modelCompany.configApp({
          name: "exchange_rate",
          date: today,
        });

      if (exchangeRateError) {
        console.error("Error fetching exchange rate:", exchangeRateError);

        return res.status(500).json({
          success: false,
          message: "Unable to retrieve the exchange rate.",
        });
      }

      let exchangeRate = Number(exchangeRateData?.value);

      if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
        await handleExchangeRate();

        const result = await modelCompany.configApp({
          name: "exchange_rate",
          date: today.replaceAll("-", ""),
        });

        if (result.error) {
          console.error("Error refreshing exchange rate:", result.error);

          return res.status(500).json({
            success: false,
            message: "Unable to refresh the exchange rate.",
          });
        }

        exchangeRateData = result.data;
        exchangeRate = Number(exchangeRateData?.value);
      }

      if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
        return res.status(503).json({
          success: false,
          message: "A valid exchange rate is not available.",
        });
      }

      // ========================================================
      // 4. CALCULAR TAXAS E VALOR RECEBIDO
      // ========================================================

      const roundMoney = (value) => Number(Number(value).toFixed(2));

      const tiers = generatePriceTiers(
        min_value,
        max_value,
        price_step,
        startPercent,
        endPercent,
      );

      const calculatedPrice = Number(calculatePrice(amount, false, tiers));

      if (!Number.isFinite(calculatedPrice) || calculatedPrice < amount) {
        return res.status(500).json({
          success: false,
          message: "Unable to calculate the transfer fee.",
        });
      }

      const feeAmount = roundMoney(calculatedPrice - amount);

      // Parte da taxa destinada ao provedor.
      const providerFeeAmount = roundMoney(feeAmount * providerPercent);

      // Parte restante da taxa destinada à empresa.
      const companyFeeAmount = roundMoney(feeAmount - providerFeeAmount);

      const sendValueWithTax = roundMoney(amount - feeAmount);

      if (sendValueWithTax <= 0) {
        return res.status(400).json({
          success: false,
          message: "The transfer amount must exceed the fee.",
        });
      }

      const receivedValue = roundMoney(sendValueWithTax * exchangeRate);

      const dataToSend = {
        sendValue: amount,
        sendCurrency: user.wallet_currency ?? "BRL",
        fee: feeAmount.toFixed(2),
        fee_company: companyFeeAmount.toFixed(2),
        fee_provider: providerFeeAmount.toFixed(2),
        sendValueWithTax: sendValueWithTax.toFixed(2),
        estimated: receivedValue.toFixed(2),
        receivedCurrency: "HTG",
        exchangeRate,
      };

      // ========================================================
      // 5. MODO DE VALIDAÇÃO: NÃO GRAVAR NADA
      // ========================================================

      if (validateOnly) {
        return res.status(200).json({
          success: true,
          data: dataToSend,
        });
      }

      // ========================================================
      // 6. VALIDAR DADOS DA TRANSFERÊNCIA
      // ========================================================

      const requiredFields = {
        beneficiary_name,
        account_number,
        operator_name,
      };

      const missingFields = Object.entries(requiredFields)
        .filter(([, value]) => value == null || String(value).trim() === "")
        .map(([field]) => field);

      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Required fields missing: ${missingFields.join(", ")}`,
        });
      }

      const normalizedOperator = String(operator_name).trim().toLowerCase();

      if (!["moncash", "natcash"].includes(normalizedOperator)) {
        return res.status(400).json({
          success: false,
          message: "Invalid transfer operator.",
        });
      }

      // ========================================================
      // 7. ENCONTRAR OU ATUALIZAR O CLIENTE
      // ========================================================

      let clientId = client_id ?? null;

      if (clientId !== null && clientId !== "") {
        // O ID informado deve corresponder a um cliente existente.
        const { data: existingById, error: findByIdError } = await supabase
          .from("clients")
          .select("id, doc_id")
          .eq("id", clientId)
          .maybeSingle();

        if (findByIdError) {
          console.error("Error finding client by ID:", findByIdError);

          return res.status(500).json({
            success: false,
            message: "Unable to retrieve the selected client.",
          });
        }

        if (!existingById) {
          return res.status(400).json({
            success: false,
            message: "The selected client does not exist.",
          });
        }

        // Evita associar um ID de cliente a outro documento.
        if (
          doc_id &&
          String(existingById.doc_id).trim().toLowerCase() !==
            String(doc_id).trim().toLowerCase()
        ) {
          return res.status(400).json({
            success: false,
            message: "The client ID and document do not match.",
          });
        }

        clientId = existingById.id;
      } else {
        const normalizedDocId = typeof doc_id === "string" ? doc_id.trim() : "";

        const normalizedClientName =
          typeof client_name === "string" ? client_name.trim() : "";

        if (!normalizedDocId || !normalizedClientName) {
          return res.status(400).json({
            success: false,
            message: "Client document and name are required.",
          });
        }

        const { data: existingClient, error: findClientError } = await supabase
          .from("clients")
          .select("id")
          .eq("doc_id", normalizedDocId)
          .maybeSingle();

        if (findClientError) {
          console.error("Error finding client:", findClientError);

          return res.status(500).json({
            success: false,
            message: "Unable to retrieve client information.",
          });
        }

        if (existingClient) {
          // Atualiza somente os dados do cliente.
          // Preserva inserted_by e created_at.
          const { data: updatedClient, error: updateClientError } =
            await supabase
              .from("clients")
              .update({
                client_name: normalizedClientName,
                phone: phone_client ?? null,
                status: "active",
              })
              .eq("id", existingClient.id)
              .select("id")
              .single();

          if (updateClientError) {
            console.error("Error updating client:", updateClientError);

            return res.status(500).json({
              success: false,
              message: "Unable to update the client.",
            });
          }

          clientId = updatedClient.id;
        } else {
          const { data: newClient, error: insertClientError } = await supabase
            .from("clients")
            .insert({
              client_name: normalizedClientName,
              phone: phone_client ?? null,
              doc_id: normalizedDocId,
              inserted_by: user.id,
              status: "active",
            })
            .select("id")
            .single();

          if (insertClientError) {
            // Outro pedido pode ter cadastrado o mesmo documento
            // entre a consulta e a inserção.
            if (insertClientError.code === "23505") {
              const { data: concurrentClient, error: retryError } =
                await supabase
                  .from("clients")
                  .select("id")
                  .eq("doc_id", normalizedDocId)
                  .maybeSingle();

              if (retryError || !concurrentClient) {
                console.error(
                  "Error resolving concurrent client insert:",
                  retryError || insertClientError,
                );

                return res.status(409).json({
                  success: false,
                  message: "Client registration conflict. Please retry.",
                });
              }

              const { data: updatedClient, error: retryUpdateError } =
                await supabase
                  .from("clients")
                  .update({
                    client_name: normalizedClientName,
                    phone: phone_client ?? null,
                    status: "active",
                  })
                  .eq("id", concurrentClient.id)
                  .select("id")
                  .single();

              if (retryUpdateError) {
                console.error(
                  "Error updating concurrent client:",
                  retryUpdateError,
                );

                return res.status(500).json({
                  success: false,
                  message: "Unable to update the existing client.",
                });
              }

              clientId = updatedClient.id;
            } else {
              console.error("Error inserting client:", insertClientError);

              return res.status(500).json({
                success: false,
                message: "Unable to register the client.",
              });
            }
          } else {
            clientId = newClient.id;
          }
        }
      }

      // ========================================================
      // 8. CRIAR A TRANSFERÊNCIA
      // ========================================================

      // Check type not employee or user cannot create transfer for themselves
      if (!["user", "employee", "company"].includes(user.type)) {
        return res.status(400).json({
          success: false,
          message: "Only users, employees, and companies can create transfers.",
        });
      }

      const transfer = await transferModel.createTransfer({
        walletId: user.wallet_id,
        profileId: user.id,
        actorId: user.id,
        doc_id: doc_id ?? null,
        client_name: client_name ?? null,
        client_id: clientId,
        phone: phone_client ?? null,
        beneficiary_name: String(beneficiary_name).trim(),
        account_number: String(account_number).trim(),
        operator_name: normalizedOperator,
        sendValue: amount,
        sendCurrency: user.wallet_currency ?? "BRL",
        fee: dataToSend.fee,
        feeCommission: dataToSend.fee_company,
        feeProvider: dataToSend.fee_provider,
        exchangeRate: dataToSend.exchangeRate,
        receivedValue: dataToSend.estimated,
        receivedCurrency: dataToSend.receivedCurrency,
        neededWallet: user.need_wallet,
      });

      if (!transfer?.success || !transfer?.data?.id) {
        console.error("Error creating transfer:", transfer?.error);

        return res.status(500).json({
          success: false,
          message: transfer?.error?.message || "Failed to create the transfer.",
        });
      }

      // ========================================================
      // 9. RESPOSTA
      // ========================================================

      return res.status(201).json({
        success: true,
        data: {
          id: transfer.data.id,
          client_id: clientId,
          ...dataToSend,
        },
      });
    } catch (error) {
      console.error("createTransfer error:", error);

      return res.status(500).json({
        success: false,
        message: "An unexpected error occurred while creating the transfer.",
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
