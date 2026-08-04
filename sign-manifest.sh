#!/usr/bin/env bash
# Wrapper for the Ed25519 manifest signing tool
# Usage: ./sign-manifest.sh generate-keypair
#        ./sign-manifest.sh sign --manifest <file> --key <file>
#        ./sign-manifest.sh verify --manifest <file> --key <file>
exec dotnet run --project src/watchnexus/tools/sign-manifest --no-build -- "$@"
