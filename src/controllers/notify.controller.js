import modelNotify from "../models/supabase/notifySupbase.js";

const controllerNotify = {
  getNotification: async (req, res) => {
    try {
      const response = await modelNotify.fetchNotificationsFromDatabase(); // Replace with your actual database call
      res.status(200).json(response);
    } catch (error) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
};

export default controllerNotify;
