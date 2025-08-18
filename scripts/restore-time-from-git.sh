#!/usr/bin/env bash
# script source: https://gist.github.com/sloanlance/6ae879209ff488a26f786b240e06d3de

# Set timestamps of files in a cloned git repository to when they were last committed.

# Default: All git-controlled files in current directory, recursively
if [ ${#} = 0 ]; then
  files="$(git ls-files -z | xargs -0 echo)"
else
  # shellcheck disable=SC2124
  files="${@}"
fi

for file in ${files}; do
  time="$(git log --pretty=format:%cd -n 1 \
                  --date=format:%Y%m%d%H%M.%S --date-order -- "${file}")"
  if [ -z "${time}" ]; then
    echo "ERROR: skipping '${file}' — no git log found" >&2
    continue
  fi
  echo "${file} → ${time}"
  touch -m -t "${time}" "${file}"
done
