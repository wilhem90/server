import modelCompany from "../models/supabase/company.supabase.js";
import validateCPF from "../utils/validateDoc.js";

// Remove non-digit characters from phone number
function cleanPhone(phone) {
  return phone.replace(/\D/g, "");
}

const companyController = {
  createCompany: async (req, res) => {
    try {
      const { fullname, email, username, password, phone } = req.body;
      const fields = { fullname, email, username, password, phone };
      for (const [key, value] of Object.entries(fields)) {
        if (!value) {
          return res
            .status(400)
            .json({ success: false, error: `Missing required field: ${key}` });
        }
      }
      const { id: user_id, role } = req.user;
      if (!user_id) {
        return res
          .status(400)
          .json({ success: false, error: "Missing user ID" });
      }

      if (["owner", "superadmin", "user"].includes(role)) {
        return res.status(403).json({
          success: false,
          error: "Forbidden, user is not allowed to create a company",
        });
      }

      const data = await modelCompany.createCompany({
        user_id,
        fullname,
        email,
        username,
        password,
        phone: cleanPhone(phone),
      });
      res.json({ success: true, data });
    } catch (error) {
      console.error("Error creating company:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  //   Get My Companies
  myCompanies: async (req, res) => {
    try {
      const { id: user_id, role } = req.user;
      if (!user_id) {
        return res
          .status(400)
          .json({ success: false, error: "Missing user ID" });
      }

      const data = await modelCompany.myCompanies({ user_id });
      res.json({ success: true, data });
    } catch (error) {
      console.error("Error fetching my companies:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  //   Create Employee
  createEmployee: async (req, res) => {
    try {
      const { fullname, email, username, password, phone, role_id } = req.body;
      const fields = {
        fullname,
        email,
        username,
        password,
        phone,
        role_id,
      };
      for (const [key, value] of Object.entries(fields)) {
        if (!value) {
          return res
            .status(400)
            .json({ success: false, error: `Missing required field: ${key}` });
        }
      }
      // Continue with creating the employee after validation
      const { id: company_id, type } = req.user;
      if (type !== "company") {
        return res.status(400).json({
          success: false,
          error: "User is not a company",
        });
      }
      const data = await modelCompany.createEmployee({
        fullname,
        email,
        username,
        password,
        phone: cleanPhone(phone),
        company_id,
        role_id,
      });
      res.json({ success: true, data });
    } catch (error) {
      console.error("Error creating employee:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  myEmployees: async (req, res) => {
    try {
      const { id: company_id, type } = req.user;

      if (!company_id) {
        return res
          .status(400)
          .json({ success: false, error: "Missing company ID" });
      }
      if (type !== "company") {
        return res.status(400).json({
          success: false,
          error: "User is not a company",
        });
      }
      const data = await modelCompany.myEmployees({ company_id });
      res.json({ success: true, ...data });
    } catch (error) {
      console.error("Error fetching my employees:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  //   Update Employee
  updateEmployee: async (req, res) => {
    try {
      const { id: employee_id } = req.params;
      const { id: company_id, type } = req.user;
      if (!company_id || type !== "company" || !employee_id) {
        return res.status(400).json({
          success: false,
          error:
            "Missing company ID, user is not a company, or missing employee ID",
        });
      }

      // Data can usually be updated from the request body
      const { phone, status, role } = req.body;
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  //   Create Client
  createClient: async (req, res) => {
    try {
      const { id: company_id, type } = req.user;

      if (!company_id) {
        return res
          .status(400)
          .json({ success: false, error: "Missing company ID" });
      }
      if (
        ["company", "admin", "superadmin", "employee"].includes(type) === false
      ) {
        return res.status(400).json({
          success: false,
          error: "User is not a company, admin, superadmin, or employee",
        });
      }

      const { client_name, phone, doc_id } = req.body;
      if (!client_name || !phone || !cleanPhone(phone)) {
        return res.status(400).json({
          success: false,
          error: "Missing client name or phone or invalid phone",
        });
      }
      const validDocId = validateCPF(doc_id);
      if (!validDocId) {
        return res.status(400).json({
          success: false,
          error: "Invalid CPF",
        });
      }
      const client = await modelCompany.createClient({
        client_name,
        phone: cleanPhone(phone),
        doc_id: validDocId,
        company_id: req.user.id,
      });
      if (!client.success) {
        return res.status(400).json({
          success: false,
          error: client.error.includes("duplicate")
            ? "Client already exists"
            : client.error,
        });
      }
      res.json({ success: true, data: client.data });
    } catch (error) {
      console.error("Error creating client:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Get client by ID or name
  getClient: async (req, res) => {
    try {
      const { name, doc_id, phone } = req.query;

      if (!name && !doc_id && !phone) {
        return res
          .status(400)
          .json({ success: false, error: "Missing query parameters" });
      }

      const cleanPhoneNumber = phone ? cleanPhone(phone) : null;
      const cleanDocId = doc_id ? validateCPF(doc_id) : null;
      const client = await modelCompany.getClient({
        name,
        doc_id: cleanDocId,
        phone: cleanPhoneNumber,
      });
      if (!client.success || !client.data) {
        return res.status(400).json({ success: false, error: client.error });
      }
      res.json({ success: true, data: client.data });
    } catch (error) {
      console.error("Error fetching client:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getBeneficiary: async (req, res) => {
    try {
      const { account_number } = req.query;

      if (!account_number) {
        return res
          .status(400)
          .json({ success: false, error: "Missing query parameters" });
      }

      const beneficiary = await modelCompany.getBeneficiary({
        account_number,
      });
      if (!beneficiary.success || !beneficiary.data) {
        return res
          .status(400)
          .json({ success: false, error: beneficiary.error });
      }
      res.json({
        success: true,
        data: {
          beneficiary_name: beneficiary.data.beneficiary_name,
          account_number: beneficiary.data.account_number,
          operator_name: beneficiary.data.operator_name,
        },
      });
    } catch (error) {
      console.error("Error fetching beneficiary:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  //   Get Settings App
  getSettingsApp: async (req, res) => {
    try {
      const currentDate = new Date();
      const date = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(currentDate.getDate()).padStart(2, "0")}`;
      let exchange_rate = await modelCompany.configApp({
        name: "exchange_rate",
        date,
      });

      if (exchange_rate.success && !exchange_rate.data) {
        const exchangerate = await fetch(
          `https://v6.exchangerate-api.com/v6/${process.env.EXCHANGE_KEY}/latest/brl`,
        );

        if (exchangerate.ok) {
          const conversion_json = await exchangerate.json();
          const rate = conversion_json.conversion_rates.HTG;

          exchange_rate = await modelCompany.updateAppConfig({
            value: rate,
            name: "exchange_rate",
          });
        }
      }

      res.json(exchange_rate);
    } catch (error) {
      console.error("Error fetching settings app:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
};

export default companyController;
