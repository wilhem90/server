//pdfkit
import pdfmake from "pdfmake";
import {
  cancelTicketFromSupabse,
  createBetFromSupabase,
  getAllBetLotteriesFromSupabase,
  getAllSortedFromSupabase,
  getLotteriesFromSupabase,
  runLotteryDrawFromSupabase,
} from "../db/bet.db.js";
import { formatDateToISOInput } from "../helpers/dateHelpers.js";
import { formatCurrency } from "../helpers/helper.js";
import { showBalanceFromSupabase } from "../db/wallet.db.js";

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

    if (amount >= 100) {
      // Addicionar married gratis no choosen_values format 1520 com valor 0.00 3 no maximo
      const gratis = {};

      const mg1 = Math.floor(Math.random() * 10_000)
        .toString()
        .padStart(4, "0");
      const mg2 = Math.floor(Math.random() * 10_000)
        .toString()
        .padStart(4, "0");
      const mg3 = Math.floor(Math.random() * 10_000)
        .toString()
        .padStart(4, "0");
      const mg4 = Math.floor(Math.random() * 10_000)
        .toString()
        .padStart(4, "0");
      const mg5 = Math.floor(Math.random() * 10_000)
        .toString()
        .padStart(4, "0");

      gratis[mg1] = 0;
      gratis[mg2] = 0;
      gratis[mg3] = 0;
      gratis[mg4] = 0;
      gratis[mg5] = 0;

      chosen_values.gratis = gratis;
    }
    // Verificamos se o saldo permitido de finalizar essa transação

    const saldo = await showBalanceFromSupabase(req.user.uuid);

    if (!saldo.success) {
      return res.status(400).json({
        success: false,
        message: saldo.error || "Failed to retrieve balance.",
      });
    }

    if (saldo.data.balance <= 0) {
      return res.status(400).json({
        success: false,
        message: "Insufficient balance to perform this operation.",
      });
    }

    const totalAmount = Number(lotteryName.length) * amount; // Exemplo de cálculo do valor total da aposta

    if (saldo.data.balance < totalAmount) {
      return res.status(400).json({
        success: false,
        message: "Insufficient balance to perform this operation.",
        balance: saldo.data.balance,
        required: totalAmount,
      });
    }

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
        return refCreateBet.ticketRef;
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

//Get tickets
const getTickets = async (req, res) => {
  try {
    const {
      start_date,
      end_date,
      lotteryName,
      uuids, // Cambiado de 'uuid' a 'uuids' para recibir el formato array de Postgres
      ticketId,
      period,
      limit,
      page,
    } = req.query;

    if (ticketId && !lotteryName) {
      return res.status(400).json({
        success: false,
        error: "The lotteryName parameter is mandatory.",
      });
    }

    if (!start_date) {
      return res.status(400).json({
        success: false,
        error: "The start_date parameter is mandatory.",
      });
    }

    const pageLimit =
      Number.isFinite(Number(limit)) && Number(limit) > 0
        ? Math.min(Number(limit), 100)
        : 20;

    const currentPage =
      Number.isFinite(Number(page)) && Number(page) > 0 ? Number(page) : 1;

    // DETERMINAR QUÉ UUIDS ENVIAR A SUPABASE:
    // Si el cliente no envió la lista 'uuids' en el query, usamos por defecto el ID del usuario logueado en formato Postgres array "{ID}"
    const finalUUIDs =
      uuids && uuids.trim() !== "" ? uuids : `{${req.user.uuid}}`;

    const tickets = await getAllBetLotteriesFromSupabase({
      uuids: typeof finalUUIDs === "string" ? [finalUUIDs] : finalUUIDs, // Cambiado el parámetro para enviar la lista estructurada
      startDate: formatDateToISOInput(start_date),
      endDate: formatDateToISOInput(end_date || start_date),
      lotteryName,
      ticketId,
      period,
      limit: pageLimit,
      page: currentPage,
    });

    if (!tickets.success) {
      return res.status(400).json({
        success: false,
        message: tickets.error || "Failed to retrieve tickets.",
      });
    }

    return res.status(200).json({
      success: true,
      count: tickets.data.length,
      page: currentPage,
      meta: tickets.meta,
      totals: tickets.totals,
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
    let { start_date, end_date, lotteryName, limit, page } = req.query;

    // 2. Validação obrigatória apenas do start_date
    if (!start_date) {
      return res.status(400).json({
        success: false,
        error: "The start_date parameter is mandatory.",
      });
    }

    if (!end_date) {
      end_date = start_date;
    }

    if (end_date < start_date) {
      return res.status(400).json({
        success: false,
        message: "Invalid date.",
      });
    }

    const arrayStartDate = start_date.split("-");
    const arrayEndDate = end_date.split("-");

    const start = `${arrayStartDate[2]}-${arrayStartDate[1]}-${arrayStartDate[0]}`;
    const end = `${arrayEndDate[2]}-${arrayEndDate[1]}-${arrayEndDate[0]}`;
    // 4. Tratamento matemático da Paginação (Page -> Offset)
    const pageLimit = limit ? parseInt(limit, 10) : 10;
    const currentPage = page ? parseInt(page, 10) : 1;
    const pageOffset = (currentPage - 1) * pageLimit;

    // 5. Chamada unificada passando os parâmetros mapeados por chaves {}
    const tickets = await getAllSortedFromSupabase({
      startDate: start,
      endDate: end,
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

// =========================================================
// GERAR RELATÓRIO PDF
// =========================================================

const generateReportPDF = async (req, res) => {
  const fonts = {
    Helvetica: {
      normal: "Helvetica",
      bold: "Helvetica-Bold",
      italics: "Helvetica-Oblique",
      bolditalics: "Helvetica-BoldOblique",
    },
  };

  const printer = new pdfmake(fonts);
  try {
    // =====================================================
    // PARÂMETROS
    // =====================================================

    const { start_date, end_date, uuids, period, lottery_name, ticket_id } =
      req.query;

    // =====================================================
    // VALIDAR DATA INICIAL
    // =====================================================

    if (!start_date) {
      return res.status(400).json({
        success: false,
        message: "O parâmetro start_date é obrigatório.",
      });
    }

    // =====================================================
    // UUIDS
    // =====================================================

    let finalUUIDs;

    if (!uuids || uuids.trim() === "") {
      // Usuário logado
      finalUUIDs = [req.user.uuid];
    } else {
      try {
        // -----------------------------------------------
        // Tenta interpretar como JSON
        // -----------------------------------------------

        const parsed = JSON.parse(uuids);

        finalUUIDs = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        // -----------------------------------------------

        finalUUIDs = uuids
          .split(",")
          .map((uuid) => uuid.trim())
          .filter(Boolean);
      }
    }

    // =====================================================
    // GARANTIR ARRAY
    // =====================================================

    if (!Array.isArray(finalUUIDs)) {
      finalUUIDs = [finalUUIDs];
    }

    // =====================================================
    // REMOVER UUIDS VAZIOS
    // =====================================================

    finalUUIDs = finalUUIDs.map((uuid) => String(uuid).trim()).filter(Boolean);

    // =====================================================
    // VALIDAR UUIDS
    // =====================================================

    if (finalUUIDs.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Nenhum UUID válido foi informado.",
      });
    }

    // =====================================================
    // DATA FINAL
    // =====================================================

    const finalEndDate = end_date || start_date;

    // =====================================================
    // BUSCAR DADOS
    // =====================================================

    const report = await getAllBetLotteriesFromSupabase({
      uuids: finalUUIDs,

      startDate: formatDateToISOInput(start_date),

      endDate: formatDateToISOInput(finalEndDate),

      period: period || null,

      lotteryName: lottery_name || null,

      ticketId: ticket_id || null,
    });

    // =====================================================
    // ERRO DO SERVICE
    // =====================================================

    if (!report.success) {
      return res.status(400).json({
        success: false,
        message: report.error,
      });
    }

    // =====================================================
    // DADOS
    // =====================================================

    const bets = Array.isArray(report.data) ? report.data : [];

    const totals = report.totals || {};

    // =====================================================
    // MÉTRICAS
    // =====================================================

    const totalBets = Number(totals.totalBets || 0);

    const totalAmount = Number(totals.totalAmount || 0);

    const totalPayout = Number(totals.totalPayout || 0);

    const totalCancelled = Number(totals.totalCancelled || 0);

    // =====================================================
    // COMISSÃO
    // =====================================================

    const percent = Number(req.user.percent ?? 10);

    const commission = totalAmount * (percent / 100);

    // =====================================================
    // RESULTADO
    // =====================================================

    const difference = totalAmount - totalPayout - commission;

    // =====================================================
    // MARGEM
    // =====================================================

    const margin =
      totalAmount > 0 ? ((difference / totalAmount) * 100).toFixed(1) : "0.0";

    // =====================================================
    // CORES
    // =====================================================

    const COLORS = {
      primary: "#0d6efd",
      secondary: "#6c757d",
      success: "#198754",
      danger: "#dc3545",
      warning: "#ffc107",
      dark: "#212529",
      light: "#f8f9fa",
      white: "#ffffff",
      border: "#dee2e6",
      text: "#495057",
      muted: "#6c757d",
    };

    // =====================================================
    // FUNÇÃO PARA STATUS
    // =====================================================

    const getStatus = (status) => {
      const normalized = String(status || "").toLowerCase();

      switch (normalized) {
        case "won":
          return {
            label: "GANHOU",
            color: COLORS.success,
          };

        case "approved":
          return {
            label: "APROVADA",
            color: COLORS.primary,
          };

        case "pending":
          return {
            label: "PENDENTE",
            color: COLORS.warning,
          };

        case "lost":
          return {
            label: "PERDEU",
            color: COLORS.danger,
          };

        case "cancelled":
          return {
            label: "CANCELADA",
            color: COLORS.muted,
          };

        default:
          return {
            label: "N/A",
            color: COLORS.muted,
          };
      }
    };

    // =====================================================
    // TABELA
    // =====================================================

    const tableBody = [
      // ---------------------------------------------------
      // CABEÇALHO
      // ---------------------------------------------------

      [
        {
          text: "Ticket",
          style: "tableHeader",
        },

        {
          text: "Status",
          style: "tableHeader",
        },

        {
          text: "Loteria",
          style: "tableHeader",
        },

        {
          text: "Período",
          style: "tableHeader",
        },

        {
          text: "Valor",
          style: "tableHeader",
        },

        {
          text: "Payout",
          style: "tableHeader",
        },

        {
          text: "Data",
          style: "tableHeader",
        },
      ],
    ];

    // =====================================================
    // LINHAS
    // =====================================================

    bets.forEach((bet) => {
      const status = getStatus(bet.status_bet);

      tableBody.push([
        {
          text: `#${String(bet.ticket_number || "").padStart(3, "0")}`,

          style: "tableCellBold",
        },

        {
          text: status.label,

          color: status.color,

          style: "tableCellBold",
        },

        {
          text: bet.lottery_name || "-",

          style: "tableCell",
        },

        {
          text: bet.period || "-",

          style: "tableCell",
        },

        {
          text: formatCurrency(bet.amount),

          style: "tableCell",
        },

        {
          text: formatCurrency(bet.potential_payout),

          style: "tableCell",
        },

        {
          text: bet.created_at,

          style: "tableCell",
        },
      ]);
    });

    // =====================================================
    // DOCUMENT DEFINITION
    // =====================================================

    const docDefinition = {
      pageSize: "A4",

      pageOrientation: "portrait",

      pageMargins: [30, 35, 30, 40],

      // ===================================================
      // HEADER
      // ===================================================

      header: (currentPage, pageCount) => {
        if (currentPage === 1) {
          return null;
        }

        return {
          margin: [30, 15, 30, 0],

          columns: [
            {
              text: "Relatório Pós-Venda",

              fontSize: 8,

              bold: true,

              color: COLORS.primary,
            },

            {
              text: `Página ${currentPage} de ${pageCount}`,

              alignment: "right",

              fontSize: 7,

              color: COLORS.muted,
            },
          ],
        };
      },

      // ===================================================
      // FOOTER
      // ===================================================

      footer: (currentPage, pageCount) => {
        return {
          margin: [30, 10, 30, 10],

          columns: [
            {
              text: "Relatório completo de apostas",

              fontSize: 7,

              color: COLORS.muted,
            },

            {
              text: `Página ${currentPage} de ${pageCount}`,

              alignment: "right",

              fontSize: 7,

              color: COLORS.muted,
            },
          ],
        };
      },

      // ===================================================
      // CONTEÚDO
      // ===================================================

      content: [
        // -------------------------------------------------
        // TÍTULO
        // -------------------------------------------------

        {
          text: "Relatório Pós-Venda",

          style: "title",
        },

        {
          text: "Relatório completo de apostas",

          style: "subtitle",
        },

        // -------------------------------------------------
        // LINHA
        // -------------------------------------------------

        {
          canvas: [
            {
              type: "line",

              x1: 0,

              y1: 0,

              x2: 535,

              y2: 0,

              lineWidth: 1,

              lineColor: COLORS.primary,
            },
          ],

          margin: [0, 5, 0, 10],
        },

        // -------------------------------------------------
        // PERÍODO
        // -------------------------------------------------

        {
          text: `Período: ${start_date} — ${finalEndDate}`,

          style: "period",

          margin: [0, 0, 0, 12],
        },

        // =================================================
        // CARDS
        // =================================================

        {
          columns: [
            // ---------------------------------------------
            // TOTAL APOSTAS
            // ---------------------------------------------

            {
              stack: [
                {
                  text: "TOTAL DE APOSTAS",

                  style: "cardLabel",
                },

                {
                  text: String(totalBets),

                  style: "cardValue",

                  color: COLORS.primary,
                },
              ],

              style: "card",
            },

            // ---------------------------------------------
            // VENDAS
            // ---------------------------------------------

            {
              stack: [
                {
                  text: "VENDAS",

                  style: "cardLabel",
                },

                {
                  text: formatCurrency(totalAmount),

                  style: "cardValue",

                  color: COLORS.success,
                },
              ],

              style: "card",
            },

            // ---------------------------------------------
            // PRÊMIOS
            // ---------------------------------------------

            {
              stack: [
                {
                  text: "PRÊMIOS",

                  style: "cardLabel",
                },

                {
                  text: formatCurrency(totalPayout),

                  style: "cardValue",

                  color: COLORS.warning,
                },
              ],

              style: "card",
            },

            // ---------------------------------------------
            // COMISSÃO
            // ---------------------------------------------

            {
              stack: [
                {
                  text: "COMISSÃO",

                  style: "cardLabel",
                },

                {
                  text: formatCurrency(commission),

                  style: "cardValue",

                  color: COLORS.success,
                },
              ],

              style: "card",
            },

            // ---------------------------------------------
            // RESULTADO
            // ---------------------------------------------

            {
              stack: [
                {
                  text: "RESULTADO",

                  style: "cardLabel",
                },

                {
                  text: formatCurrency(difference),

                  style: "cardValue",

                  color: difference >= 0 ? COLORS.success : COLORS.danger,
                },
              ],

              style: "card",
            },
          ],

          columnGap: 7,

          margin: [0, 5, 0, 15],
        },

        // =================================================
        // TABELA
        // =================================================

        {
          table: {
            headerRows: 1,

            dontBreakRows: true,

            widths: [48, 68, 75, 55, 65, 70, 90],

            body: tableBody,
          },

          layout: {
            // ---------------------------------------------
            // FUNDO
            // ---------------------------------------------

            fillColor: (rowIndex) => {
              if (rowIndex === 0) {
                return COLORS.primary;
              }

              return rowIndex % 2 === 0 ? COLORS.light : null;
            },

            // ---------------------------------------------
            // LINHAS
            // ---------------------------------------------

            hLineColor: () => COLORS.border,

            vLineColor: () => COLORS.border,

            // ---------------------------------------------
            // ESPAÇAMENTO
            // ---------------------------------------------

            paddingLeft: () => 5,

            paddingRight: () => 5,

            paddingTop: () => 5,

            paddingBottom: () => 5,
          },
        },

        // =================================================
        // RESUMO FINANCEIRO
        // =================================================

        {
          text: "Resumo Financeiro",

          style: "sectionTitle",

          margin: [0, 15, 0, 5],
        },

        {
          table: {
            widths: ["*", "*", "*"],

            body: [
              [
                {
                  text: "Comissão",

                  bold: true,

                  color: COLORS.primary,
                },

                {
                  text: "Canceladas",

                  bold: true,

                  color: COLORS.primary,
                },

                {
                  text: "Margem",

                  bold: true,

                  color: COLORS.primary,
                },
              ],

              [
                formatCurrency(commission),

                formatCurrency(totalCancelled),

                `${margin}%`,
              ],
            ],
          },

          layout: {
            fillColor: (rowIndex) => {
              if (rowIndex === 0) {
                return COLORS.light;
              }

              return null;
            },

            hLineColor: () => COLORS.border,

            vLineColor: () => COLORS.border,

            paddingLeft: () => 8,

            paddingRight: () => 8,

            paddingTop: () => 6,

            paddingBottom: () => 6,
          },
        },

        // =================================================
        // DATA DE GERAÇÃO
        // =================================================

        {
          text: `Gerado automaticamente em ${new Date().toLocaleString(
            "pt-BR",
            {
              day: "2-digit",

              month: "2-digit",

              year: "numeric",

              hour: "2-digit",

              minute: "2-digit",
            },
          )}`,

          fontSize: 7,

          color: COLORS.muted,

          margin: [0, 10, 0, 0],
        },
      ],

      // ===================================================
      // ESTILOS
      // ===================================================

      styles: {
        title: {
          fontSize: 24,

          bold: true,

          color: COLORS.primary,

          margin: [0, 0, 0, 3],
        },

        subtitle: {
          fontSize: 11,

          color: COLORS.muted,

          margin: [0, 0, 0, 3],
        },

        period: {
          fontSize: 10,

          bold: true,

          color: COLORS.dark,
        },

        // -----------------------------------------------
        // CARD
        // -----------------------------------------------

        card: {
          fillColor: COLORS.white,

          margin: [0, 0, 0, 0],

          padding: [7, 7, 7, 7],

          alignment: "center",

          border: [COLORS.border, COLORS.border, COLORS.border, COLORS.border],
        },

        cardLabel: {
          fontSize: 6.5,

          bold: true,

          color: COLORS.muted,

          alignment: "center",

          margin: [0, 0, 0, 4],
        },

        cardValue: {
          fontSize: 10,

          bold: true,

          alignment: "center",
        },

        // -----------------------------------------------
        // TABELA
        // -----------------------------------------------

        tableHeader: {
          fontSize: 7,

          bold: true,

          color: COLORS.white,

          alignment: "left",
        },

        tableCell: {
          fontSize: 6.5,

          color: COLORS.text,
        },

        tableCellBold: {
          fontSize: 6.5,

          bold: true,

          color: COLORS.text,
        },

        sectionTitle: {
          fontSize: 10,

          bold: true,

          color: COLORS.primary,
        },
      },

      defaultStyle: {
        font: "Helvetica",

        fontSize: 8,
      },
    };

    // =====================================================
    // GERAR PDF
    // =====================================================

    const pdfDoc = printer.createPdfKitDocument(docDefinition);

    // =====================================================
    // NOME DO ARQUIVO
    // =====================================================

    const fileName = `relatorio-apostas-${start_date}-${finalEndDate}.pdf`;

    // =====================================================
    // HEADERS
    // =====================================================

    res.setHeader("Content-Type", "application/pdf");

    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    // =====================================================
    // ENVIAR PDF
    // =====================================================

    pdfDoc.pipe(res);

    pdfDoc.end();
  } catch (error) {
    console.error("Erro ao gerar PDF:", error);

    // =====================================================
    // EVITAR ERRO DE HEADERS
    // =====================================================

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,

        message: "Erro ao gerar relatório PDF.",

        error: error.message,
      });
    }

    res.end();
  }
};

export default generateReportPDF;

export {
  createBet,
  runLotteryDraw,
  getTickets,
  cancelTicket,
  getLotteries,
  getAllSorted,
  generateReportPDF,
};
