const LEVELS = [{
  code: "WomensOpen",
  label: "Women's Open"
}, {
  code: "WomensA",
  label: "Women's A"
}, {
  code: "WomensB",
  label: "Women's B"
}, {
  code: "WomensC",
  label: "Women's C"
}, {
  code: "WomensD",
  label: "Women's D"
}, {
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
}, {
  code: "MixedOpen",
  label: "Mixed Open"
}, {
  code: "MixedA",
  label: "Mixed A"
}, {
  code: "MixedB",
  label: "Mixed B"
}, {
  code: "MixedC",
  label: "Mixed C"
}, {
  code: "MixedD",
  label: "Mixed D"
}];

// Which gender-filter bucket a level code belongs to. Custom (TD-added)
// levels are their own "custom" bucket — it has no checkbox, so they're
// always shown and never cleared by toggling a gender filter.
function categoryFor(code) {
  if (/^custom_/.test(code)) return "custom";
  if (/^Womens/.test(code)) return "womens";
  if (/^Mixed/.test(code)) return "mixed";
  return "any";
}
var GENDER_FILTERS = [["womens", "Women"], ["any", "Any Gender"], ["mixed", "Mixed"]];
// Only Women's is shown by default — Any Gender and Mixed start unchecked
var DEFAULT_GENDER_FILTERS = {
  womens: true,
  any: false,
  mixed: false
};

// Split n entrants into `groups` round-robin pools as evenly as possible
function splitEven(n, groups) {
  if (!n || !groups || groups < 1) return [];
  var base = Math.floor(n / groups),
    rem = n % groups;
  var sizes = [];
  for (var i = 0; i < groups; i++) sizes.push(base + (i < rem ? 1 : 0));
  return sizes;
}

// Total round-robin matches across all pools (every pair within a pool plays once)
function rrGroupMatches(n, groups) {
  return splitEven(n, groups).reduce(function (sum, size) {
    return sum + size * (size - 1) / 2;
  }, 0);
}
function calcBracketMatches(n, cons) {
  if (!n || n < 2) return 0;
  return n - 1 + (cons && n >= 4 ? Math.floor(n / 2) - 1 : 0);
}

// Eligible for a consolation bracket. Once round robin is selected, cons
// isn't offered at all — only the standard single-elim bracket supports it.
function consEligible(n, rrGroups) {
  return !rrGroups && n >= 4;
}

// rrGroups >= 1: round-robin group stage, plus (when there's more than one
// group) a single-elim playoff among the group winners, one per group.
// A single group is just round robin end to end — no playoff.
function calcSinglesMatches(n, cons, rrGroups) {
  if (!n || n < 2) return 0;
  if (rrGroups && rrGroups >= 1) {
    return rrGroupMatches(n, rrGroups) + calcBracketMatches(rrGroups, cons);
  }
  return calcBracketMatches(n, cons);
}
function calcDoublesMatches(n, cons, rrGroups) {
  if (!n || n < 2) return 0;
  if (rrGroups && rrGroups >= 1) {
    return rrGroupMatches(n, rrGroups) + calcBracketMatches(rrGroups, cons);
  }
  return calcBracketMatches(n, cons);
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
//   Last day  → SF + F (final 2 rounds of the elimination stage)
//   Early elimination rounds distributed evenly across days 0..days-2
//   Consolation starts day 1, spread over days 1..last-1
//   When rrGroups >= 1, n is split into round-robin pools (played across the
//   early days), and the elimination stage above runs on the pool winners
//   (rrGroups players) instead of the full field. A single group has no
//   playoff, so its round-robin matches spread across every day instead.
function scheduleByDay(n, days, cons, rrGroups) {
  var result = new Array(days).fill(0);
  if (!n || n < 2 || days < 1) return result;
  var isRR = rrGroups && rrGroups >= 1;
  var mainRounds = buildRounds(isRR ? rrGroups : n);
  var totalRounds = mainRounds.length;
  var rrMatches = isRR ? rrGroupMatches(n, rrGroups) : 0;

  if (days === 1) {
    result[0] = mainRounds.reduce(function (a, b) {
      return a + b;
    }, 0) + rrMatches;
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

    // Round-robin pool play happens before the playoff bracket — spread evenly
    // across the early days too. With a single group there's no playoff to
    // reserve the last day for, so spread across every day instead.
    if (rrMatches > 0) {
      var rrDays = totalRounds > 0 ? earlyDays : days;
      var rrBase = Math.floor(rrMatches / rrDays),
        rrRem = rrMatches % rrDays;
      for (var rd = 0; rd < rrDays; rd++) result[rd] += rrBase + (rd < rrRem ? 1 : 0);
    }
  }

  // Consolation: starts day 1, spread across days 1..days-1
  // (based on the elimination-stage field: rrGroups if round robin, else n)
  var consBase = isRR ? rrGroups : n;
  if (cons && consBase >= 4) {
    var consRounds = buildRounds(Math.floor(consBase / 2));
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
  },
  WomensOpen: {
    s: 16,
    d: 8
  },
  WomensA: {
    s: 32,
    d: 16
  },
  WomensB: {
    s: 32,
    d: 16
  },
  WomensC: {
    s: 16,
    d: 8
  },
  WomensD: {
    s: 16,
    d: 8
  },
  MixedOpen: {
    s: 0,
    d: 8
  },
  MixedA: {
    s: 0,
    d: 16
  },
  MixedB: {
    s: 0,
    d: 16
  },
  MixedC: {
    s: 0,
    d: 8
  },
  MixedD: {
    s: 0,
    d: 8
  }
};

// Default draw sizes for any custom level added by the TD
var CUSTOM_LEVEL_DEFAULT = {
  s: 16,
  d: 8
};

// Mixed has no singles column (doubles-only division), so its singles
// consolation is never applicable
function defaultSconsFor(code) {
  return !/^Mixed/.test(code);
}
// Mixed doubles starts with consolation checked by default
// (Women's doubles starts unchecked, same as the base Open/A/B/C/D levels)
function defaultDconsFor(code) {
  return /^Mixed/.test(code);
}
function makeInitLevels(levelList) {
  var list = levelList || LEVELS;
  var out = {};
  list.forEach(function (d) {
    var p = PRESET_DEFAULT[d.code] || CUSTOM_LEVEL_DEFAULT;
    // Categories that start unchecked (see DEFAULT_GENDER_FILTERS) begin cleared,
    // matching what unchecking that filter would do
    var shown = DEFAULT_GENDER_FILTERS[categoryFor(d.code)];
    out[d.code] = {
      s: shown ? p.s : 0,
      d: shown ? p.d : 0,
      scons: shown && defaultSconsFor(d.code) && p.s >= 4,
      dcons: shown && defaultDconsFor(d.code) && p.d >= 4,
      sRR: 0,
      dRR: 0
    };
  });
  return out;
}
const DrawSizeCalc = () => {
  const [days, setDays] = React.useState(3);
  const [hrsDays, setHrsDays] = React.useState([14, 14, 14]);
  const [courtsPerDay, setCourtsPerDay] = React.useState([10, 10, 10]);
  const [slotDur, setSlotDur] = React.useState(90);

  // Extra levels added by the TD (beyond the base 5)
  const [extraLevels, setExtraLevels] = React.useState([]); // [{ code, label }]
  const [newLevelName, setNewLevelName] = React.useState("");
  const allLevels = React.useMemo(() => [...LEVELS, ...extraLevels], [extraLevels]);
  const [levels, setLevels] = React.useState(() => makeInitLevels(LEVELS));
  // Which gender sections are shown in the Levels table. Checking a section
  // applies its default draw sizes; unchecking clears every level in it
  // (draw sizes, cons, RR groups) so it drops out of the totals too, not
  // just the table.
  const [genderFilters, setGenderFilters] = React.useState(() => Object.assign({}, DEFAULT_GENDER_FILTERS));
  function defaultsForCategory(key) {
    // Mixed has no singles column — only doubles gets a default, with cons on
    if (key === "mixed") {
      return {
        s: 0,
        d: 16,
        scons: false,
        dcons: true,
        sRR: 0,
        dRR: 0
      };
    }
    return {
      s: 16,
      d: 16,
      scons: true,
      dcons: false,
      sRR: 0,
      dRR: 0
    };
  }
  function toggleGenderFilter(key) {
    setGenderFilters(prev => {
      var wasChecked = prev[key];
      var patch = wasChecked ? {
        s: 0,
        d: 0,
        scons: false,
        dcons: false,
        sRR: 0,
        dRR: 0
      } : defaultsForCategory(key);
      setLevels(lv => {
        var next = Object.assign({}, lv);
        allLevels.forEach(function (level) {
          if (categoryFor(level.code) === key) {
            next[level.code] = Object.assign({}, next[level.code], patch);
          }
        });
        return next;
      });
      return Object.assign({}, prev, {
        [key]: !wasChecked
      });
    });
  }
  // Raw string values for draw inputs — keeps display in sync while typing
  // without committing intermediate values that would hide consolation checkboxes
  const [rawLevels, setRawLevels] = React.useState({});
  function getRaw(code, field) {
    return rawLevels[code] && rawLevels[code][field] != null ? rawLevels[code][field] : null;
  }
  function setRaw(code, field, val) {
    setRawLevels(function (prev) {
      var n = Object.assign({}, prev);
      n[code] = Object.assign({}, n[code], {});
      n[code][field] = val;
      return n;
    });
  }
  function clearRaw(code, field) {
    setRawLevels(function (prev) {
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
  function updateLevel(code, patch) {
    setLevels(prev => Object.assign({}, prev, {
      [code]: Object.assign({}, prev[code], patch)
    }));
  }
  // Reduce every level's current draw sizes by ~10% (floor), leaving
  // cons/round-robin settings as-is unless they're no longer eligible
  function applySafety() {
    setLevels(prev => {
      var next = {};
      allLevels.forEach(function (d) {
        var cur = prev[d.code] || CUSTOM_LEVEL_DEFAULT;
        var s = Math.max(0, Math.floor((cur.s || 0) * 0.9));
        var dd = Math.max(0, Math.floor((cur.d || 0) * 0.9));
        next[d.code] = Object.assign({}, cur, {
          s: s,
          d: dd,
          scons: consEligible(s, cur.sRR) ? cur.scons : false,
          dcons: consEligible(dd, cur.dRR) ? cur.dcons : false
        });
      });
      return next;
    });
  }
  function addLevel() {
    var name = newLevelName.trim();
    if (!name) return;
    // Generate a unique code from the name
    var code = "custom_" + name.replace(/\s+/g, "_").toLowerCase() + "_" + Date.now();
    var newLevel = {
      code: code,
      label: name,
      isCustom: true
    };
    setExtraLevels(prev => [...prev, newLevel]);
    setLevels(prev => Object.assign({}, prev, {
      [code]: {
        s: CUSTOM_LEVEL_DEFAULT.s,
        d: CUSTOM_LEVEL_DEFAULT.d,
        scons: true,
        dcons: false,
        sRR: 0,
        dRR: 0
      }
    }));
    setNewLevelName("");
  }
  function removeLevel(code) {
    setExtraLevels(prev => prev.filter(d => d.code !== code));
    setLevels(prev => {
      var n = Object.assign({}, prev);
      delete n[code];
      return n;
    });
  }
  var totalMatches = 0,
    totalPlayers = 0,
    totalTeams = 0;
  allLevels.forEach(function (d) {
    if (!levels[d.code]) return;
    totalMatches += calcSinglesMatches(levels[d.code].s, levels[d.code].scons, levels[d.code].sRR) + calcDoublesMatches(levels[d.code].d, levels[d.code].dcons, levels[d.code].dRR);
    totalPlayers += levels[d.code].s;
    totalTeams += levels[d.code].d;
  });
  var dayTotals = [];
  var di;
  for (di = 0; di < days; di++) dayTotals.push(0);
  allLevels.forEach(function (level) {
    if (!levels[level.code]) return;
    var ss = scheduleByDay(levels[level.code].s, days, levels[level.code].scons, levels[level.code].sRR);
    var ds = scheduleByDay(levels[level.code].d, days, levels[level.code].dcons, levels[level.code].dRR);
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
  // Native <select> arrows sit flush against the border regardless of CSS
  // padding, so a real gap needs a custom arrow drawn with appearance:none
  var rrSelectStyle = Object.assign({}, numInputStyle, {
    width: 50,
    padding: "5px 20px 5px 6px",
    cursor: "pointer",
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238A857A' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 7px center",
    backgroundSize: "8px 5px"
  });
  var RR_GROUP_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  function renderRRSelect(value, onChange) {
    return /*#__PURE__*/React.createElement("select", {
      value: value || 0,
      onChange: e => onChange(Number(e.target.value)),
      className: "calc-input",
      style: rrSelectStyle
    }, RR_GROUP_OPTIONS.map(g => /*#__PURE__*/React.createElement("option", {
      key: g,
      value: g
    }, g === 0 ? "—" : g + "g")));
  }
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
  }, "DRAW SIZE CALCULATOR"))), /*#__PURE__*/React.createElement("div", {
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
      var v = e.target.value === "" ? 0 : Number(e.target.value);
      if (!isNaN(v)) setDays(v);
    },
    onBlur: e => setDays(Math.max(1, Math.min(5, Number(e.target.value) || 1))),
    onKeyDown: e => {
      if (e.key === "Enter") e.target.blur();
    },
    className: "calc-input",
    style: Object.assign({}, numInputStyle, {
      width: 50
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
      var v = e.target.value === "" ? 0 : Number(e.target.value);
      if (!isNaN(v)) setSlotDur(v);
    },
    onBlur: e => setSlotDur(Math.max(30, Math.min(240, Number(e.target.value) || 90))),
    onKeyDown: e => {
      if (e.key === "Enter") e.target.blur();
    },
    className: "calc-input",
    style: Object.assign({}, numInputStyle, {
      width: 50
    })
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: "var(--muted)"
    }
  }, "min"))), /*#__PURE__*/React.createElement("div", {
    className: "box-scroll-outer"
  }, /*#__PURE__*/React.createElement("div", {
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
    min: 0,
    max: 40,
    onChange: e => {
      var v = e.target.value === "" ? 0 : Number(e.target.value);
      if (!isNaN(v)) setCourtsPerDay(prev => {
        var n = prev.slice();
        n[i] = Math.max(0, v);
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
      maxWidth: 50
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
    min: 0,
    max: 24,
    onChange: e => {
      var v = e.target.value === "" ? 0 : Number(e.target.value);
      if (!isNaN(v)) setHrsDays(prev => {
        var n = prev.slice();
        n[i] = Math.max(0, Math.min(24, v));
        return n;
      });
    },
    onBlur: e => {
      var v = Math.max(0, Math.min(24, Number(e.target.value) || 14));
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
      maxWidth: 50
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
  }, maxSlots)))))), /*#__PURE__*/React.createElement("div", {
    className: "box-scroll-fade"
  }))), /*#__PURE__*/React.createElement("div", {
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
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: labelRow
  }, "Levels"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 14,
      flexWrap: "wrap"
    }
  }, GENDER_FILTERS.map(([key, label]) => /*#__PURE__*/React.createElement("label", {
    key: key,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 5,
      fontSize: 11,
      fontWeight: 600,
      color: "var(--ink-muted)",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: genderFilters[key],
    onChange: () => toggleGenderFilter(key),
    style: {
      width: 14,
      height: 14,
      accentColor: "var(--chart-deep)",
      cursor: "pointer"
    }
  }), label)), /*#__PURE__*/React.createElement("button", {
    className: "btn",
    style: {
      fontSize: 11,
      marginLeft: "auto"
    },
    onClick: () => applySafety()
  }, "Max safety"))), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      padding: 0,
      clipPath: "inset(0 round var(--radius))"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "box-scroll-outer"
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
  }, "Level"), ["Singles", "Cons", "RR", "Seeds", "Doubles", "Cons", "RR", "Seeds", "Matches", ""].map((h, i) => /*#__PURE__*/React.createElement("th", {
    key: i,
    style: h === "Seeds" ? Object.assign({}, thStyle, {
      padding: "6px 0 8px 0"
    }) : thStyle
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, allLevels.filter(level => {
    var cat = categoryFor(level.code);
    return levels[level.code] && (cat === "custom" || genderFilters[cat]);
  }).map((level, i) => {
    var s = levels[level.code].s,
      d = levels[level.code].d;
    var scons = levels[level.code].scons,
      dcons = levels[level.code].dcons;
    var sRR = levels[level.code].sRR,
      dRR = levels[level.code].dRR;
    var sm = calcSinglesMatches(s, scons, sRR),
      dm = calcDoublesMatches(d, dcons, dRR);
    var isMixed = /^Mixed/.test(level.code);
    return /*#__PURE__*/React.createElement("tr", {
      key: level.code,
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
    }, level.label, level.isCustom && /*#__PURE__*/React.createElement("span", {
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
    }, isMixed ? /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--muted)"
      }
    }, "—") : /*#__PURE__*/React.createElement("input", {
      type: "number",
      value: getRaw(level.code, "s") != null ? getRaw(level.code, "s") : s === 0 ? "" : s,
      placeholder: "0",
      min: 0,
      max: 64,
      onChange: e => setRaw(level.code, "s", e.target.value),
      onBlur: e => {
        clearRaw(level.code, "s");
        var v = e.target.value === "" ? 0 : Math.max(0, Math.min(64, Number(e.target.value) || 0));
        updateLevel(level.code, {
          s: v,
          scons: consEligible(v, sRR) ? scons : false
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
        textAlign: "center",
        verticalAlign: "middle"
      }
    }, isMixed ? /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--muted)"
      }
    }, "—") : consEligible(s, sRR) ? /*#__PURE__*/React.createElement("input", {
      type: "checkbox",
      checked: scons,
      onChange: e => updateLevel(level.code, {
        scons: e.target.checked
      }),
      style: {
        width: 15,
        height: 15,
        verticalAlign: "middle",
        marginTop: -1,
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
    }, isMixed ? /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--muted)"
      }
    }, "—") : renderRRSelect(sRR, v => updateLevel(level.code, {
      sRR: v,
      scons: consEligible(s, v) ? scons : false
    }))), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "5px 0",
        textAlign: "center"
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "mono",
      style: {
        fontSize: 12,
        color: s === 0 ? "var(--muted)" : "var(--ink)"
      }
    }, isMixed ? "—" : s === 0 ? "—" : calcSeedsFor(s))), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "5px 6px",
        textAlign: "center"
      }
    }, /*#__PURE__*/React.createElement("input", {
      type: "number",
      value: getRaw(level.code, "d") != null ? getRaw(level.code, "d") : d === 0 ? "" : d,
      placeholder: "0",
      min: 0,
      max: 64,
      onChange: e => setRaw(level.code, "d", e.target.value),
      onBlur: e => {
        clearRaw(level.code, "d");
        var v = e.target.value === "" ? 0 : Math.max(0, Math.min(64, Number(e.target.value) || 0));
        updateLevel(level.code, {
          d: v,
          dcons: consEligible(v, dRR) ? dcons : false
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
        textAlign: "center",
        verticalAlign: "middle"
      }
    }, consEligible(d, dRR) ? /*#__PURE__*/React.createElement("input", {
      type: "checkbox",
      checked: dcons,
      onChange: e => updateLevel(level.code, {
        dcons: e.target.checked
      }),
      style: {
        width: 15,
        height: 15,
        verticalAlign: "middle",
        marginTop: -1,
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
    }, renderRRSelect(dRR, v => updateLevel(level.code, {
      dRR: v,
      dcons: consEligible(d, v) ? dcons : false
    }))), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "5px 0",
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
    }, level.isCustom && /*#__PURE__*/React.createElement("button", {
      onClick: () => removeLevel(level.code),
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
    colSpan: 3,
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
    colSpan: 3,
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
    className: "box-scroll-fade"
  })), /*#__PURE__*/React.createElement("div", {
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
  }, "+ Level"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: newLevelName,
    onChange: e => setNewLevelName(e.target.value),
    onKeyDown: e => {
      if (e.key === "Enter") addLevel();
    },
    placeholder: "e.g. Open 40+",
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
    onClick: addLevel,
    disabled: !newLevelName.trim(),
    style: {
      fontSize: 11,
      flexShrink: 0,
      opacity: newLevelName.trim() ? 1 : 0.4
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
  }, "By level"), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      padding: "14px",
      overflow: "hidden"
    }
  }, allLevels.map(function (level) {
    if (!levels[level.code]) return null;
    var s = levels[level.code].s,
      d = levels[level.code].d;
    if (s === 0 && d === 0) return null;
    var ss = scheduleByDay(s, days, levels[level.code].scons, levels[level.code].sRR);
    var ds = scheduleByDay(d, days, levels[level.code].dcons, levels[level.code].dRR);
    return /*#__PURE__*/React.createElement("div", {
      key: level.code,
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
    }, level.label), dayTotals.map(function (_, idx) {
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
    }, "=", calcSinglesMatches(s, levels[level.code].scons, levels[level.code].sRR) + calcDoublesMatches(d, levels[level.code].dcons, levels[level.code].dRR)));
  }))))));
};

ReactDOM.createRoot(document.getElementById("root")).render(
  /*#__PURE__*/React.createElement(DrawSizeCalc, null)
);

// Right-edge fade on .box-scroll tables: only shown at rest (scrollLeft 0),
// hidden immediately on any rightward scroll, shown again once scrolled
// back to the start.
(function () {
  function checkFade(el) {
    var outer = el.closest(".box-scroll-outer");
    if (!outer) return;
    var noOverflow = el.scrollWidth <= el.clientWidth;
    outer.classList.toggle("scrolled", noOverflow || el.scrollLeft > 0);
  }
  function checkAll() {
    document.querySelectorAll(".box-scroll").forEach(checkFade);
  }
  document.addEventListener("scroll", function (e) {
    if (e.target.classList && e.target.classList.contains("box-scroll")) checkFade(e.target);
  }, true);
  window.addEventListener("resize", checkAll);
  new MutationObserver(checkAll).observe(document.getElementById("root"), {
    childList: true,
    subtree: true
  });
  checkAll();
})();
