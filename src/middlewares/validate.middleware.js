const validateBody = (schema) => {
  return (req, res, next) => {
    const validation = schema.safeParse(req.body);
    // Se houver erro, barra a requisição aqui mesmo
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Dados de requisição inválidos.",
        errors: validation.error.flatten().fieldErrors, // Retorna os erros de forma limpa e legível
      });
    }

    req.body = validation.data;
    next();
  };
};

export { validateBody };
