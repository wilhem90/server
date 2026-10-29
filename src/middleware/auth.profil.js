import supabase from "../models/supabase/conexion.js";
import profilModel from "../models/supabase/profil.supabase.js";

const middlewareAuthProfil = {
  validateAuth: async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized, missing authorization header",
        });
      }

      const [type, token] = authHeader.split(" ");

      if (type !== "Bearer" || !token) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized, invalid authorization format",
        });
      }

      // Valida o JWT no Supabase
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser(token);

      if (authError || !authUser) {
        console.error("Supabase auth error:", authError);

        return res.status(401).json({
          success: false,
          error: "Unauthorized, invalid or expired token",
        });
      }

      // Busca o perfil completo da aplicação
      const user = await profilModel.getProfileById(authUser.id);

      if (!user) {
        return res.status(500).json({
          success: false,
          error: "Failed to load user profile",
        });
      }

      if (!user?.length) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized, user profile not found",
        });
      }

      // Disponibiliza o usuário autenticado para as próximas rotas
      req.user = user[0];

      console.log(user);

      // Também pode ser útil guardar o usuário original do Supabase
      req.authUser = authUser;

      next();
    } catch (error) {
      console.error("Error validating auth:", error);

      return res.status(500).json({
        success: false,
        error: "Internal authentication error",
      });
    }
  },

  checkPermission: async (req, res, next, source, action) => {
    const userType = req.user?.type;
    const permission = await profilModel.getPermissionsByRole(userType);
    if (!permission?.[source]?.[action]) {
      return res.status(403).json({
        success: false,
        error: "Forbidden, missing required permission",
      });
    }
    next();
  },
};

export default middlewareAuthProfil;
