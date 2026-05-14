PYTHON ?= python3
NPM ?= npm

.PHONY: install install-pi dev backend frontend relay receiver receiver-windowed test clean

install:
	$(MAKE) -C backend install
	$(MAKE) -C frontend install
	$(MAKE) -C relay install
	$(MAKE) -C renderer-pi install

install-pi: install

dev:
	@echo "Run these in separate terminals: make backend, make frontend, make relay, make receiver-windowed"

backend:
	$(MAKE) -C backend dev

frontend:
	$(MAKE) -C frontend dev

relay:
	$(MAKE) -C relay dev

receiver:
	$(MAKE) -C renderer-pi run

receiver-windowed:
	$(MAKE) -C renderer-pi run-windowed

test:
	$(PYTHON) -m compileall backend/main.py renderer-pi/mapdaddy_receiver.py renderer-pi/src
	$(NPM) --prefix relay run test --if-present
	$(NPM) --prefix frontend run build --if-present

clean:
	$(MAKE) -C renderer-pi clean-cache
