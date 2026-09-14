import "dotenv/config";

async function requestDing(url, method = "GET", data = null) {
  const baseURL = "https://api.dingconnect.com/api/V1/";

  try {
    const options = {
      method,
      headers: {
        API_KEY: process.env.API_KEY_DING,
        Accept: "application/json",
      },
    };

    if (method === "POST") {
      options.headers["Content-Type"] = "application/json";

      if (data) {
        options.body = JSON.stringify(data);
      }
    }

    const response = await fetch(baseURL + url, options);

    const responseText = await response.text();

    let responseData = null;

    try {
      responseData = responseText
        ? JSON.parse(responseText)
        : null;
    } catch {
      responseData = null;
    }

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        errors: responseData || responseText,
      };
    }

    return {
      success: true,
      ...(responseData || {}),
    };
  } catch (error) {
    console.error("Erro em requestDing:", error);

    return {
      success: false,
      message: error.message || "Erro de conexão com Ding.",
    };
  }
}

export default requestDing;