2026-07-06 - heatmap chart - chart_renderers.py, qwen_client.py - added brand-colored hour × day traffic heatmap and Qwen chart spec.
2026-07-06 - gauge chart - chart_renderers.py, qwen_client.py - added brand-colored semicircle KPI gauge with threshold marker and Qwen chart spec.
2026-07-06 - timeline layout - templates.py, qwen_client.py - added brand-colored horizontal event timeline layout and Qwen layout spec.
2026-07-06 - per-chart smoke tests - test_charts.py - added unittest coverage that every registered renderer writes a non-empty PNG.
2026-07-06 - qwen_client hardening - qwen_client.py - added HTTP connect/read timeouts, two retry backoff, and separate network vs JSON-validation exceptions.
2026-07-06 - Thai font support - brand.py, templates.py, fonts/Sarabun-*.ttf - registered Sarabun regular/bold and routed ReportLab styles through brand font lookups.
2026-07-06 - CLI wrapper - run_report.py - added command-line data/instruction/out wrapper wiring Qwen JSON planning to PDF rendering.
2026-07-06 - offline Qwen fixtures - fixtures/*.json, test_build_pdf_from_fixtures.py - added saved report JSON fixtures and offline PDF build regression test.
2026-07-06 - CherryFlow flow integration - apps/api/src/report-pdf-skill.ts, apps/api/src/module-registry.ts, apps/api/src/workflows.ts, qwen_client.py, run_report.py - added report.qwen_pdf workflow node, bearer-token support, and Thai CLI brand wiring.
2026-07-06 - real Qwen smoke hardening - qwen_client.py - parsed the first JSON object robustly when an OpenAI-compatible model appends trailing text.
2026-07-06 - DeepSeek API support - qwen_client.py - disabled vLLM guided_json for api.deepseek.com, used JSON object mode, and retried empty model content cleanly.
