# -*- coding: utf-8 -*-
"""Собирает index.html — «Экспресс-анализ для КМ»: один офлайн-файл без внешних ссылок.
Читалки Excel/PDF и разбор деклараций (src/read_*.js) — из основного сайта finanaliz."""
import json, re
spec = json.dumps(json.load(open("src/spec.json", encoding="utf-8")), ensure_ascii=False, separators=(",", ":"))
css = open("src/ex.css", encoding="utf-8").read()
parts = ["ex1.js", "read_xlsx.js", "read_pdf.js", "read_decl.js", "ex2.js", "ex3.js", "ex4.js"]
js = "\n".join(open("src/" + f, encoding="utf-8").read().replace('"use strict";', "", 1) for f in parts)
html = f"""<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'">
<title>Экспресс-анализ для КМ</title>
<style>{css}</style></head>
<body><script>window.SPEC = {spec};</script>
<script>"use strict";
{js}</script></body></html>"""
assert not re.search(r"https?://(?!www\.w3\.org|schemas\.openxmlformats)", html), "внешние ссылки"
open("index.html", "w", encoding="utf-8").write(html)
print(len(html))
