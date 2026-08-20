import { json, success } from "zod";
//pdfkit
import PDFDocument from "pdfkit";
import {
  cancelTicketFromSupabse,
  createBetFromSupabase,
  getAllBetLotteriesFromSupabase,
  getAllSortedFromSupabase,
  getFullBetsReportFromSupabase,
  getLotteriesFromSupabase,
  runLotteryDrawFromSupabase,
} from "../db/bet.db.js";
import {
  formatDateToISOInput,
  getHaitiDayBounds,
} from "../helpers/dateHelpers.js";
import { formatCurrency } from "../helpers/helper.js";

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

//Get tickets
const getTickets = async (req, res) => {
  try {
    const {
      start_date,
      end_date,
      lotteryName,
      uuid,
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

    const { startDate, endDate: finalEndDate } = getHaitiDayBounds(
      formatDateToISOInput(start_date),
      formatDateToISOInput(end_date || start_date),
    );

    const pageLimit =
      Number.isFinite(Number(limit)) && Number(limit) > 0
        ? Math.min(Number(limit), 100)
        : 20;

    const currentPage =
      Number.isFinite(Number(page)) && Number(page) > 0 ? Number(page) : 1;

    const tickets = await getAllBetLotteriesFromSupabase({
      uuid: uuid || req.user.uuid,
      startDate,
      endDate: finalEndDate,
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

// Generate PDF report
const generateReportPDF = async (req, res) => {
  try {
    const { start_date, end_date, lotteryName, ticketId, period } = req.query;

    if (!start_date) {
      return res.status(400).json({
        success: false,
        message: "O parâmetro start_date é obrigatório.",
      });
    }

    if (ticketId && !lotteryName) {
      return res.status(400).json({
        success: false,
        message:
          "O parâmetro lotteryName é obrigatório quando ticketId for informado.",
      });
    }

    const { startDate, endDate } = getHaitiDayBounds(
      formatDateToISOInput(start_date),
      formatDateToISOInput(end_date || start_date),
    );

    const report = await getFullBetsReportFromSupabase({
      uuid: req.user.uuid,
      startDate,
      endDate,
      period,
      lotteryName,
      ticketId,
    });

    if (!report.success) {
      return res.status(400).json({
        success: false,
        message: report.error,
      });
    }

    const bets = Array.isArray(report.data) ? report.data : [];
    const totals = report.totals || {};

    const doc = new PDFDocument({
      size: "A4",
      margin: 30,
      bufferPages: true,
    });

    const fileName = `relatorio-apostas-${start_date}-${end_date || start_date}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    doc.pipe(res);

    // Paleta de cores refinada
    const COLORS = {
      primary: "#0d6efd",
      secondary: "#6c757d",
      success: "#198754",
      danger: "#dc3545",
      warning: "#ffc107",
      info: "#0dcaf0",
      dark: "#212529",
      light: "#f8f9fa",
      white: "#ffffff",
      border: "#dee2e6",
      text: "#495057",
      muted: "#6c757d",
      gradientStart: "#0d6efd",
      gradientEnd: "#0a58ca",
    };

    // ---------- HEADER ----------
    doc
      .fillColor(COLORS.primary)
      .fontSize(24)
      .font("Helvetica-Bold")
      .text(" Relatório Pós-Venda", { align: "left" });

    doc
      .fillColor(COLORS.muted)
      .fontSize(11)
      .font("Helvetica")
      .text("Relatório completo de apostas", { align: "left" });

    doc.moveDown(0.3);

    // Linha decorativa
    doc
      .strokeColor(COLORS.primary)
      .lineWidth(1)
      .moveTo(20, doc.y)
      .lineTo(555, doc.y)
      .stroke();

    doc.moveDown(0.8);

    // Período destacado
    doc
      .fillColor(COLORS.dark)
      .fontSize(11)
      .font("Helvetica-Bold")
      .text(`Período: ${start_date} — ${end_date || start_date}`, {
        align: "left",
      });

    doc.moveDown(1.2);

    // ---------- CARDS DE MÉTRICAS ----------
    const totalBets = Number(totals.totalBets || 0);
    const totalAmount = Number(totals.totalAmount || 0);
    const totalPayout = Number(totals.totalPayout || 0);
    const totalCancelled = Number(totals.totalCancelled || 0);
    const commission = totalAmount * (Number(req.user.percent || 10) / 100);
    const difference = totalAmount - totalPayout - commission;

    const drawCard = (
      x,
      y,
      width,
      icon,
      label,
      value,
      color = COLORS.primary,
    ) => {
      // Sombra (efeito sutil)
      doc.roundedRect(x + 2, y + 2, width, 70, 8).fill("#e9ecef");

      // Card principal
      doc.roundedRect(x, y, width, 70, 8).fill(COLORS.white);
      doc.roundedRect(x, y, width, 70, 8).stroke(COLORS.border, 1);

      // Ícone
      doc
        .fillColor(color)
        .fontSize(16)
        .text(icon, x + 14, y + 8);

      // Label
      doc
        .fillColor(COLORS.muted)
        .fontSize(7.5)
        .font("Helvetica-Bold")
        .text(label.toUpperCase(), x + 40, y + 10, {
          width: width - 20,
        });

      // Valor
      doc
        .fillColor(COLORS.dark)
        .fontSize(16)
        .font("Helvetica-Bold")
        .text(value, x + 14, y + 30, {
          width: width - 28,
        });
    };

    const cardY = doc.y;
    const cardWidth = 128;

    drawCard(
      10,
      cardY,
      cardWidth,
      "",
      "Total de apostas",
      String(totalBets),
      COLORS.primary,
    );
    drawCard(
      168,
      cardY,
      cardWidth,
      "",
      "Vendas",
      formatCurrency(totalAmount),
      COLORS.success,
    );
    drawCard(
      306,
      cardY,
      cardWidth,
      "",
      "Prêmios",
      formatCurrency(totalPayout),
      COLORS.warning,
    );
    drawCard(
      444,
      cardY,
      cardWidth,
      "",
      "Resultado",
      formatCurrency(difference),
      difference >= 0 ? COLORS.success : COLORS.danger,
    );

    doc.y = cardY + 85;

    // Definição das colunas com posições X fixas
    const columns = [
      { name: "Ticket", width: 55, x: 30 },
      { name: "Status", width: 75, x: 85 },
      { name: "Loteria", width: 80, x: 160 },
      { name: "Período", width: 60, x: 240 },
      { name: "Valor", width: 70, x: 300 },
      { name: "Payout", width: 70, x: 370 },
      { name: "Data", width: 95, x: 440 },
    ];

    const tableWidth = 535; // Largura total da tabela
    const rowHeight = 24;

    const drawTableHeader = () => {
      const headerY = doc.y;

      // Fundo do cabeçalho (sem roundedRect para manter alinhamento)
      doc.rect(30, headerY, tableWidth, rowHeight).fill(COLORS.primary);

      // Desenha cada coluna do cabeçalho
      columns.forEach((column) => {
        doc
          .fillColor(COLORS.white)
          .fontSize(7.5)
          .font("Helvetica-Bold")
          .text(column.name, column.x + 6, headerY + 7, {
            width: column.width - 12,
            ellipsis: true,
          });
      });

      doc.y = headerY + rowHeight + 2;
    };

    const drawTableRow = (bet, index) => {
      const rowY = doc.y;
      const rowColor = index % 2 === 0 ? COLORS.light : COLORS.white;

      // Fundo da linha
      doc.rect(30, rowY, tableWidth, rowHeight).fill(rowColor);

      const status = bet.status_bet?.toLowerCase() || "";
      let statusLabel = "N/A";
      let statusColor = COLORS.muted;

      if (status === "won") {
        statusLabel = "✅ GANHOU";
        statusColor = COLORS.success;
      } else if (status === "approved") {
        statusLabel = "✅ APROVADA";
        statusColor = COLORS.primary;
      } else if (status === "pending") {
        statusLabel = "⏳ PENDENTE";
        statusColor = COLORS.warning;
      } else if (status === "lost") {
        statusLabel = "❌ PERDEU";
        statusColor = COLORS.danger;
      } else if (status === "cancelled") {
        statusLabel = "🚫 CANCELADA";
        statusColor = COLORS.muted;
      }

      const values = [
        `#${String(bet.ticket_number || "").padStart(3, "0")}`,
        statusLabel,
        bet.lottery_name || "-",
        bet.period || "-",
        formatCurrency(bet.amount),
        formatCurrency(bet.potential_payout),
        formatDateToISOInput(bet.created_at),
      ];

      // Desenha cada célula da linha
      columns.forEach((column, columnIndex) => {
        const value = values[columnIndex];
        const isStatus = columnIndex === 1;

        doc
          .fillColor(isStatus ? statusColor : COLORS.text)
          .fontSize(7)
          .font(columnIndex === 0 || isStatus ? "Helvetica-Bold" : "Helvetica")
          .text(String(value), column.x + 6, rowY + 7, {
            width: column.width - 12,
            ellipsis: true,
          });
      });

      doc.y = rowY + rowHeight;
    };

    // Desenha o cabeçalho inicial
    drawTableHeader();

    // Desenha as linhas da tabela
    bets.forEach((bet, index) => {
      // Verifica quebra de página
      if (doc.y > 720) {
        doc.addPage();
        doc.y = 30;
        drawTableHeader();
      }

      drawTableRow(bet, index);
    });

    doc.moveDown(1.2);

    // ---------- RODAPÉ COM RESUMO ----------
    if (doc.y > 720) {
      doc.addPage();
      doc.y = 30;
    }

    // Linha divisória
    doc
      .strokeColor(COLORS.border)
      .lineWidth(1)
      .moveTo(30, doc.y)
      .lineTo(565, doc.y)
      .stroke();

    doc.moveDown(0.8);

    // Box com informações adicionais
    doc.roundedRect(30, doc.y, 535, 60, 6).fill(COLORS.light);

    const footerY = doc.y + 8;
    doc
      .fillColor(COLORS.primary)
      .fontSize(9)
      .font("Helvetica-Bold")
      .text("Resumo Financeiro", 44, footerY);

    doc
      .fillColor(COLORS.text)
      .fontSize(8.5)
      .font("Helvetica")
      .text(
        `Comissão: ${formatCurrency(commission)}  |  ` +
          `Canceladas: ${formatCurrency(totalCancelled)}  |  ` +
          `Margem: ${totalAmount > 0 ? ((difference / totalAmount) * 100).toFixed(1) : 0}%`,
        44,
        footerY + 20,
      );

    doc
      .fillColor(COLORS.muted)
      .fontSize(7.5)
      .font("Helvetica")
      .text(
        `Gerado automaticamente em ${new Date().toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}`,
        44,
        footerY + 36,
      );

    doc.end();
  } catch (error) {
    console.error("Erro ao gerar PDF:", error);

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

export {
  createBet,
  runLotteryDraw,
  getTickets,
  cancelTicket,
  getLotteries,
  getAllSorted,
  generateReportPDF,
};
