const linkValidateEmail = (first_name, enterprise, url) => {
  // Verifica se os parâmetros existem
  const safeFirstName = first_name || "Usuário";
  const safeEnterprise = enterprise || "Nossa Empresa";
  const safeUrl = url || "#";

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Confirme seu E-mail</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          background: linear-gradient(135deg, #eef2ff 0%, #f8fafc 100%);
          margin: 0;
          padding: 20px;
          -webkit-font-smoothing: antialiased;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .container {
          max-width: 560px;
          width: 100%;
          background: #ffffff;
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(79, 70, 229, 0.15), 0 4px 24px rgba(0, 0, 0, 0.04);
        }
        
        .header {
          background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #6366f1 100%);
          padding: 48px 30px 40px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        
        .header::before {
          content: '';
          position: absolute;
          top: -50%;
          right: -20%;
          width: 300px;
          height: 300px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 50%;
        }
        
        .header::after {
          content: '';
          position: absolute;
          bottom: -40%;
          left: -10%;
          width: 250px;
          height: 250px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 50%;
        }
        
        .header-icon {
          width: 80px;
          height: 80px;
          background: rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(10px);
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
          font-size: 40px;
          position: relative;
          z-index: 1;
          border: 3px solid rgba(255, 255, 255, 0.3);
          animation: pulse 2s ease-in-out infinite;
        }
        
        @keyframes pulse {
          0%, 100% { 
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.3);
          }
          50% { 
            transform: scale(1.05);
            box-shadow: 0 0 20px 10px rgba(255, 255, 255, 0.1);
          }
        }
        
        .header h1 {
          color: #ffffff;
          margin: 0;
          font-size: 28px;
          font-weight: 700;
          letter-spacing: -0.5px;
          position: relative;
          z-index: 1;
        }
        
        .header p {
          color: rgba(255, 255, 255, 0.9);
          margin: 8px 0 0;
          font-size: 16px;
          position: relative;
          z-index: 1;
        }
        
        .content {
          padding: 40px 35px 30px;
          color: #1e293b;
          line-height: 1.7;
        }
        
        .content h2 {
          font-size: 24px;
          color: #0f172a;
          margin: 0 0 4px;
          font-weight: 700;
        }
        
        .greeting {
          color: #64748b;
          font-size: 16px;
          margin-bottom: 20px;
        }
        
        .divider {
          width: 60px;
          height: 4px;
          background: linear-gradient(90deg, #4f46e5, #7c3aed);
          border-radius: 2px;
          margin: 24px 0;
        }
        
        .message {
          color: #334155;
          font-size: 15px;
          margin-bottom: 16px;
          line-height: 1.8;
        }
        
        .message strong {
          color: #0f172a;
        }
        
        .button-container {
          text-align: center;
          margin: 32px 0 28px;
        }
        
        .button {
          background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
          color: #ffffff !important;
          text-decoration: none;
          padding: 16px 44px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 16px;
          display: inline-block;
          transition: all 0.3s ease;
          box-shadow: 0 8px 24px rgba(79, 70, 229, 0.35);
          letter-spacing: 0.3px;
          position: relative;
          overflow: hidden;
          border: none;
          cursor: pointer;
        }
        
        .button::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.15), transparent);
          transition: left 0.5s ease;
        }
        
        .button:hover::before {
          left: 100%;
        }
        
        .button:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(79, 70, 229, 0.45);
        }
        
        .button:active {
          transform: translateY(0);
        }
        
        .button-icon {
          margin-right: 8px;
        }
        
        .alt-link {
          background: #f8fafc;
          border-radius: 12px;
          padding: 16px 20px;
          margin: 20px 0 8px;
          border: 1px solid #e2e8f0;
        }
        
        .alt-link-label {
          font-size: 13px;
          color: #94a3b8;
          display: block;
          margin-bottom: 6px;
          font-weight: 500;
        }
        
        .alt-link a {
          color: #4f46e5;
          text-decoration: none;
          font-size: 13px;
          word-break: break-all;
          font-weight: 500;
        }
        
        .alt-link a:hover {
          text-decoration: underline;
          color: #4338ca;
        }
        
        .info-box {
          display: flex;
          gap: 12px;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 12px;
          padding: 14px 18px;
          margin-top: 24px;
        }
        
        .info-box span {
          font-size: 20px;
          flex-shrink: 0;
        }
        
        .info-box p {
          font-size: 13px;
          color: #166534;
          margin: 0;
          line-height: 1.6;
        }
        
        .info-box strong {
          color: #065f46;
        }
        
        .footer {
          background: #fafbfc;
          padding: 24px 35px;
          text-align: center;
          border-top: 1px solid #f1f5f9;
        }
        
        .footer p {
          font-size: 12px;
          color: #94a3b8;
          margin: 4px 0;
          line-height: 1.6;
        }
        
        .footer .brand {
          color: #4f46e5;
          font-weight: 600;
        }
        
        .social-links {
          display: flex;
          justify-content: center;
          gap: 20px;
          margin: 12px 0 8px;
        }
        
        .social-links a {
          color: #94a3b8;
          text-decoration: none;
          font-size: 13px;
          transition: color 0.2s;
        }
        
        .social-links a:hover {
          color: #4f46e5;
        }
        
        /* Responsividade */
        @media only screen and (max-width: 480px) {
          body {
            padding: 12px;
          }
          
          .header {
            padding: 32px 20px 28px;
          }
          
          .header h1 {
            font-size: 22px;
          }
          
          .header-icon {
            width: 64px;
            height: 64px;
            font-size: 32px;
          }
          
          .content {
            padding: 28px 20px 20px;
          }
          
          .content h2 {
            font-size: 20px;
          }
          
          .greeting {
            font-size: 14px;
          }
          
          .message {
            font-size: 14px;
          }
          
          .button {
            display: block;
            width: 100%;
            padding: 16px 20px;
            text-align: center;
            box-sizing: border-box;
          }
          
          .footer {
            padding: 20px 20px;
          }
          
          .info-box {
            flex-direction: column;
            align-items: center;
            text-align: center;
          }
          
          .alt-link {
            padding: 12px 16px;
          }
          
          .social-links {
            gap: 12px;
            flex-wrap: wrap;
          }
        }
        
        @media only screen and (max-width: 380px) {
          .header h1 {
            font-size: 20px;
          }
        }
        
        /* Suporte para clientes de email */
        @media (prefers-color-scheme: dark) {
          .container {
            background: #1e293b;
          }
          
          .content {
            color: #e2e8f0;
          }
          
          .content h2 {
            color: #f8fafc;
          }
          
          .greeting {
            color: #94a3b8;
          }
          
          .message {
            color: #cbd5e1;
          }
          
          .message strong {
            color: #f8fafc;
          }
          
          .alt-link {
            background: #0f172a;
            border-color: #334155;
          }
          
          .alt-link a {
            color: #818cf8;
          }
          
          .footer {
            background: #0f172a;
            border-color: #1e293b;
          }
          
          .footer p {
            color: #64748b;
          }
          
          .footer .brand {
            color: #818cf8;
          }
          
          .info-box {
            background: #064e3b;
            border-color: #065f46;
          }
          
          .info-box p {
            color: #a7f3d0;
          }
          
          .info-box strong {
            color: #d1fae5;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- Header -->
        <div class="header">
          <h1>Verifique seu e-mail</h1>
          <p>Estamos quase lá! 🚀</p>
        </div>
        
        <!-- Content -->
        <div class="content">
          <h2>Olá, ${safeFirstName}!</h2>
          <p class="greeting">Bem-vindo(a) à nossa plataforma! ✨</p>
          
          <div class="divider"></div>
          
          <p class="message">
            <strong>Um último passo:</strong> Confirme seu endereço de e-mail para ativar sua conta 
            e garantir a segurança dos seus dados.
          </p>
          
          <p class="message">
            Clique no botão abaixo para validar seu cadastro. O link é <strong>válido por 24 horas</strong>.
          </p>
          
          <!-- Botão Principal -->
          <div class="button-container">
            <a href="${safeUrl}" class="button" target="_blank">
              <span class="button-icon">✅</span> Confirmar meu e-mail
            </a>
          </div>
          
          <!-- Link Alternativo -->
          <div class="alt-link">
            <span class="alt-link-label">🔗 Link alternativo:</span>
            <a href="${safeUrl}">${safeUrl}</a>
          </div>
          
          <!-- Caixa de Segurança -->
          <div class="info-box">
            <span>🔒</span>
            <p>
              <strong>Segurança em primeiro lugar:</strong> Nunca compartilhe este link com ninguém. 
              Nossa equipe nunca solicitará suas credenciais por e-mail.
            </p>
          </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
          <div class="social-links">
            <a href="#">Instagram</a>
            <a href="#">Twitter</a>
            <a href="#">LinkedIn</a>
            <a href="#">YouTube</a>
          </div>
          
          <p>
            Este é um e-mail automático, por favor não responda.
          </p>
          <p>
            &copy; ${new Date().getFullYear()} <span class="brand">${safeEnterprise}</span>. 
            Todos os direitos reservados.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

export { linkValidateEmail };