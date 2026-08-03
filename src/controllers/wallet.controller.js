import { showBalanceFromSupabase } from "../db/wallet.db.js";

const showBalance = async (req, res) => {
  try {
    const refBalance = await showBalanceFromSupabase(req.user.uuid);

    console.log(refBalance);

    return res.status(200).json({
      success: true,
      data: {
        balance: Number(refBalance?.balance || 0).toLocaleString("pt-BR", {
          style: "currency",
          currency: refBalance.currency,
        }),
        account: refBalance.account,
        currency: refBalance.currency,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export { showBalance };
