import { z } from "zod";

const registerUserSchema = z.object({
  email: z.string().email("E-mail inválido."),
  phone: z.string().min(8, "Telefone deve ter no mínimo 8 dígitos."),
  first_name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres."),
  last_name: z.string().min(2, "Sobrenome deve ter pelo menos 2 caracteres."),
  document_id: z.string().min(1, "Documento de identidade é obrigatório."),
  user_name: z
    .string()
    .min(5, "UserName deve ter pelo menos 5 caracteres.")
    .max(30, "UserName deve ter no máximo 30 caracteres."),

  birthday: z.string().optional(),
  password: z.string().min(8, "A senha deve ter no mínimo 8 caracteres."),
  address: z.object({
    country: z.string().min(1, "País é obrigatório."),
    state: z.string().min(1, "Estado é obrigatório."),
    city: z.string().min(1, "Cidade é obrigatória."),
    neighborhood: z.string().min(1, "Bairro é obrigatório."),
    street: z.string().min(1, "Rua é obrigatória."),
    number: z.union([z.string(), z.number()]),
  }),
});

const loginUserSchema = z.object({
  identifier: z.string().min(1, "Informe seu e-mail, username ou documento."),
  password: z.string().min(8, "A senha deve ter no mínimo 8 caracteres."),
});

const emailSchema = z.object({
  email: z.email("E-mail inválido."),
});

export { registerUserSchema, loginUserSchema, emailSchema };
