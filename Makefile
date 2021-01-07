all: lint format cover build docs

setup:
	npm install
	cargo fetch

format:
	npm run format
	cargo fmt

lint:
	npm run lint
	cargo fix && cargo clippy

test:
	npm test
	cargo test

cover:
	npm run test:cover
	cargo tarpaulin --ignore-tests --out Html --output-dir coverage

watch:
	cargo watch -x 'run -- serve --protocol=ws'

build:
	npm run build
	cargo build --release && cargo strip

docs:
	npm run docs
	cargo doc
.PHONY: docs

clean:
	npm run clean
	cargo clean

