import { z } from "zod";

const winning = (data) => {
  if (!["morning", "evening", "night"].includes(data.period)) {
    return "Period lottery invalid.";
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.dateLottery)) {
    return "Date selected invalid. 0000-00-00";
  }

  if (String(data.winningValues.lo1).length !== 3) {
    return "Winning numbers incorrect. lo1 must be 3 digits";
  }
  if (String(data.winningValues.lo2).length !== 2) {
    return "Winning numbers incorrect. lo2 must be 2 digits";
  }
  if (String(data.winningValues.lo3).length !== 2) {
    return "Winning numbers incorrect. lo3 must be 2 digits";
  }
};

const winningFormat = async (req, res, next) => {
  // 1. Valida e tipa toda a requisição usando o Zod de uma vez só
  const { lo1, lo2, lo3 } = req.body.winningValues
  ;
  
  // 2. Executa a sua inteligência matemática de combinações (Imutável e segura)
  const sortedNumbers = {
    sorted1: lo1.substring(1, 3),
    sorted2: lo2,
    sorted3: lo3,
    lotto3: lo1,
    lotto41: `${lo1.substring(1, 3)}${lo2}`,
    lotto42: `${lo1.substring(1, 3)}${lo3}`,
    lotto43: `${lo2}${lo3}`,
    married1: `${lo1.substring(1, 3)}${lo2}`,
    married2: `${lo1.substring(1, 3)}${lo3}`,
    married3: `${lo1}${lo3}`,
    married4: `${lo2}${lo1.substring(1, 3)}`,
    married5: `${lo3}${lo1.substring(1, 3)}`,
    married6: `${lo3}${lo2}`,
    lotto51: `${lo1}${lo2}`,
    lotto52: `${lo1}${lo3}`,
    lotto53: `${lo1.substring(2, 3)}${lo2}${lo3}`,
  };
  
  if (winning(req.body)) {
    return res.status(400).json({
      success: false,
      message: winning(req.body),
    });
  }
  req.sortedNumbers = sortedNumbers;
  return next();
};

//Validate chosen_values and amount
const checkMetadata = async (req, res, next) => {
  const { chosen_values, amount, } = req.body;

  if (!chosen_values) {
    return res.status(400).json({
      success: false,
      message: "Metadata required.",
    });
  }

  let soma = 0;

  for (const category of Object.values(chosen_values)) {
    for (const value of Object.values(category)) {
      soma += Number(value);
    }
  }

  if (Number(amount) !== soma) {
    return res.status(400).json({
      success: false,
      message: "Amount not valid",
    });
  }

  next();
};

export { winningFormat, checkMetadata };
