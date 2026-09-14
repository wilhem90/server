import requestDing from "../configs/requestDing.js";
import modelTopUp from "../db/topup.db.js";

// Control topup
const controlTopUp = {
  // ============================================================
  // BUSCAR PAÍSES
  // ============================================================
  GetCountries: async (req, res) => {
    try {
      const dataCountries = await requestDing("GetCountries", "GET");

      if (!dataCountries.success) {
        return res.status(502).json({
          success: false,
          message: dataCountries.message || "Erro ao buscar países.",
          errors: dataCountries.errors || null,
        });
      }

      return res.status(200).json({
        success: true,
        ResultCode: dataCountries.ResultCode,
        Items: dataCountries.Items || [],
      });
    } catch (error) {
      console.error("Erro GetCountries:", error);

      return res.status(500).json({
        success: false,
        message: error.message || "Erro interno ao buscar países.",
      });
    }
  },

  // ============================================================
  // BUSCAR OPERADORA
  // ============================================================
  GetProviders: async (req, res) => {
    try {
      let { accountNumber, countryIsos } = req.query;

      if (!countryIsos) {
        return res.status(400).json({
          success: false,
          message: "Parâmetro countryIsos é obrigatório.",
        });
      }

      if (!accountNumber) {
        return res.status(400).json({
          success: false,
          message: "Parâmetro accountNumber é obrigatório.",
        });
      }

      accountNumber = String(accountNumber).replace(/\D/g, "");

      if (!accountNumber) {
        return res.status(400).json({
          success: false,
          message: "Número de telefone inválido.",
        });
      }

      const dataProviders = await requestDing(
        `GetProviders?accountNumber=${encodeURIComponent(
          accountNumber,
        )}&c=${encodeURIComponent(countryIsos)}`,
        "GET",
      );

      if (!dataProviders.success) {
        return res.status(502).json({
          success: false,
          message: dataProviders.message || "Erro ao buscar operadoras.",
          errors: dataProviders.errors || null,
        });
      }

      return res.status(200).json({
        success: true,
        ResultCode: dataProviders.ResultCode,
        Items: dataProviders.Items || [],
      });
    } catch (error) {
      console.error("Erro GetProviders:", error);

      return res.status(500).json({
        success: false,
        message: error.message || "Erro interno ao buscar operadoras.",
      });
    }
  },

  // ============================================================
  // BUSCAR PRODUTOS
  // ============================================================
  GetProducts: async (req, res) => {
    try {
      let { accountNumber, providerCodes } = req.query;

      if (!accountNumber) {
        return res.status(400).json({
          success: false,
          message: "Parâmetro accountNumber é obrigatório.",
        });
      }

      if (!providerCodes) {
        return res.status(400).json({
          success: false,
          message: "Parâmetro providerCodes é obrigatório.",
        });
      }

      accountNumber = String(accountNumber).replace(/\D/g, "");

      if (!accountNumber) {
        return res.status(400).json({
          success: false,
          message: "Número de telefone inválido.",
        });
      }

      const dataProducts = await requestDing(
        `GetProducts?accountNumber=${encodeURIComponent(
          accountNumber,
        )}&providerCodes=${encodeURIComponent(providerCodes)}`,
        "GET",
      );

      if (!dataProducts.success) {
        return res.status(502).json({
          success: false,
          message: dataProducts.message || "Erro ao buscar produtos.",
          errors: dataProducts.errors || null,
        });
      }

      return res.status(200).json({
        success: true,
        ResultCode: dataProducts.ResultCode,
        Items: dataProducts.Items || [],
      });
    } catch (error) {
      console.error("Erro GetProducts:", error);

      return res.status(500).json({
        success: false,
        message: error.message || "Erro interno ao buscar produtos.",
      });
    }
  },

  // ============================================================
  // ENVIAR TOPUP
  // ============================================================
  SendTopup: async (req, res) => {
    try {
      let { skuCode, sendValue, accountNumber, distributorRef, validateOnly } =
        req.body;

      // Validação correta
      if (!skuCode) {
        return res.status(400).json({
          success: false,
          message: "skuCode é obrigatório.",
        });
      }

      if (sendValue == null || sendValue === "") {
        return res.status(400).json({
          success: false,
          message: "sendValue é obrigatório.",
        });
      }

      if (!accountNumber) {
        return res.status(400).json({
          success: false,
          message: "accountNumber é obrigatório.",
        });
      }

      if (!distributorRef) {
        return res.status(400).json({
          success: false,
          message: "distributorRef é obrigatório.",
        });
      }

      // false pode ser válido
      if (validateOnly == null) {
        return res.status(400).json({
          success: false,
          message: "validateOnly é obrigatório.",
        });
      }

      accountNumber = String(accountNumber).replace(/\D/g, "");

      if (!accountNumber) {
        return res.status(400).json({
          success: false,
          message: "Número de telefone inválido.",
        });
      }

      const topupData = {
        skuCode,
        sendValue,
        accountNumber,
        distributorRef,
        validateOnly: Boolean(validateOnly),
      };

      const createdTopup = await modelTopUp.createTopUp(
        { userId: req.user.uuid },
        topupData,
      );

      // const response = await requestDing("SendTransfer", "POST", topupData);

      // if (!response.success) {
      //   return res.status(502).json({
      //     success: false,
      //     message: response.message || "Erro ao enviar recarga.",
      //     errors: response.errors || null,
      //   });
      // }

      return res.status(200).json({
        success: true,
        message: "Topup enviado com sucesso!",
        // data: response.TransferRecord || null,
        // response,
        createdTopup,
      });
    } catch (error) {
      console.error("Erro SendTransfer:", error);

      return res.status(500).json({
        success: false,
        message: error.message || "Erro interno. Tente novamente!",
      });
    }
  },

  // ============================================================
  // HISTÓRICO DE TOPUPS
  // ============================================================
  GetTopups: async (req, res) => {
    const { startDate, endDate, emailUser, pageSize, lastCreatedAt } =
      req.query;

    if (!startDate || !emailUser) {
      return res.status(400).json({
        success: false,
        message: "Parâmetros inválidos! Informe startDate e emailUser.",
      });
    }

    const emailList = Array.isArray(emailUser) ? emailUser : [emailUser];

    try {
      const results = await Promise.all(
        emailList.map((email) =>
          modelTopUp.GetTopups({
            startDate,
            endDate,
            email,
            pageSize,
            lastCreatedAt,
          }),
        ),
      );

      const allItems = results.flatMap((result) => result.items || []);

      const lastVisible =
        results.find((result) => result.lastVisible)?.lastVisible || null;

      return res.status(200).json({
        success: true,
        items: allItems,
        lastVisible,
      });
    } catch (error) {
      console.error("Erro ao buscar topups:", error);

      return res.status(500).json({
        success: false,
        message: "Erro interno ao buscar topups.",
      });
    }
  },
};

export default controlTopUp;
