PYTHON ?= python3
VENV ?= venv
PIP := $(VENV)/bin/pip
PY := $(VENV)/bin/python
PROJECT_DIR ?= $(abspath ..)
RELAY ?= ws://localhost:8080
CODE ?= MD-123456
SECRET ?=
SERVER ?= http://127.0.0.1:8000

.PHONY: install run run-windowed run-relay run-local build build-linux build-pi autostart-install autostart-enable autostart-disable logs clean-cache

install:
	$(PYTHON) -m venv $(VENV)
	$(PIP) install -r requirements.txt

run:
	$(PY) mapdaddy_receiver.py

run-windowed:
	$(PY) mapdaddy_receiver.py --windowed

run-relay:
	$(PY) mapdaddy_receiver.py --relay $(RELAY) --code $(CODE) $(if $(SECRET),--session-secret $(SECRET),)

run-local:
	$(PY) mapdaddy_receiver.py --server $(SERVER)

build: build-linux

build-linux:
	bash scripts/build_linux.sh

build-pi:
	bash scripts/build_pi.sh

autostart-install:
	sed "s|@PROJECT_DIR@|$(PROJECT_DIR)|g" mapdaddy-receiver.service | sudo tee /etc/systemd/system/mapdaddy-receiver.service >/dev/null
	sudo systemctl daemon-reload

autostart-enable:
	sudo systemctl enable mapdaddy-receiver.service
	sudo systemctl start mapdaddy-receiver.service

autostart-disable:
	sudo systemctl disable mapdaddy-receiver.service
	sudo systemctl stop mapdaddy-receiver.service

logs:
	journalctl -u mapdaddy-receiver.service -f

clean-cache:
	rm -rf ~/.mapdaddy/cache
