import supabase from "./conexion.js";

const modelNotify = {
  fetchNotificationsFromDatabase: async (userId) => {
    if (!userId) throw new Error("Authenticated user is required");
    const { data, error } = await supabase
      .from("notifications")
      .select("id,title,message,type,read_at,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(50);
    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }
    return {
      success: true,
      data,
    };
  },
};

export default modelNotify;
