const tokenExpiredEmail = (supportEmail) => {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Link Expirado</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 50%, #fce7f3 100%);
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
          box-shadow: 0 20px 60px rgba(220, 38, 38, 0.08), 0 4px 24px rgba(0, 0, 0, 0.04);
        }
        
        .header {
          background: linear-gradient(135deg, #dc2626 0%, #ef4444 50%, #f87171 100%);
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
          animation: shake 0.5s ease-in-out;
        }
        
        @keyframes shake {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-10deg); }
          75% { transform: rotate(10deg); }
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
          background: linear-gradient(90deg, #dc2626, #f87171);
          border-radius: 2px;
          margin: 24px 0;
        }
        
        .message {
          color: #334155;
          font-size: 15px;
          margin-bottom: 16px;
          line-height: 1.8;
        }
        
        .warning-box {
          background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
          border: 1px solid #fecaca;
          border-radius: 16px;
          padding: 20px 24px;
          margin: 24px 0;
        }
        
        .warning-box h3 {
          color: #991b1b;
          font-size: 16px;
          margin: 0 0 8px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .warning-box p {
          color: #7f1d1d;
          font-size: 14px;
          margin: 0;
          line-height: 1.6;
        }
        
        .warning-box ul {
          list-style: none;
          padding: 0;
          margin: 12px 0 0;
        }
        
        .warning-box li {
          padding: 6px 0;
          color: #7f1d1d;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .warning-box li::before {
          content: "⏰";
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
          box-shadow: 0 8px 24px rgba(5, 150, 105, 0.3);
          letter-spacing: 0.3px;
        }
        
        .button:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(5, 150, 105, 0.45);
        }
        
        .button:active {
          transform: translateY(0);
        }
        
        .button-secondary {
          background: transparent;
          color: #4b5563 !important;
          border: 2px solid #d1d5db;
          padding: 14px 40px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 16px;
          display: inline-block;
          transition: all 0.3s ease;
          text-decoration: none;
          margin-left: 12px;
        }
        
        .button-secondary:hover {
          border-color: #9ca3af;
          background: #f9fafb;
        }
        
        .button-group {
          display: flex;
          justify-content: center;
          gap: 12px;
          flex-wrap: wrap;
          margin: 32px 0 28px;
        }
        
        .info-box {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 16px 20px;
          margin: 20px 0;
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        
        .info-box span {
          font-size: 20px;
          flex-shrink: 0;
        }
        
        .info-box p {
          font-size: 13px;
          color: #475569;
          margin: 0;
          line-height: 1.6;
        }
        
        .info-box strong {
          color: #0f172a;
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
          
          .button {
            display: block;
            width: 100%;
            padding: 16px 20px;
            text-align: center;
            box-sizing: border-box;
          }
          
          .button-secondary {
            display: block;
            width: 100%;
            padding: 14px 20px;
            text-align: center;
            box-sizing: border-box;
            margin-left: 0;
          }
          
          .button-group {
            flex-direction: column;
          }
          
          .footer {
            padding: 20px 20px;
          }
          
          .warning-box {
            padding: 16px 18px;
          }
          
          .info-box {
            flex-direction: column;
            align-items: center;
            text-align: center;
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
          <div class="header-icon">⏰</div>
          <h1>Link Expirado</h1>
          <p>O tempo acabou! ⏱️</p>
        </div>
        
        <!-- Content -->
        <div class="content">
          <h2>Olá!</h2>
          <p class="greeting">Seu link de verificação expirou 🔒</p>
          
          <div class="divider"></div>
          
          <p class="message">
            O link que você tentou acessar <strong>expirou</strong> por motivos de segurança. 
            Isso acontece para proteger sua conta e garantir que apenas você possa ativá-la.
          </p>
          
          <!-- Warning Box -->
          <div class="warning-box">
            <h3>⚠️ Por que isso aconteceu?</h3>
            <ul>
              <li>O link expirou após o prazo de validade</li>
              <li>Por segurança, links têm tempo limitado</li>
              <li>Você pode solicitar um novo link</li>
            </ul>
          </div>
          
          <!-- Information Box -->
          <div class="info-box">
            <span>💡</span>
            <p>
              <strong>Não se preocupe!</strong> Você pode solicitar um novo link de verificação.
              O novo link será válido por mais <strong>24 horas</strong>.
            </p>
          </div>
          
          <!-- Help Section -->
          <p style="text-align:center; font-size:13px; color:#94a3b8; margin-top:20px;">
            ❓ Ainda com problemas? 
            <a href="mailto:${supportEmail}" style="color:#059669; text-decoration:none; font-weight:500;">
              Entre em contato com o suporte
            </a>
          </p>
        </div>
        
      </div>
    </body>
    </html>
  `;
};

export default tokenExpiredEmail;
