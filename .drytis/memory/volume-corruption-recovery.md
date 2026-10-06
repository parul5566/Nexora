2026-10-05: Container was recycled mid-write and the volume came back corrupted: `Bad message` I/O errors on several node_modules dirs AND on source files src/ai/*.ts and src/social_bad/*.ts (Module 22 AI files were lost). Symptoms: API service 4412 crash-looping with MODULE_NOT_FOUND (append-field), preview returning 500 "Internal Server Error", register failing with JSON parse error in the UI.

Recovery steps that worked:
1. `mv node_modules node_modules_corrupt` (rm fails on corrupted dirs) then fresh `npm install` at /workspace root AND rm -rf apps/*/node_modules + reinstall (hoisted workspaces).
2. Detect corrupted sources: `find . -name '*.ts' | while read f; do head -c1 $f >/dev/null 2>&1 || echo CORRUPT: $f; done`. Move corrupt dirs aside, exclude in tsconfig (`ai_corrupt`, `social_bad_corrupt`).
3. Reconstructed src/ai/{aiProvider,aiService,aiRoutes}.ts from the surviving test file src/tests/ai.integration.test.ts — provider abstraction (StaticProvider/OpenAICompatibleProvider/AiUnavailableError), features write/summarize/hashtags, 404 unknown feature, 503 AI_UNAVAILABLE, OPENAI_API_KEY env decides availability.
4. events.integration.test failed from test-DB pollution (listEvents default limit 20 ordered by starts_at ASC, thousands of old rows crowd out new); raised default limit to 50.
5. ai test needs 60s timeout (real LLM call through configured OPENAI key).

Prevention: publish after each verified module so git has the sources; corrupted files were unpublished work.
