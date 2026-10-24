import "dotenv/config";

const BASE_URL = "https://api.dingconnect.com/api/V1/";

async function requestDing(endpoint, method = "GET", payload = null) {
  const apiKey = process.env.API_KEY_DING;

  if (!apiKey) {
    return {
      success: false,
      definitiveFailure: false,
      error: "API_KEY_DING not configured.",
    };
  }

  try {
    const options = {
      method,
      signal: AbortSignal.timeout(30000),
      headers: {
        API_KEY: apiKey,
        Accept: "application/json",
      },
    };

    if (payload !== null && method !== "GET") {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(payload);
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const rawText = await response.text();

    let body = null;

    try {
      body = rawText ? JSON.parse(rawText) : null;
    } catch {
      body = { message: rawText };
    }

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        data: body,
        raw: body,
        error: `DingConnect HTTP ${response.status}`,
        definitiveFailure: false,
      };
    }

    return {
      success: true,
      status: response.status,
      data: body,
      raw: body,
      error: null,
      definitiveFailure: false,
    };
  } catch (error) {
    return {
      success: false,
      status: null,
      data: null,
      raw: null,
      error: error.message || "Communication failure with DingConnect.",
      definitiveFailure: false,
    };
  }
}

export default requestDing;
