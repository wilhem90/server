import supabase from "./conexion.js";

const modelNotify = {
  fetchNotificationsFromDatabase: async (userId) => {
    if (!userId) throw new Error("Authenticated user is required");
    const { data, error } = await supabase
      .from("payers_authorized")
      .select(`
        notifications (
          id,
          title,
          message,
          type,
          created_at
        )
        `)
      .eq("payer_id", userId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(10);
    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }
    return {
      success: true,
      data: data?.[0]?.notifications || [],
    };
  },
};

export default modelNotify;
