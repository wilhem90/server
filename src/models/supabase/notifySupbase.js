import supabase from "./conexion.js";

const modelNotify = {
  fetchNotificationsFromDatabase: async () => {
    const { data, error } = await supabase.from("notifications").select("*");
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
