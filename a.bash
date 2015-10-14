###-begin-tcurl-completion-###
# Copyright (c) npm, Inc. and Contributors
# All rights reserved.
#
# Installation: tcurl completion >> ~/.bashrc  (or ~/.zshrc)

if type complete &>/dev/null; then
  _tcurl_completion () {
    local words cword
    if type _get_comp_words_by_ref &>/dev/null; then
      _get_comp_words_by_ref -n = -n : -w words -i cword cur
    else
      cword="$COMP_CWORD"
      words=("${COMP_WORDS[@]}")
    fi

    local si="$IFS"
    IFS=$'\n' COMPREPLY=($(COMP_CWORD="$cword" \
                           COMP_LINE="$COMP_LINE" \
                           COMP_POINT="$COMP_POINT" \
                           tcurl completion -- "${words[@]}" \
                           2>/dev/null)) || return $?

    __ltrim_colon_completions "$cur"

    IFS="$si"
  }
  complete -o default -F _tcurl_completion tcurl
elif type compdef &>/dev/null; then
  _tcurl_completion() {
    local si=$IFS
    compadd -- $(COMP_CWORD=$((CURRENT-1)) \
                 COMP_LINE=$BUFFER \
                 COMP_POINT=0 \
                 npm completion -- "${words[@]}" \
                 2>/dev/null)
    IFS=$si
  }
  compdef _tcurl_completion npm
elif type compctl &>/dev/null; then
  _tcurl_completion () {
    local cword line point words si
    read -Ac words
    read -cn cword
    let cword-=1
    read -l line
    read -ln point
    si="$IFS"
    IFS=$'\n' reply=($(COMP_CWORD="$cword" \
                       COMP_LINE="$line" \
                       COMP_POINT="$point" \
                       tcurl completion -- "${words[@]}" \
                       2>/dev/null)) || return $?
    IFS="$si"
  }
  # if the completer function returns on matches, default
  # to filesystem matching
  compctl -K _tcurl_completion + -f + tcurl
fi
###-end-tcurl-completion-###
