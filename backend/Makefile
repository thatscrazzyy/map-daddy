PYTHON ?= python3
VENV ?= venv
PIP := $(VENV)/bin/pip
PY := $(VENV)/bin/python

.PHONY: install dev

install:
	$(PYTHON) -m venv $(VENV)
	$(PIP) install -r requirements.txt

dev:
	$(PY) main.py
