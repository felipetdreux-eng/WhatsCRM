from pathlib import Path
p = Path('src/App.jsx')
s = p.read_text(encoding='utf-8')
s = s.replace("        </div>\n\n\n      {pendingLoss && (", "        </div>\n      )}\n\n      {pendingLoss && (", 1)
s = s.replace("      )}      )}\n    </div>\n  );", "      )}\n    </div>\n  );", 1)
p.write_text(s, encoding='utf-8')
print('fixed loss modal nesting')
