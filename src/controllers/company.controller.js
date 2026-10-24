import modelCompany from "../models/supabase/company.supabase.js";
import validateCPF from "../utils/validateDoc.js";
import handleExchangeRate from "../apis/exchangeRate.js";

// Remove non-digit characters from phone number
function cleanPhone(phone) {
  return String(phone ?? "").replace(/\D/g, "");
}

// Keeps only the first/last digits visible, e.g. 123*****45
function maskDigits(value, start, end) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length <= start + end) return "*".repeat(digits.length);
  return (
    digits.slice(0, start) +
    "*".repeat(digits.length - start - end) +
    digits.slice(-end)
  );
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
      const { id: user_id } = req.user;
      if (!user_id) {
        return res
          .status(400)
          .json({ success: false, error: "Missing user ID" });
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
        phone,
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
        phone: cleanPhone(phone),
        company_id,
      });
      res.json({ ...data });
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

      return res.status(501).json({
        success: false,
        error: "Employee update is not implemented yet",
      });
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
        profile_id: req.user.id,
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
      if (doc_id && !cleanDocId) {
        return res.status(400).json({ success: false, error: "Invalid CPF" });
      }
      const client = await modelCompany.getClient({
        name,
        doc_id: cleanDocId,
        phone: cleanPhoneNumber,
      });
      if (!client.success) {
        return res.status(400).json({ success: false, error: client.error });
      }
      if (!client.data) {
        return res.status(404).json({
          success: false,
          found: false,
          error: "Client not found",
        });
      }
      res.json({
        success: true,
        data: {
          id: c.id,
          client_name: c.client_name,
          doc_id: maskDigits(c.doc_id, 3, 2),
          phone: maskDigits(c.phone, 2, 2),
          status: c.status,
        },
      });
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
      const data = await handleExchangeRate();

      if (!data) {
        return res.status(503).json({
          success: false,
          error: "A valid exchange rate is not available.",
        });
      }

      res.json({ success: true, data });
    } catch (error) {
      console.error("Error fetching settings app:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
};

export default companyController;
