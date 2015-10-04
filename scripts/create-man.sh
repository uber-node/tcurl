marked-man usage.md \
	--version "v$(node -p "require('./package.json').version")" \
	--manual "tcurl" \
	> man/tcurl.1
