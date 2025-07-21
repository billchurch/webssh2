#!/bin/bash

# Print 256-color test pattern in xterm-256color terminal
echo -e "\n256 Color Test Pattern\n"

# Colors 0-15: Standard colors
echo -e "Standard colors:"
for i in {0..15}; do
  printf "\e[48;5;${i}m%4s\e[0m" "$i"
done
echo -e "\n"

# Colors 16-231: Color cube
echo -e "Color cube:"
for i in {16..231}; do
  printf "\e[48;5;${i}m%4s\e[0m" "$i"
  if (( (i - 15) % 6 == 0 )); then
    echo
  fi
done
echo -e "\n"

# Colors 232-255: Grayscale
echo -e "Grayscale colors:"
for i in {232..255}; do
  printf "\e[48;5;${i}m%4s\e[0m" "$i"
done
echo -e "\n"