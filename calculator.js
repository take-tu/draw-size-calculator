const DIVISIONS = [{
  code: "Open",
  label: "Open"
}, {
  code: "A",
  label: "A"
}, {
  code: "B",
  label: "B"
}, {
  code: "C",
  label: "C"
}, {
  code: "D",
  label: "D"
}];
function calcSinglesMatches(n, cons) {
  if (!n || n < 2) return 0;
  return n - 1 + (cons && n >= 4 ? Math.floor(n / 2) - 1 : 0);
}
function calcDoublesMatches(n, cons) {
  if (!n || n < 2) return 0;
  return n - 1 + (cons && n >= 4 ? Math.floor(n / 2) - 1 : 0);
}

// Build per-round match list for any draw size using bracket progression
function buildRounds(n) {
  var rounds = [];
  var r = n;
  while (r > 1) {
    rounds.push(Math.floor(r / 2));
    r = Math.ceil(r / 2);
  }
  return rounds;
}

// Day-by-day schedule:
//   Last day  → SF + F (final 2 rounds)
//   Early rounds distributed evenly across days 0..days-2
//   Consolation starts day 1, spread over days 1..last-1
function scheduleByDay(n, days, cons) {
  var result = new Array(days).fill(0);
  if (!n || n < 2 || days < 1) return result;
  var mainRounds = buildRounds(n);
  var totalRounds = mainRounds.length;
  if (days === 1) {
    result[0] = mainRounds.reduce(function (a, b) {
      return a + b;
    }, 0);
  } else {
    // Last day: SF + F (last 2 rounds)
    var lastStart = Math.max(0, totalRounds - 2);
    for (var i = lastStart; i < totalRounds; i++) result[days - 1] += mainRounds[i];

    // Early rounds distributed evenly across days 0..days-2
    // so QF-era rounds always land on day 2 regardless of draw size
    var earlyRounds = mainRounds.slice(0, lastStart);
    var earlyDays = days - 1;
    earlyRounds.forEach(function (m, idx) {
      var di = Math.min(earlyDays - 1, Math.floor(idx * earlyDays / (earlyRounds.length || 1)));
      result[di] += m;
    });
  }

  // Consolation: starts day 1, spread across days 1..days-1
  if (cons && n >= 4) {
    var consRounds = buildRounds(Math.floor(n / 2));
    var consDays = Math.max(1, days - 1);
    consRounds.forEach(function (m, idx) {
      var di = 1 + Math.min(consDays - 1, Math.floor(idx * consDays / (consRounds.length || 1)));
      result[di] += m;
    });
  }
  return result;
}

// Seeds per PTW rules table
function calcSeedsFor(n) {
  if (!n || n < 1) return 0;
  if (n <= 5) return 1;
  if (n <= 11) return 2;
  if (n <= 23) return 4;
  if (n <= 47) return 8;
  return 16; // 48–64
}
var PRESET_DEFAULT = {
  Open: {
    s: 16,
    d: 8
  },
  A: {
    s: 32,
    d: 16
  },
  B: {
    s: 32,
    d: 16
  },
  C: {
    s: 16,
    d: 8
  },
  D: {
    s: 16,
    d: 8
  }
};
var PRESET_SAFE = {
  Open: {
    s: 16,
    d: 8
  },
  A: {
    s: 16,
    d: 8
  },
  B: {
    s: 16,
    d: 8
  },
  C: {
    s: 16,
    d: 8
  },
  D: {
    s: 16,
    d: 8
  }
};

// Default draw sizes for any custom division added by the TD
var CUSTOM_DIV_DEFAULT = {
  s: 16,
  d: 8
};
function makeInitDivs(divList) {
  var list = divList || DIVISIONS;
  var out = {};
  list.forEach(function (d) {
    var p = PRESET_DEFAULT[d.code] || CUSTOM_DIV_DEFAULT;
    out[d.code] = {
      s: p.s,
      d: p.d,
      scons: true,
      dcons: false
    };
  });
  return out;
}
const DrawSizeCalc = () => {
  const [days, setDays] = React.useState(3);
  const [hrsDays, setHrsDays] = React.useState([14, 14, 14]);
  const [courtsPerDay, setCourtsPerDay] = React.useState([10, 10, 10]);
  const [slotDur, setSlotDur] = React.useState(90);

  // Extra divisions added by the TD (beyond the base 5)
  const [extraDivs, setExtraDivs] = React.useState([]); // [{ code, label }]
  const [newDivName, setNewDivName] = React.useState("");
  const allDivisions = React.useMemo(() => [...DIVISIONS, ...extraDivs], [extraDivs]);
  const [divs, setDivs] = React.useState(() => makeInitDivs(DIVISIONS));
  // Raw string values for draw inputs — keeps display in sync while typing
  // without committing intermediate values that would hide consolation checkboxes
  const [rawDivs, setRawDivs] = React.useState({});
  function getRaw(code, field) {
    return rawDivs[code] && rawDivs[code][field] != null ? rawDivs[code][field] : "";
  }
  function setRaw(code, field, val) {
    setRawDivs(function (prev) {
      var n = Object.assign({}, prev);
      n[code] = Object.assign({}, n[code], {});
      n[code][field] = val;
      return n;
    });
  }
  function clearRaw(code, field) {
    setRawDivs(function (prev) {
      var n = Object.assign({}, prev);
      if (n[code]) {
        n[code] = Object.assign({}, n[code]);
        delete n[code][field];
      }
      return n;
    });
  }

  // Sync hrsDays and courtsPerDay lengths when days changes
  React.useEffect(() => {
    setHrsDays(prev => {
      if (prev.length === days) return prev;
      return Array.from({
        length: days
      }, function (_, i) {
        return prev[i] != null ? prev[i] : 14;
      });
    });
    setCourtsPerDay(prev => {
      if (prev.length === days) return prev;
      var last = prev[prev.length - 1] || 10;
      return Array.from({
        length: days
      }, function (_, i) {
        return prev[i] != null ? prev[i] : last;
      });
    });
  }, [days]);
  const blocksPerDayArr = hrsDays.map(function (h, i) {
    return Math.floor(h * 60 / slotDur);
  });
  const slotsPerDayArr = blocksPerDayArr.map(function (b, i) {
    return courtsPerDay[i] * b;
  });
  const maxSlots = slotsPerDayArr.reduce(function (a, b) {
    return a + b;
  }, 0);
  const safeSlots = Math.floor(maxSlots * 0.91);
  function updateDiv(code, patch) {
    setDivs(prev => Object.assign({}, prev, {
      [code]: Object.assign({}, prev[code], patch)
    }));
  }
  function applyPreset(preset) {
    setDivs(prev => {
      var next = {};
      allDivisions.forEach(function (d) {
        var p = preset[d.code] || CUSTOM_DIV_DEFAULT;
        next[d.code] = Object.assign({}, prev[d.code], {
          s: p.s,
          d: p.d,
          scons: preset === PRESET_DEFAULT ? true : prev[d.code] && prev[d.code].s >= 4 ? prev[d.code].scons : false
        });
      });
      return next;
    });
  }
  function addDivision() {
    var name = newDivName.trim();
    if (!name) return;
    // Generate a unique code from the name
    var code = "custom_" + name.replace(/\s+/g, "_").toLowerCase() + "_" + Date.now();
    var newDiv = {
      code: code,
      label: name,
      isCustom: true
    };
    setExtraDivs(prev => [...prev, newDiv]);
    setDivs(prev => Object.assign({}, prev, {
      [code]: {
        s: CUSTOM_DIV_DEFAULT.s,
        d: CUSTOM_DIV_DEFAULT.d,
        scons: true,
        dcons: false
      }
    }));
    setNewDivName("");
  }
  function removeDivision(code) {
    setExtraDivs(prev => prev.filter(d => d.code !== code));
    setDivs(prev => {
      var n = Object.assign({}, prev);
      delete n[code];
      return n;
    });
  }
  var totalMatches = 0,
    totalPlayers = 0,
    totalTeams = 0;
  allDivisions.forEach(function (d) {
    if (!divs[d.code]) return;
    totalMatches += calcSinglesMatches(divs[d.code].s, divs[d.code].scons) + calcDoublesMatches(divs[d.code].d, divs[d.code].dcons);
    totalPlayers += divs[d.code].s;
    totalTeams += divs[d.code].d;
  });
  var dayTotals = [];
  var di;
  for (di = 0; di < days; di++) dayTotals.push(0);
  allDivisions.forEach(function (div) {
    if (!divs[div.code]) return;
    var ss = scheduleByDay(divs[div.code].s, days, divs[div.code].scons);
    var ds = scheduleByDay(divs[div.code].d, days, divs[div.code].dcons);
    for (di = 0; di < days; di++) dayTotals[di] += (ss[di] || 0) + (ds[di] || 0);
  });
  var statusColor = totalMatches <= safeSlots ? "#2d7a2d" : totalMatches <= maxSlots ? "#8a6000" : "#b52222";
  var statusBg = totalMatches <= safeSlots ? "#e6f4e6" : totalMatches <= maxSlots ? "#fff3cd" : "#fde8e8";
  var statusBorder = totalMatches <= safeSlots ? "#a3d9a3" : totalMatches <= maxSlots ? "#ffe08a" : "#f5b0b0";
  var statusLabel = totalMatches <= safeSlots ? "✓ Within capacity" : totalMatches <= maxSlots ? "⚠ Tight — monitor closely" : "✗ Overbooked";
  var pct = maxSlots > 0 ? Math.min(100, Math.round(totalMatches / maxSlots * 100)) : 0;
  var numInputStyle = {
    width: 64,
    padding: "5px 8px",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 700,
    border: "1px solid var(--line-strong)",
    background: "var(--cream)",
    color: "var(--ink)",
    textAlign: "center"
  };
  var thStyle = {
    padding: "6px 8px 8px 8px",
    textAlign: "center",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.07em",
    color: "var(--muted)",
    textTransform: "uppercase",
    whiteSpace: "nowrap"
  };

  // ─── tiny helpers ────────────────────────────────────────────────────────
  var cellInput = Object.assign({}, numInputStyle, {
    width: "100%",
    boxSizing: "border-box"
  });
  var labelRow = {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.07em",
    textTransform: "uppercase",
    color: "var(--muted)",
    marginBottom: 5
  };
  return /*#__PURE__*/React.createElement("div", {
    id: "directors-planning-draw-size-calculator",
    style: {
      marginTop: 12,
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "label"
  }, "DRAW SIZE CALCULATOR")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn",
    style: {
      fontSize: 11
    },
    onClick: () => applyPreset(PRESET_DEFAULT)
  }, "Default"), /*#__PURE__*/React.createElement("button", {
    className: "btn",
    style: {
      fontSize: 11
    },
    onClick: () => applyPreset(PRESET_SAFE)
  }, "Max safety"))), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      padding: 0,
      marginBottom: 12,
      clipPath: "inset(0 round var(--radius))"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "10px 16px",
      borderBottom: "1px solid var(--line)",
      background: "var(--cream-deep)",
      display: "flex",
      gap: 0,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: Object.assign({}, labelRow, {
      alignSelf: "center",
      marginBottom: 0,
      marginRight: 20,
      flex: "0 0 auto"
    })
  }, "Venue"), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "4px 16px 4px 0",
      borderRight: "1px solid var(--line)",
      marginRight: 16,
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      color: "var(--ink-muted)"
    }
  }, "Days"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: days,
    min: 1,
    max: 5,
    onChange: e => {
      var v = Number(e.target.value);
      if (!isNaN(v)) setDays(Math.max(1, Math.min(5, v)));
    },
    onBlur: e => setDays(Math.max(1, Math.min(5, Number(e.target.value) || 1))),
    onKeyDown: e => {
      if (e.key === "Enter") e.target.blur();
    },
    className: "calc-input",
    style: Object.assign({}, numInputStyle, {
      width: 52
    })
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "4px 0",
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      color: "var(--ink-muted)"
    }
  }, "Slot"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: slotDur,
    min: 30,
    max: 240,
    onChange: e => {
      var v = Number(e.target.value);
      if (!isNaN(v) && v >= 1) setSlotDur(v);
    },
    onBlur: e => setSlotDur(Math.max(30, Math.min(240, Number(e.target.value) || 90))),
    onKeyDown: e => {
      if (e.key === "Enter") e.target.blur();
    },
    className: "calc-input",
    style: Object.assign({}, numInputStyle, {
      width: 52
    })
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: "var(--muted)"
    }
  }, "min"))), /*#__PURE__*/React.createElement("div", {
    className: "box-scroll"
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: "100%",
      borderCollapse: "collapse"
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      background: "var(--cream-deep)"
    }
  }, /*#__PURE__*/React.createElement("th", {
    style: {
      padding: "8px 16px 6px",
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.07em",
      textTransform: "uppercase",
      color: "var(--muted)",
      textAlign: "left",
      borderBottom: "1px solid var(--line)",
      whiteSpace: "nowrap",
      width: 80
    }
  }), Array.from({
    length: days
  }, (_, i) => /*#__PURE__*/React.createElement("th", {
    key: i,
    style: {
      padding: "8px 12px 6px",
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.07em",
      textTransform: "uppercase",
      color: "var(--muted)",
      textAlign: "center",
      borderBottom: "1px solid var(--line)",
      minWidth: 72
    }
  }, "Day ", i + 1)), /*#__PURE__*/React.createElement("th", {
    style: {
      padding: "8px 16px 6px",
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.07em",
      textTransform: "uppercase",
      color: "var(--muted)",
      textAlign: "right",
      borderBottom: "1px solid var(--line)",
      whiteSpace: "nowrap"
    }
  }, "Total"))), /*#__PURE__*/React.createElement("tbody", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      borderBottom: "1px solid var(--line)"
    }
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "8px 16px",
      fontSize: 11,
      fontWeight: 600,
      color: "var(--ink-muted)",
      whiteSpace: "nowrap"
    }
  }, "Courts"), courtsPerDay.map((c, i) => /*#__PURE__*/React.createElement("td", {
    key: i,
    style: {
      padding: "6px 8px",
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: c,
    onChange: e => {
      var v = Number(e.target.value);
      if (!isNaN(v) && v >= 1) setCourtsPerDay(prev => {
        var n = prev.slice();
        n[i] = v;
        return n;
      });
    },
    onBlur: e => {
      var v = Math.max(1, Math.min(40, Number(e.target.value) || 10));
      setCourtsPerDay(prev => {
        var n = prev.slice();
        n[i] = v;
        return n;
      });
    },
    onKeyDown: e => {
      if (e.key === "Enter") e.target.blur();
    },
    className: "calc-input",
    style: Object.assign({}, numInputStyle, {
      width: "100%",
      maxWidth: 64
    })
  }))), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "8px 16px",
      textAlign: "right",
      fontSize: 12,
      color: "var(--muted)",
      fontStyle: "italic"
    }
  }, "varies")), /*#__PURE__*/React.createElement("tr", {
    style: {
      borderBottom: "2px solid var(--line-strong)"
    }
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "8px 16px",
      fontSize: 11,
      fontWeight: 600,
      color: "var(--ink-muted)",
      whiteSpace: "nowrap"
    }
  }, "Hours"), hrsDays.map((h, i) => /*#__PURE__*/React.createElement("td", {
    key: i,
    style: {
      padding: "6px 8px",
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: h,
    onChange: e => {
      var v = Number(e.target.value);
      if (!isNaN(v) && v >= 1) setHrsDays(prev => {
        var n = prev.slice();
        n[i] = v;
        return n;
      });
    },
    onBlur: e => {
      var v = Math.max(4, Math.min(18, Number(e.target.value) || 14));
      setHrsDays(prev => {
        var n = prev.slice();
        n[i] = v;
        return n;
      });
    },
    onKeyDown: e => {
      if (e.key === "Enter") e.target.blur();
    },
    className: "calc-input",
    style: Object.assign({}, numInputStyle, {
      width: "100%",
      maxWidth: 64
    })
  }))), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "8px 16px",
      textAlign: "right",
      fontSize: 12,
      color: "var(--muted)",
      fontStyle: "italic"
    }
  }, "varies")), /*#__PURE__*/React.createElement("tr", {
    style: {
      background: "rgba(0,0,0,0.03)"
    }
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "10px 16px",
      fontSize: 11,
      fontWeight: 700,
      color: "var(--ink)",
      whiteSpace: "nowrap"
    }
  }, "Slots"), slotsPerDayArr.map((s, i) => /*#__PURE__*/React.createElement("td", {
    key: i,
    style: {
      padding: "10px 8px",
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: "var(--ink)"
    }
  }, s))), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "10px 16px",
      textAlign: "right"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: "var(--ink)"
    }
  }, maxSlots))))))), /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: 8,
      marginBottom: 16,
      padding: "12px 16px",
      background: statusBg,
      border: "1px solid " + statusBorder,
      display: "grid",
      gridTemplateColumns: "auto 1fr auto",
      gap: 16,
      alignItems: "stretch"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: Object.assign({}, labelRow, {
      color: statusColor,
      marginBottom: 5
    })
  }, "Matches"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "serif",
    style: {
      fontSize: 36,
      lineHeight: 1,
      color: statusColor
    }
  }, totalMatches), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: statusColor,
      opacity: 0.6
    }
  }, "/ ", maxSlots))), /*#__PURE__*/React.createElement("div", {
    style: {
      alignSelf: "stretch",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 7,
      background: "rgba(0,0,0,0.1)",
      borderRadius: 4,
      overflow: "hidden",
      marginTop: 5,
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: "100%",
      width: pct + "%",
      background: statusColor,
      borderRadius: 4,
      transition: "width 0.2s"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: statusColor
    }
  }, statusLabel)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: statusColor,
      opacity: 0.7
    }
  }, pct, "% \xB7 ", maxSlots - totalMatches >= 0 ? maxSlots - totalMatches + " slots left" : Math.abs(maxSlots - totalMatches) + " over")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 16,
      alignItems: "flex-start"
    }
  }, [["Players", totalPlayers], ["Teams", totalTeams]].map(([lbl, val]) => /*#__PURE__*/React.createElement("div", {
    key: lbl,
    style: {
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: Object.assign({}, labelRow, {
      color: statusColor,
      opacity: 0.7,
      marginBottom: 2
    })
  }, lbl), /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 18,
      fontWeight: 700,
      color: statusColor
    }
  }, val))))), /*#__PURE__*/React.createElement("div", {
    className: "row gap-24 wrap-row",
    style: {
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: "3 1 300px",
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: Object.assign({}, labelRow, {
      marginBottom: 10
    })
  }, "Divisions"), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      padding: 0,
      clipPath: "inset(0 round var(--radius))"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "box-scroll"
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: "100%",
      borderCollapse: "collapse",
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      background: "var(--cream-deep)",
      borderBottom: "2px solid var(--line-strong)"
    }
  }, /*#__PURE__*/React.createElement("th", {
    style: {
      padding: "8px 12px 8px 14px",
      textAlign: "left",
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.07em",
      color: "var(--muted)",
      textTransform: "uppercase",
      whiteSpace: "nowrap"
    }
  }, "Division"), ["Singles", "Cons", "Seeds", "Doubles", "Cons", "Seeds", "Matches", ""].map((h, i) => /*#__PURE__*/React.createElement("th", {
    key: i,
    style: thStyle
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, allDivisions.map((div, i) => {
    if (!divs[div.code]) return null;
    var s = divs[div.code].s,
      d = divs[div.code].d;
    var scons = divs[div.code].scons,
      dcons = divs[div.code].dcons;
    var sm = calcSinglesMatches(s, scons),
      dm = calcDoublesMatches(d, dcons);
    return /*#__PURE__*/React.createElement("tr", {
      key: div.code,
      style: {
        borderBottom: "1px solid var(--line)",
        background: i % 2 === 0 ? "transparent" : "var(--cream-deep)"
      }
    }, /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "8px 8px 8px 14px",
        fontWeight: 700,
        fontSize: 13,
        whiteSpace: "nowrap"
      }
    }, div.label, div.isCustom && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        fontWeight: 400,
        color: "var(--muted)",
        marginLeft: 4
      }
    }, "custom")), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "5px 6px",
        textAlign: "center"
      }
    }, /*#__PURE__*/React.createElement("input", {
      type: "number",
      value: getRaw(div.code, "s") !== "" ? getRaw(div.code, "s") : s === 0 ? "" : s,
      placeholder: "0",
      onChange: e => setRaw(div.code, "s", e.target.value),
      onBlur: e => {
        clearRaw(div.code, "s");
        var v = e.target.value === "" ? 0 : Math.max(0, Math.min(64, Number(e.target.value) || 0));
        updateDiv(div.code, {
          s: v,
          scons: v < 4 ? false : scons
        });
      },
      onKeyDown: e => {
        if (e.key === "Enter") e.target.blur();
      },
      className: "calc-input",
      style: Object.assign({}, numInputStyle, {
        width: 50
      })
    })), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "5px 6px",
        textAlign: "center"
      }
    }, s >= 4 ? /*#__PURE__*/React.createElement("input", {
      type: "checkbox",
      checked: scons,
      onChange: e => updateDiv(div.code, {
        scons: e.target.checked
      }),
      style: {
        width: 15,
        height: 15,
        accentColor: "var(--chart-deep)",
        cursor: "pointer"
      }
    }) : /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--muted)"
      }
    }, "\u2014")), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "5px 6px",
        textAlign: "center"
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "mono",
      style: {
        fontSize: 12,
        color: s === 0 ? "var(--muted)" : "var(--ink)"
      }
    }, s === 0 ? "—" : calcSeedsFor(s))), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "5px 6px",
        textAlign: "center"
      }
    }, /*#__PURE__*/React.createElement("input", {
      type: "number",
      value: getRaw(div.code, "d") !== "" ? getRaw(div.code, "d") : d === 0 ? "" : d,
      placeholder: "0",
      onChange: e => setRaw(div.code, "d", e.target.value),
      onBlur: e => {
        clearRaw(div.code, "d");
        var v = e.target.value === "" ? 0 : Math.max(0, Math.min(64, Number(e.target.value) || 0));
        updateDiv(div.code, {
          d: v,
          dcons: v < 4 ? false : dcons
        });
      },
      onKeyDown: e => {
        if (e.key === "Enter") e.target.blur();
      },
      className: "calc-input",
      style: Object.assign({}, numInputStyle, {
        width: 50
      })
    })), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "5px 6px",
        textAlign: "center"
      }
    }, d >= 4 ? /*#__PURE__*/React.createElement("input", {
      type: "checkbox",
      checked: dcons,
      onChange: e => updateDiv(div.code, {
        dcons: e.target.checked
      }),
      style: {
        width: 15,
        height: 15,
        accentColor: "var(--chart-deep)",
        cursor: "pointer"
      }
    }) : /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--muted)"
      }
    }, "\u2014")), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "5px 6px",
        textAlign: "center"
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "mono",
      style: {
        fontSize: 12,
        color: d === 0 ? "var(--muted)" : "var(--ink)"
      }
    }, d === 0 ? "—" : calcSeedsFor(d))), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "5px 6px",
        textAlign: "center"
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "mono",
      style: {
        fontSize: 12,
        fontWeight: 700
      }
    }, sm + dm || "—"), sm + dm > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 10,
        color: "var(--muted)",
        whiteSpace: "nowrap"
      }
    }, sm, "s", scons ? "+c" : "", " \xB7 ", dm, "d", dcons ? "+c" : "")), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "5px 8px",
        textAlign: "center",
        width: 24
      }
    }, div.isCustom && /*#__PURE__*/React.createElement("button", {
      onClick: () => removeDivision(div.code),
      style: {
        border: "none",
        background: "none",
        cursor: "pointer",
        color: "var(--muted)",
        fontSize: 16,
        lineHeight: 1,
        padding: "0 2px",
        borderRadius: 4
      },
      onMouseEnter: e => e.target.style.color = "#b52222",
      onMouseLeave: e => e.target.style.color = "var(--muted)"
    }, "\xD7")));
  }), /*#__PURE__*/React.createElement("tr", {
    style: {
      background: "var(--cream-deep)",
      borderTop: "2px solid var(--line-strong)"
    }
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "8px 8px 8px 14px",
      fontSize: 10,
      fontWeight: 700,
      color: "var(--muted)",
      textTransform: "uppercase",
      letterSpacing: "0.07em"
    }
  }, "Total"), /*#__PURE__*/React.createElement("td", {
    colSpan: 2,
    style: {
      padding: "8px 6px",
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 12,
      fontWeight: 700
    }
  }, totalPlayers, " players")), /*#__PURE__*/React.createElement("td", null), /*#__PURE__*/React.createElement("td", {
    colSpan: 2,
    style: {
      padding: "8px 6px",
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 12,
      fontWeight: 700
    }
  }, totalTeams, " teams")), /*#__PURE__*/React.createElement("td", null), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "8px 6px",
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: statusColor
    }
  }, totalMatches)), /*#__PURE__*/React.createElement("td", null))))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "10px 14px",
      borderTop: "1px dashed var(--line-strong)",
      display: "flex",
      gap: 8,
      alignItems: "center",
      background: "var(--cream-deep)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.07em",
      textTransform: "uppercase",
      color: "var(--muted)",
      whiteSpace: "nowrap",
      flex: "0 0 auto"
    }
  }, "+ Division"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: newDivName,
    onChange: e => setNewDivName(e.target.value),
    onKeyDown: e => {
      if (e.key === "Enter") addDivision();
    },
    placeholder: "e.g. 40+ Open, Women's B\u2026",
    style: {
      flex: 1,
      minWidth: 0,
      padding: "5px 10px",
      borderRadius: 6,
      fontSize: 12,
      border: "1px solid var(--line-strong)",
      background: "var(--cream)",
      color: "var(--ink)",
      outline: "none"
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn",
    onClick: addDivision,
    disabled: !newDivName.trim(),
    style: {
      fontSize: 11,
      flexShrink: 0,
      opacity: newDivName.trim() ? 1 : 0.4
    }
  }, "Add")))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: "1 1 180px",
      display: "flex",
      flexDirection: "column",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: Object.assign({}, labelRow, {
      marginBottom: 10
    })
  }, "Day-by-day estimate"), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      background: "var(--ink)",
      padding: "16px 18px"
    }
  }, function () {
    var remaining = totalMatches;
    return Array.from({
      length: days
    }, function (_, idx) {
      var cap = Math.max(1, slotsPerDayArr[idx]);
      var shown = Math.min(remaining, cap);
      remaining = Math.max(0, remaining - cap);
      var p = Math.min(100, Math.round(shown / cap * 100));
      var full = shown >= cap && remaining > 0;
      var barColor = full ? "#ff8a8a" : p > 85 ? "#ffe08a" : "var(--chart)";
      return /*#__PURE__*/React.createElement("div", {
        key: idx,
        style: {
          marginBottom: idx < days - 1 ? 14 : 6
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 3
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 12,
          fontWeight: 700,
          color: "var(--cream)"
        }
      }, "Day ", idx + 1), /*#__PURE__*/React.createElement("span", {
        className: "mono",
        style: {
          fontSize: 12,
          fontWeight: 700,
          color: barColor
        }
      }, shown, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 10,
          fontWeight: 400,
          color: "rgba(242,239,231,0.35)"
        }
      }, "/", cap), idx === days - 1 && remaining > 0 && /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 10,
          color: "#ff8a8a",
          marginLeft: 4
        }
      }, "+", remaining))), /*#__PURE__*/React.createElement("div", {
        style: {
          height: 5,
          background: "rgba(255,255,255,0.1)",
          borderRadius: 3,
          overflow: "hidden"
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          height: "100%",
          width: p + "%",
          borderRadius: 3,
          background: barColor,
          transition: "width 0.2s"
        }
      })));
    });
  }(), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: "1px solid rgba(255,255,255,0.1)",
      paddingTop: 10,
      marginTop: 8,
      display: "flex",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: "rgba(242,239,231,0.4)",
      textTransform: "uppercase",
      letterSpacing: "0.07em"
    }
  }, days, "-day total"), /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: statusColor === "#2d7a2d" ? "var(--chart)" : statusColor === "#8a6000" ? "#ffe08a" : "#ff8a8a"
    }
  }, dayTotals.reduce((a, b) => a + b, 0))))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: Object.assign({}, labelRow, {
      marginBottom: 10
    })
  }, "By division"), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      padding: "14px",
      overflow: "hidden"
    }
  }, allDivisions.map(function (div) {
    if (!divs[div.code]) return null;
    var s = divs[div.code].s,
      d = divs[div.code].d;
    if (s === 0 && d === 0) return null;
    var ss = scheduleByDay(s, days, divs[div.code].scons);
    var ds = scheduleByDay(d, days, divs[div.code].dcons);
    return /*#__PURE__*/React.createElement("div", {
      key: div.code,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 5,
        marginBottom: 5
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        flex: "0 0 28px",
        fontWeight: 700,
        fontSize: 11,
        color: "var(--ink)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, div.label), dayTotals.map(function (_, idx) {
      var n = (ss[idx] || 0) + (ds[idx] || 0);
      return /*#__PURE__*/React.createElement("span", {
        key: idx,
        className: "mono",
        style: {
          flex: 1,
          textAlign: "center",
          padding: "2px 3px",
          borderRadius: 3,
          fontSize: 10,
          background: n === 0 ? "transparent" : "rgba(0,0,0,0.06)",
          color: n === 0 ? "var(--muted)" : "var(--ink)"
        }
      }, n > 0 ? n : "·");
    }), /*#__PURE__*/React.createElement("span", {
      className: "mono",
      style: {
        flex: "0 0 30px",
        textAlign: "right",
        fontSize: 10,
        color: "var(--muted)"
      }
    }, "=", calcSinglesMatches(s, divs[div.code].scons) + calcDoublesMatches(d, divs[div.code].dcons)));
  }))))));
};

ReactDOM.createRoot(document.getElementById("root")).render(
  /*#__PURE__*/React.createElement(DrawSizeCalc, null)
);
