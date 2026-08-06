import { showBalanceFromSupabase } from "../db/wallet.db.js";

const showBalance = async (req, res) => {
  try {
    const refBalance = await showBalanceFromSupabase(req.user.uuid);

    return res.status(200).json({
      success: true,
      data: {
        balance: refBalance.data?.balance || 0,
        account: refBalance.data?.number_account,
        currency: refBalance.data.currency,
        status: refBalance.data?.status,
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
