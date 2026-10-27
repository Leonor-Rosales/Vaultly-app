#!/bin/sh
# El entrypoint de PostgreSQL lo ejecuta antes de cualquier SQL, incluso sin Node.
for archivo in /docker-entrypoint-initdb.d/*.sql; do
  basename "$archivo"
done | awk -F_ '
  $1 !~ /^[0-9]+$/ { print "Migración sin prefijo numérico: " $0 > "/dev/stderr"; fallo=1; next }
  {
    numero=$1+0
    if (numero in vistos) {
      print "Prefijo de migración duplicado " $1 ": " vistos[numero] " y " $0 > "/dev/stderr"
      fallo=1
    }
    vistos[numero]=$0
  }
  END { exit fallo }
'
