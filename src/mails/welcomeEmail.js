const welcomeEmail = (first_name, enterprise, supportEmail) => {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Bem-vindo(a)!</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #fae8ff 100%);
          margin: 0;
          padding: 20px;
          -webkit-font-smoothing: antialiased;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .container {
          max-width: 580px;
          width: 100%;
          background: #ffffff;
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.08), 0 4px 24px rgba(0, 0, 0, 0.04);
        }
        
        .header {
          background: linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%);
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
          background: rgba(255, 255, 255, 0.08);
          border-radius: 50%;
        }
        
        .header::after {
          content: '';
          position: absolute;
          bottom: -40%;
          left: -10%;
          width: 250px;
          height: 250px;
          background: rgba(255, 255, 255, 0.05);
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
          animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        
        .header h1 {
          color: #ffffff;
          margin: 0;
          font-size: 30px;
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
          background: linear-gradient(90deg, #059669, #34d399);
          border-radius: 2px;
          margin: 24px 0;
        }
        
        .message {
          color: #334155;
          font-size: 15px;
          margin-bottom: 16px;
          line-height: 1.8;
        }
        
        .highlight-box {
          background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
          border: 1px solid #bbf7d0;
          border-radius: 16px;
          padding: 20px 24px;
          margin: 24px 0;
        }
        
        .highlight-box h3 {
          color: #065f46;
          font-size: 16px;
          margin: 0 0 8px;
          font-weight: 600;
        }
        
        .highlight-box ul {
          list-style: none;
          padding: 0;
          margin: 8px 0 0;
        }
        
        .highlight-box li {
          padding: 6px 0;
          color: #065f46;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .highlight-box li::before {
          content: "✅";
          font-size: 16px;
        }
        
        .button-container {
          text-align: center;
          margin: 32px 0 28px;
        }
        
        .button {
          background: linear-gradient(135deg, #059669 0%, #10b981 100%);
          color: #ffffff !important;
          text-decoration: none;
          padding: 16px 44px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 16px;
          display: inline-block;
          transition: all 0.3s ease;
          box-shadow: 0 8px 24px rgba(5, 150, 105, 0.35);
          letter-spacing: 0.3px;
        }
        
        .button:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(5, 150, 105, 0.45);
        }
        
        .button:active {
          transform: translateY(0);
        }
        
        .features {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin: 24px 0;
        }
        
        .feature-item {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 16px;
          text-align: center;
          transition: all 0.2s ease;
        }
        
        .feature-item:hover {
          border-color: #059669;
          background: #f0fdf4;
        }
        
        .feature-icon {
          font-size: 28px;
          display: block;
          margin-bottom: 6px;
        }
        
        .feature-item span {
          display: block;
          font-size: 13px;
          color: #334155;
          font-weight: 500;
        }
        
        .feature-item small {
          display: block;
          font-size: 11px;
          color: #94a3b8;
          margin-top: 2px;
        }
        
        .alt-link {
          background: #f8fafc;
          border-radius: 12px;
          padding: 14px 18px;
          margin: 16px 0 8px;
          border: 1px solid #e2e8f0;
          text-align: center;
        }
        
        .alt-link a {
          color: #059669;
          text-decoration: none;
          font-size: 13px;
          font-weight: 500;
        }
        
        .alt-link a:hover {
          text-decoration: underline;
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
          color: #059669;
          font-weight: 600;
        }
        
        .footer a {
          color: #059669;
          text-decoration: none;
        }
        
        .footer a:hover {
          text-decoration: underline;
        }
        
        .social-links {
          display: flex;
          justify-content: center;
          gap: 20px;
          margin: 14px 0 10px;
        }
        
        .social-links a {
          color: #94a3b8;
          text-decoration: none;
          font-size: 13px;
          transition: color 0.2s;
        }
        
        .social-links a:hover {
          color: #059669;
        }
        
        @media only screen and (max-width: 480px) {
          body {
            padding: 12px;
          }
          
          .header {
            padding: 32px 20px 28px;
          }
          
          .header h1 {
            font-size: 24px;
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
          
          .features {
            grid-template-columns: 1fr;
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
          
          .highlight-box {
            padding: 16px 18px;
          }
        }
        
        @media only screen and (max-width: 380px) {
          .header-icon {
            width: 56px;
            height: 56px;
            font-size: 28px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- Header -->
        <div class="header">
          <div class="header-icon">🎉</div>
          <h1>Bem-vindo(a) à bordo!</h1>
          <p>Sua jornada começa aqui 🚀</p>
        </div>
        
        <!-- Content -->
        <div class="content">
          <h2>Olá, ${first_name || "User"}!</h2>
          <p class="greeting">Estamos muito felizes em ter você conosco! ✨</p>
          
          <div class="divider"></div>
          
          <p class="message">
            Sua conta foi criada com sucesso. Agora você faz parte da nossa comunidade 
            e pode começar a explorar todos os recursos que preparamos para você.
          </p>
          
          <!-- Highlight Box -->
          <div class="highlight-box">
            <h3>🎯 O que você pode fazer agora:</h3>
            <ul>
              <li>Acessar sua conta e personalizar seu perfil</li>
              <li>Explorar nossos recursos exclusivos</li>
              <li>Conectar-se com outros membros da comunidade</li>
              <li>Começar a usar todas as funcionalidades</li>
            </ul>
          </div>
          
          <!-- Features -->
          <div class="features">
            <div class="feature-item">
              <span class="feature-icon">📊</span>
              <span>Dashboard</span>
              <small>Gerencie tudo em um só lugar</small>
            </div>
            <div class="feature-item">
              <span class="feature-icon">🔐</span>
              <span>Segurança</span>
              <small>Seus dados protegidos</small>
            </div>
            <div class="feature-item">
              <span class="feature-icon">💡</span>
              <span>Dicas</span>
              <small>Conteúdo exclusivo</small>
            </div>
            <div class="feature-item">
              <span class="feature-icon">🤝</span>
              <span>Suporte</span>
              <small>Equipe sempre disponível</small>
            </div>
          </div>
          
          <!-- Help Section -->
          <p style="text-align:center; font-size:13px; color:#94a3b8; margin-top:20px;">
            💬 Precisa de ajuda? 
            <a href="mailto:${supportEmail}" style="color:#059669; text-decoration:none; font-weight:500;">
              Fale conosco
            </a>
          </p>
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
            &copy; ${new Date().getFullYear()} 
            <span class="brand">${enterprise}</span>. 
            Todos os direitos reservados.
          </p>
          <p style="margin-top:8px; font-size:11px; color:#cbd5e1;">
            Você está recebendo este e-mail porque se cadastrou em nossa plataforma.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

export default welcomeEmail;
