import supabase, { createAuthClient } from "../models/supabase/conexion.js";
import profilModel from "../models/supabase/profil.supabase.js";
import bcrypt from "bcrypt";

const controlProfil = {
  // Create a new profile
  createProfil: async (req, res) => {
    try {
      const { email, password, username, fullname, phone } = req.body;
      if (!email || !password || !username || !fullname) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields or invalid type",
        });
      }
      const profilData = { email, password, username, fullname, phone };
      const result = await profilModel.createProfil(profilData);
      if (!result.success) {
        return res.status(400).json(result);
      }
      res.json({
        success: true,
        ...result.data,
      });
    } catch (error) {
      console.error("Error creating profile:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Login profile using username and password
  loginProfil: async (req, res) => {
    try {
      const { username, password } = req.body;
      let email;
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields",
        });
      }

      const profiles = await profilModel.getProfileByUsername(username);
      if (!profiles?.length) {
        return res.status(401).json({
          success: false,
          error: "Invalid username or password",
        });
      }

      email = profiles[0].email;
      const { data, error } = await createAuthClient().auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Supabase login error:", error);

        return res.status(401).json({
          success: false,
          error: "Invalid username or password",
        });
      }

      if (!data?.user || !data?.session) {
        return res.status(400).json({
          success: false,
          error: "Login failed",
        });
      }

      return res.json({
        success: true,
        user: { ...data.user.user_metadata },
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        expires_in: data.session.expires_in,
      });
    } catch (error) {
      console.error("Login model error:", error);

      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
  // Logout all profile sessions
  logoutProfil: async (req, res) => {
    try {
      const access_token = req.headers.authorization?.split(" ")[1];
      if (!access_token) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      const { error } = await supabase.auth.admin.signOut(access_token);
      if (error) {
        return res.status(400).json({ success: false, error: error.message });
      }

      res
        .status(200)
        .json({ success: true, message: "Logged out successfully" });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Get profile by username
  getProfileByUsername: async (req, res) => {
    try {
      const { username } = req.user || { username: null };
      if (!username) {
        return res
          .status(400)
          .json({ success: false, error: "Missing required fields" });
      }

      const profile = await profilModel.getProfileByUsername(username);

      if (!profile) {
        return res
          .status(404)
          .json({ success: false, error: "Profile not found" });
      }

      res.json({
        success: true,
        data: profile,
      });
    } catch (error) {
      console.error("Error fetching profile by username:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  updateProfile: async (req, res) => {
    try {
      const validdFields = [
        "fullname",
        "username",
        "pin_transaction",
        "phone",
      ];

      // Get all valid fields from the request body if not empty
      const dataFields = {};

      validdFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          dataFields[field] = req.body[field];
        }
      });

      if (dataFields.pin_transaction) {
        const pin_transaction = dataFields.pin_transaction;
        const validatePin = pin_transaction && pin_transaction.length === 4;
        if (!validatePin) {
          return res.status(400).json({ success: false, error: "Invalid pin" });
        }
        dataFields.pin_transaction = bcrypt.hashSync(pin_transaction, 10);
      }

      if (dataFields.phone) {
        dataFields.phone = dataFields.phone.trim();
      }

      if (dataFields.email) {
        dataFields.email = dataFields.email.trim().toLowerCase();
      }

      if (dataFields.username) {
        dataFields.username = dataFields.username.trim().toLowerCase();
      }

      if (dataFields.fullname) {
        dataFields.fullname = dataFields.fullname.trim();
      }

      const { id: user_id } = req.user;
      if (!user_id) {
        return res
          .status(400)
          .json({ success: false, error: "Missing user ID" });
      }
      const data = await profilModel.updateProfile(user_id, {
        ...dataFields,
      });
      res.json({ success: true, data });
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
};

export default controlProfil;
