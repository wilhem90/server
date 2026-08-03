import {
  listAllMyCompanyFromSupabase,
  listAllMyCompanyUsersFromSupabase,
} from "../db/enterprise.db.js";

//All enterprises
const getAllCompanies = async (req, res) => {
  try {
    const { uuid } = req.user;
    const refEnterPrises = await listAllMyCompanyFromSupabase(uuid);
    console.log(refEnterPrises);

    if (!refEnterPrises.success) {
      return res.status(404).json({
        success: false,
        message: "Not found enterprise",
      });
    }

    return res.status(200).json({
      success: true,
      data: refEnterPrises.data,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Internal error.",
    });
  }
};

//My company users
const listAllMyCompanyUsers = async (req, res) => {
  try {
    const { uuid } = req.user;
    const refEnterPrises = await listAllMyCompanyUsersFromSupabase("4a6872ce-60ce-47c5-96cf-929cde782708");
    console.log(refEnterPrises);

    if (!refEnterPrises.success) {
      return res.status(404).json({
        success: false,
        message: "Not found enterprise",
      });
    }

    return res.status(200).json({
      success: true,
      total: refEnterPrises.total,
      data: refEnterPrises.data,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Internal error.",
    });
  }
};

export { getAllCompanies, listAllMyCompanyUsers };
