import {
  createCompanyInDatabase,
  createProfileInDatabase,
  loginCompanyInDatabase,
  getCompanyFromDatabase,
  getProfileFromDatabase,
} from "../db/companies.db.js";

const createCompany = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: "Email and password are required",
    });
  }

  const company = await createCompanyInDatabase({ email, password }); // Assuming you have a function to create the company in the database
  if (!company.success) {
    return res.status(500).json({
      success: false,
      error: company.error,
    });
  }
  return res.status(201).json({
    success: true,
    data: {
      email,
    },
  });
};

const createProfile = async (req, res) => {
  const { companyId, profileData } = req.body;
  if (!companyId || !profileData) {
    return res.status(400).json({
      success: false,
      error: "Company ID and profile data are required",
    });
  }

  // Assuming you have a function to create the profile in the database
  const profile = await createProfileInDatabase({ companyId, profileData });
  if (!profile.success) {
    return res.status(500).json({
      success: false,
      error: profile.error,
    });
  }
  return res.status(201).json({
    success: true,
    data: profile.data,
  });
};

const loginCompany = async (req, res) => {
  console.log("Cheguei por ai mesmo");

  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required",
      });
    }

    const company = await loginCompanyInDatabase({ email, password });
    if (!company.success) {
      return res.status(401).json({
        success: false,
        error: company.error,
      });
    }
    return res.status(200).json({
      success: true,
      data: company.data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const getMyProfile = async (req, res) => {
  try {
    const { id } = req.user;

    const profile = await getProfileFromDatabase(id); // Assuming you have a function to get the profile from the database
    if (!profile.success) {
      return res.status(404).json({
        success: false,
        error: profile.error,
      });
    }
    return res.status(200).json({
      success: true,
      data: profile.data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const getMyCompany = async (req, res) => {
  try {
    const { id } = req.user;

    const company = await getCompanyFromDatabase(id); // Assuming you have a function to get the company from the database
    if (!company.success) {
      return res.status(404).json({
        success: false,
        error: company.error,
      });
    }
    return res.status(200).json({
      success: true,
      data: company.data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const recoveryPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Email is required",
      });
    }
    return res.status(200).json({
      success: true,
      message: "Recovery email sent successfully",
      data: await recoveryPasswordInDatabase({ email }),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
export {
  createCompany,
  createProfile,
  loginCompany,
  recoveryPassword,
  getMyCompany,
  getMyProfile,
};
