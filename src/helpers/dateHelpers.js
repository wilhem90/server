const formatDateToISOInput = (dateStr) => {
  if (!dateStr) return null;

  const parts = dateStr.split("-");

  if (parts.length !== 3) {
    throw new Error(`Data inválida: ${dateStr}`);
  }

  // YYYY-MM-DD
  if (parts[0].length === 4) {
    const [year, month, day] = parts;

    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // DD-MM-YYYY
  const [day, month, year] = parts;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const convertHaitiToUTC = (dateStr, timeStr) => {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute, second] = timeStr.split(":").map(Number);

  // Primeiro tratamos os valores como se fossem UTC.
  const wallClock = new Date(
    Date.UTC(year, month - 1, day, hour, minute, second),
  );

  // Descobre como essa data aparece no Haiti.
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Port-au-Prince",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(wallClock);

  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  );

  const haitiDate = new Date(
    Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour === "24" ? "00" : values.hour),
      Number(values.minute),
      Number(values.second),
    ),
  );

  // Diferença entre o relógio UTC e o relógio do Haiti.
  const offset = wallClock.getTime() - haitiDate.getTime();

  return new Date(wallClock.getTime() + offset).toISOString();
};

const getHaitiDayBounds = (startStr, endStr = startStr) => {
  const normalizedStart = formatDateToISOInput(startStr);
  const normalizedEnd = formatDateToISOInput(endStr);

  const startDate = convertHaitiToUTC(normalizedStart, "00:00:00");

  const endDate = convertHaitiToUTC(normalizedEnd, "23:59:59");

  return {
    startDate,
    endDate,
  };
};

export { formatDateToISOInput, getHaitiDayBounds };
