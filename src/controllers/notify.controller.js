import modelNotify from "../models/supabase/notifySupbase.js";

const controllerNotify = {
  getNotification: async (req, res) => {
    try {
      const response = await modelNotify.fetchNotificationsFromDatabase(req.authUser.id);
      if (!response.success) {
        console.error("[Notifications] Database query failed:", response.error);
        return res.status(500).json({ success: false, error: "Could not load notifications." });
      }
      res.set("Cache-Control", "no-store");
      return res.status(200).json(response);
    } catch (error) {
      console.error("[Notifications] Unexpected error:", error);
      return res.status(500).json({ success: false, error: "Could not load notifications." });
    }
  },
};

export default controllerNotify;
