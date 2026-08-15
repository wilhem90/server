import { json, success } from "zod";
import {
  cancelTicketFromSupabse,
  createBetFromSupabase,
  getAllBetLotteriesFromSupabase,
  getAllSortedFromSupabase,
  getLotteriesFromSupabase,
  runLotteryDrawFromSupabase,
} from "../db/bet.db.js";
import {
  formatDateToISOInput,
  getHaitiDayBounds,
} from "../helpers/dateHelpers.js";

// Create ticket
const createBet = async (req, res) => {
  try {
    const {
      lotteryName,
      amount,
      chosen_values,
      externalReference,
      pinTransaction,
    } = req.body;

    console.log(req.body);

    if (
      !lotteryName ||
      !amount ||
      !chosen_values ||
      !externalReference ||
      !pinTransaction
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }
    const lotteries = await getLotteriesFromSupabase();

    // Filtra apenas loterias válidas
    const validLotteries = lotteries.data.filter(
      (lt) => lotteryName.includes(lt.id) && lt.is_active,
    );

    // Cria uma cópia para o mapeamento seguro dos índices em paralelo

    // Cria múltiplos tickets em paralelo
    const results = await Promise.all(
      validLotteries.map((lt) =>
        createBetFromSupabase(
          req.user.uuid,
          lt.lottery_name,
          lt.period,
          amount,
          chosen_values,
          externalReference[0],
          pinTransaction,
          externalReference.shift(), // Usa o índice fixo em vez de shift() concorrente
        ),
      ),
    );

    // Mapeia a resposta separando os sucessos e falhas na mesma lista
    const processedTickets = results.map((refCreateBet, index) => {
      if (refCreateBet.success) {
        return {
          status: "success",
          id: refCreateBet.ticketRef?.o_ticket_ref,
          ticket_number: refCreateBet.ticketRef?.o_ticket_number
            ? String(refCreateBet.ticketRef.o_ticket_number).padStart(3, "0")
            : null,
          betId: refCreateBet.betId,
          lotteryName: validLotteries[index].lottery_name,
          period: validLotteries[index].period,
          amount,
          chosen_values,
        };
      } else {
        // Formata a mensagem de erro específica deste ticket
        const errorMessage =
          refCreateBet.error?.code === "23505"
            ? "Please check your external key reference."
            : refCreateBet.error?.message || "Unknown error";

        return {
          status: "failed",
          error: errorMessage,
          lotteryName: validLotteries[index].lottery_name,
          period: validLotteries[index].period,
          amount,
          chosen_values,
        };
      }
    });

    // Retorna a lista completa com o status de cada um
    return res.status(200).json({
      success: true,
      data: processedTickets,
    });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// All tickets
const getTickets = async (req, res) => {
  try {
    // 1. Extração dos filtros da URL
    const { start_date, end_date, lotteryName, ticketId, period, limit, page } =
      req.query;

    if (ticketId && !lotteryName) {
      return res.status(400).json({
        success: false,
        error: "The lotteryName parameter is mandatory.",
      });
    }
    // 2. Validação obrigatória apenas do start_date
    if (!start_date) {
      return res.status(400).json({
        success: false,
        error: "The start_date parameter is mandatory.",
      });
    }

    // Chamada unificada do helper que limpa, formata e aplica o fuso horário do Haiti
    const { startDate, endDate } = getHaitiDayBounds(
      formatDateToISOInput(start_date),
      formatDateToISOInput(end_date || start_date),
    );

    console.log(startDate, endDate);

    // 4. Tratamento matemático da Paginação (Page -> Offset)
    const pageLimit = limit ? parseInt(limit, 10) : 10;
    const currentPage = page ? parseInt(page, 10) : 1;
    const pageOffset = (currentPage - 1) * pageLimit;

    // 5. Chamada unificada passando os parâmetros mapeados por chaves {}
    const tickets = await getAllBetLotteriesFromSupabase({
      uuid: req.user.uuid,
      startDate, // String no formato ISO travada no início do dia do Haiti
      endDate, // String no formato ISO travada no fim do dia do Haiti
      lotteryName,
      limit: pageLimit,
      offset: pageOffset,
      period,
      ticketId,
    });

    if (!tickets.success) {
      return res.status(400).json({
        success: false,
        message: tickets.error || "Failed to retrieve tickets.",
      });
    }

    return res.status(200).json({
      success: true,
      count: tickets.data?.length || 0,
      page: currentPage,
      meta: tickets.meta,
      data: tickets.data,
    });
  } catch (error) {
    console.error("Error in the getTickets controller:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

//Update lotteries with sorted numbers
const runLotteryDraw = async (req, res) => {
  try {
    const { lotteryName, period, dateLottery } = req.body;
    const sorted = req.sortedNumbers;

    // 1. Validação defensiva rápida no Express
    if (!lotteryName || !period || !dateLottery) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required parameters: lotteryName, period, or dateLottery.",
      });
    }

    if (!sorted || typeof sorted !== "object") {
      return res.status(400).json({
        success: false,
        message: "Sorted numbers not found or invalid.",
      });
    }

    // 2. Dispara a lógica pesada diretamente no Banco de Dados
    const insertSorted = await runLotteryDrawFromSupabase(
      lotteryName,
      period,
      dateLottery,
      sorted,
    );

    if (!insertSorted.success) {
      return res.status(401).json({
        success: false,
        message: insertSorted.error.message,
      });
    }

    // Retorna a lista de resultados processada com sucesso
    return res.status(200).json({
      success: true,
      message: insertSorted.message,
    });
  } catch (error) {
    console.error("Erro crítico no processamento do sorteio:", error);
    return res.status(500).json({
      success: false,
      message: "Please try again later.",
    });
  }
};

const cancelTicket = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: true,
        message: "Data invalid to cancel ticket.",
      });
    }

    const refTicket = await cancelTicketFromSupabse(req.user.uuid, id);

    if (!refTicket.success) {
      console.log(refTicket.error);
      return res.status(400).json({
        success: true,
        message: refTicket.error.message || "Ticket not canceled.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Ticekt canceled.",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//List lottery active
const getLotteries = async (req, res) => {
  try {
    const lotteries = await getLotteriesFromSupabase();

    if (!lotteries.success) {
      return res.status(400).json({
        success: false,
        message: lotteries.error,
      });
    }

    return res.status(200).json({
      success: true,
      data: lotteries?.data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error internal please try again later.",
    });
  }
};

const getAllSorted = async (req, res) => {
  try {
    // 1. Extração dos filtros da URL
    const {
      start_date: startDate,
      end_date,
      lotteryName,
      limit,
      page,
    } = req.query;

    // 2. Validação obrigatória apenas do start_date
    if (!startDate) {
      return res.status(400).json({
        success: false,
        error: "The start_date parameter is mandatory.",
      });
    }

    let endDate;

    if (end_date) {
      endDate = startDate;
    }

    if (endDate < startDate) {
      return res.status(400).json({
        success: false,
        message: "Invalid date.",
      });
    }

    // 4. Tratamento matemático da Paginação (Page -> Offset)
    const pageLimit = limit ? parseInt(limit, 10) : 10;
    const currentPage = page ? parseInt(page, 10) : 1;
    const pageOffset = (currentPage - 1) * pageLimit;

    // 5. Chamada unificada passando os parâmetros mapeados por chaves {}
    const tickets = await getAllSortedFromSupabase({
      startDate,
      endDate,
      lotteryName,
      limit: pageLimit,
      offset: pageOffset,
    });

    if (!tickets.success) {
      return res.status(400).json({
        success: false,
        message: tickets.error || "Failed to retrieve tickets.",
      });
    }

    return res.status(200).json({
      success: true,
      page: currentPage,
      meta: tickets.meta, // Retorna os dados de paginação vindos do banco
      data: tickets.data,
    });
  } catch (error) {
    console.error("Error in the getSorted controller:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

export {
  createBet,
  runLotteryDraw,
  getTickets,
  cancelTicket,
  getLotteries,
  getAllSorted,
};
