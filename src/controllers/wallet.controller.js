import { showBalanceFromSupabase } from "../db/wallet.db.js";

const showBalance = async (req, res) => {
  try {
    const refBalance = await showBalanceFromSupabase(req.user.uuid);

    return res.status(200).json({
      success: true,
      data: {
        balance: refBalance?.balance || 0,
        account: refBalance?.account,
        currency: refBalance?.currency,
        status: refBalance?.status,
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
