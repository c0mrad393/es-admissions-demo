#!/bin/sh
# Wrap the artifact body (src/app-body.html) into a full page for GitHub Pages.
cd "$(dirname "$0")/.." || exit 1
{
  printf '<!doctype html>\n<html lang="ka">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="robots" content="noindex">\n<style>body{margin:0}[hidden]{display:none!important}</style>\n</head>\n<body>\n'
  cat src/app-body.html
  printf '\n</body>\n</html>\n'
} > index.html
echo "built index.html"
