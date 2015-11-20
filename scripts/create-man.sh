marked-man usage.md \
	--version "v$(node -p "require('./package.json').version")" \
	--manual "tcurl" \
    --breaks \
	> man/tcurl.1
