# მიღების პორტალი — დემო

ინტერაქტიული დემო: OpenApply-დან გადმოწერილი განაცხადის PDF იტვირთება, ველები ავტომატურად ივსება, თანამშრომელი ამოწმებს და ადასტურებს.

- დემო: https://c0mrad393.github.io/es-admissions-demo/
- სატესტო PDF-ები (გამოგონილი მონაცემები): `samples/`
- ყველა მონაცემი გამოგონილია. PDF იკითხება ბრაუზერში და არსად იგზავნება.

Structure: `src/app-body.html` (page body, also published as a Claude artifact) → `tools/build.sh` → `index.html`.
`parser.js` reads the OpenApply PDF text layer; `tools/run.mjs` tests it in Node; `tools/make_samples.py` regenerates the sample PDFs.
