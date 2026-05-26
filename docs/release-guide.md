# Release Guide

Map Daddy releases package the hosted controller build and receiver executables without changing the runtime architecture.

## CI

`.github/workflows/ci.yml` runs on pushes and pull requests. It builds the frontend, checks relay syntax, installs receiver dependencies, and compiles backend/receiver Python.

## Tagged Releases

Create a semantic version tag:

```bash
git tag v0.3.0
git push origin v0.3.0
```

`.github/workflows/release.yml` builds:

- `MapDaddy-Receiver-Windows-x64.exe`
- `MapDaddy-Receiver-Linux-x64`
- `MapDaddy-Receiver-Linux-arm64`
- `MapDaddy-Receiver-RaspberryPi-arm64`

Artifacts are uploaded to the GitHub Release.

## Linux ARM64

Linux ARM64 builds run natively on GitHub's hosted `ubuntu-24.04-arm` runner and are required for tagged releases. This produces:

```text
MapDaddy-Receiver-Linux-arm64
```

This is a generic Linux ARM64 executable. It is not labeled as a Raspberry Pi OS build.

## Raspberry Pi ARM64

Do not treat Pi builds as x64 cross-compiles or generic Linux ARM64 builds. The release workflow requires a Raspberry Pi-backed self-hosted runner and produces:

```text
MapDaddy-Receiver-RaspberryPi-arm64
```

Configure the runner on Raspberry Pi OS with these labels:

```text
self-hosted
linux
ARM64
raspberry-pi
```

Tagged releases will not publish until this job succeeds. `renderer-pi/scripts/build_pi.sh` checks `/proc/device-tree/model` and refuses to run on non-Pi hardware by default.

For a one-off manual local build on the Pi:

```bash
cd renderer-pi
bash scripts/build_pi.sh
```

If you intentionally need a generic Linux ARM64 build, use `scripts/build_linux.sh MapDaddy-Receiver-Linux-arm64` instead.

## Local Packaging

Windows:

```powershell
cd renderer-pi
.\scripts\build_windows.ps1
```

Linux x64:

```bash
cd renderer-pi
bash scripts/build_linux.sh
```

Raspberry Pi ARM64:

```bash
cd renderer-pi
bash scripts/build_pi.sh
```
