/* Feiertage und Schulferien in Nordrhein-Westfalen (gemeinsam für App und Wandanzeige).
   Feiertage werden berechnet (gelten für alle Jahre). Die Schulferien stehen als Liste unten:
   Quelle: schulferien.eu / kalenderpedia.de, Stand 11/2026 – Liste bei Bedarf für spätere Jahre ergänzen. */
(function () {
  const FERIEN = [ // [von, bis, Name] jeweils einschließlich
    ["2026-03-30", "2026-04-11", "Osterferien"], ["2026-05-26", "2026-05-26", "Pfingstferien"],
    ["2026-07-20", "2026-09-01", "Sommerferien"], ["2026-10-17", "2026-10-31", "Herbstferien"],
    ["2026-12-23", "2027-01-06", "Weihnachtsferien"],
    ["2027-03-22", "2027-04-03", "Osterferien"], ["2027-05-18", "2027-05-18", "Pfingstferien"],
    ["2027-07-19", "2027-08-31", "Sommerferien"], ["2027-10-23", "2027-11-06", "Herbstferien"],
    ["2027-12-24", "2028-01-08", "Weihnachtsferien"],
    ["2028-04-10", "2028-04-22", "Osterferien"], ["2028-07-10", "2028-08-22", "Sommerferien"],
    ["2028-10-23", "2028-11-04", "Herbstferien"], ["2028-12-21", "2029-01-05", "Weihnachtsferien"],
  ];
  const key = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  function easter(y) { // Ostersonntag (Gauß)
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
      g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
      l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
      mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, mo - 1, da);
  }
  const cache = {};
  function holidays(y) {
    if (cache[y]) return cache[y];
    const e = easter(y), at = n => { const x = new Date(e); x.setDate(x.getDate() + n); return key(x); };
    return (cache[y] = {
      [`${y}-01-01`]: "Neujahr", [at(-2)]: "Karfreitag", [at(1)]: "Ostermontag", [`${y}-05-01`]: "Tag der Arbeit",
      [at(39)]: "Christi Himmelfahrt", [at(50)]: "Pfingstmontag", [at(60)]: "Fronleichnam",
      [`${y}-10-03`]: "Tag der Deutschen Einheit", [`${y}-11-01`]: "Allerheiligen",
      [`${y}-12-25`]: "1. Weihnachtstag", [`${y}-12-26`]: "2. Weihnachtstag",
    });
  }
  window.dayInfo = function (d) { // -> { holiday: Name|null, ferien: Name|null }
    const k = key(d); const f = FERIEN.find(x => k >= x[0] && k <= x[1]);
    return { holiday: holidays(d.getFullYear())[k] || null, ferien: f ? f[2] : null };
  };
})();
